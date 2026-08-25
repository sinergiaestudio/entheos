import { authorizeClinicalRequest, jsonResponse, sameOrigin, validDate, writeAudit } from "@/db/clinical";
import { recordClinical } from "@/db/health-data";
import { env } from "cloudflare:workers";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonResponse({ error: "Origen no permitido." }, { status: 403 });
  const context = await authorizeClinicalRequest(request, ["profile.write"]);
  if (!context) return jsonResponse({ error: "Autenticación requerida." }, { status: 401 });
  if (!context.isGlobalAdmin) return jsonResponse({ recovered: false, reason: "owner_only" });
  const marker = "legacy-baseline-v8";
  const existingMarker = await env.DB.prepare("SELECT id FROM sync_events WHERE patient_id = ? AND idempotency_key = ?")
    .bind(context.patientId, marker).first();
  if (existingMarker) return jsonResponse({ recovered: false, alreadyRecovered: true });

  const legacy = await env.DB.prepare("SELECT payload FROM nutrition_data ORDER BY updated_at DESC LIMIT 20").all<{ payload: string }>();
  const firstName = context.displayName.trim().split(/\s+/)[0]?.toLocaleLowerCase("es-AR");
  const matches = legacy.results.flatMap((row) => {
    try {
      const parsed = JSON.parse(row.payload) as { settings?: Record<string, unknown>; days?: Record<string, unknown> };
      const name = String(parsed.settings?.name || "").trim().split(/\s+/)[0]?.toLocaleLowerCase("es-AR");
      return name === firstName ? [parsed] : [];
    } catch { return []; }
  });
  if (matches.length !== 1) return jsonResponse({ recovered: false, reason: "no_unique_match" });
  const settings = matches[0].settings || {};
  const height = Number(settings.height);
  const heightCm = height > 0 && height < 3 ? height * 100 : height;
  const startDate = validDate(settings.startDate) || null;
  const initialWeight = Number(settings.initialWeight);
  const durationWeeks = Math.min(52, Math.max(1, Number(settings.durationWeeks) || 6));
  const now = new Date().toISOString();

  if (heightCm >= 80 && heightCm <= 250) {
    await env.DB.prepare("UPDATE patient_profiles SET height_cm = COALESCE(height_cm, ?), updated_at = ? WHERE id = ? AND organization_id = ?")
      .bind(heightCm, now, context.patientId, context.organizationId).run();
  }
  if (startDate) {
    const existingPlan = await env.DB.prepare("SELECT id FROM nutrition_plans WHERE patient_id = ? AND organization_id = ? AND start_date = ? AND deleted_at IS NULL")
      .bind(context.patientId, context.organizationId, startDate).first();
    if (!existingPlan) {
      const end = new Date(`${startDate}T12:00:00.000Z`); end.setUTCDate(end.getUTCDate() + durationWeeks * 7 - 1);
      await env.DB.prepare(`INSERT INTO nutrition_plans
        (id, organization_id, patient_id, title, start_date, end_date, status, goals, version, created_by, created_at, updated_at)
        VALUES (?, ?, ?, 'Seguimiento nutricional recuperado', ?, ?, 'active', 'Constancia, hidratación y organización', 1, ?, ?, ?)`)
        .bind(`npl_${crypto.randomUUID()}`, context.organizationId, context.patientId, startDate, end.toISOString().slice(0, 10), context.userId, now, now).run();
    }
  }
  const existingWeight = startDate ? await env.DB.prepare("SELECT id FROM weight_entries WHERE patient_id = ? AND organization_id = ? AND substr(effective_at, 1, 10) = ? AND deleted_at IS NULL")
    .bind(context.patientId, context.organizationId, startDate).first() : null;
  if (!existingWeight && startDate && initialWeight >= 20 && initialWeight <= 400) {
    await recordClinical(context, { kind: "weight", effectiveAt: `${startDate}T12:00:00.000Z`, weightKg: initialWeight, conditions: "Dato inicial recuperado del seguimiento nutricional anterior" });
  }
  await env.DB.prepare(`INSERT INTO sync_events
    (id, organization_id, patient_id, client_id, idempotency_key, entity_type, status, created_at)
    VALUES (?, ?, ?, 'legacy-recovery', ?, 'baseline', 'completed', ?)`)
    .bind(`syn_${crypto.randomUUID()}`, context.organizationId, context.patientId, marker, now).run();
  await writeAudit(context, "recover", "legacy_baseline", marker, { source: "legacy", count: Object.keys(matches[0].days || {}).length });
  return jsonResponse({ recovered: true, startDate, initialWeight: Number.isFinite(initialWeight) ? initialWeight : null, heightCm });
}
