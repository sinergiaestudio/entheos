import { env } from "cloudflare:workers";
import { getFamilySession, verifyFamilyPassword } from "@/db/family-auth";
import {
  authorizeClinicalRequest,
  jsonResponse,
  sameOrigin,
  unauthorizedResponse,
  validDate,
  writeAudit,
} from "@/db/clinical";
import { recordClinical } from "@/db/health-data";

type LegacyState = {
  settings?: { startDate?: string; durationWeeks?: number; initialWeight?: number | string; height?: number | string };
  days?: Record<string, Record<string, unknown>>;
};

export async function GET(request: Request) {
  const context = await authorizeClinicalRequest(request, ["health.read"]);
  if (!context) return unauthorizedResponse();
  const legacy = await getFamilySession(request).catch(() => null);
  if (!legacy) return jsonResponse({ available: false });
  const marker = await env.DB.prepare(`SELECT id, status FROM sync_events
    WHERE patient_id = ? AND idempotency_key = ?`)
    .bind(context.patientId, `legacy-nutrition:${legacy.id}`).first<{ id: string; status: string }>();
  const row = await env.DB.prepare("SELECT payload, updated_at FROM nutrition_data WHERE user_id = ?")
    .bind(legacy.id).first<{ payload: string; updated_at: string }>();
  return jsonResponse({
    available: Boolean(row && row.payload !== "{}" && !marker),
    alreadyImported: marker?.status === "completed",
    incompleteAttempt: Boolean(marker && marker.status !== "completed"),
    profileName: legacy.displayName,
    updatedAt: row?.updated_at || null,
  });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonResponse({ error: "Solicitud no permitida." }, { status: 403 });
  const context = await authorizeClinicalRequest(request, ["observations.write"]);
  if (!context) return unauthorizedResponse("observations.write");
  const legacy = await getFamilySession(request).catch(() => null);
  if (!legacy) return jsonResponse({ error: "No encontramos una sesión anterior para migrar." }, { status: 404 });
  const input = await request.json().catch(() => ({})) as { legacyPassword?: unknown };
  if (!await verifyFamilyPassword(legacy.id, input.legacyPassword)) {
    return jsonResponse({ error: "La contraseña del perfil anterior no coincide." }, { status: 401 });
  }
  const key = `legacy-nutrition:${legacy.id}`;
  const existingMarker = await env.DB.prepare(`SELECT id, status FROM sync_events
    WHERE patient_id = ? AND idempotency_key = ?`)
    .bind(context.patientId, key).first<{ id: string; status: string }>();
  if (existingMarker?.status === "completed") return jsonResponse({ ok: true, alreadyImported: true });
  if (existingMarker) return jsonResponse({ error: "Existe un intento de migración incompleto. Revisá la historia antes de reintentarlo." }, { status: 409 });
  const row = await env.DB.prepare("SELECT payload FROM nutrition_data WHERE user_id = ?")
    .bind(legacy.id).first<{ payload: string }>();
  if (!row?.payload) return jsonResponse({ error: "El seguimiento anterior está vacío." }, { status: 404 });
  let state: LegacyState;
  try {
    state = JSON.parse(row.payload) as LegacyState;
  } catch {
    return jsonResponse({ error: "El seguimiento anterior no tiene un formato recuperable." }, { status: 400 });
  }
  const firstRecordedDate = Object.keys(state.days || {}).filter((date) => validDate(date)).sort()[0];
  const startDate = validDate(state.settings?.startDate) || firstRecordedDate || new Date().toISOString().slice(0, 10);
  const requestedWeeks = Number(state.settings?.durationWeeks);
  const durationWeeks = Number.isFinite(requestedWeeks)
    ? Math.min(52, Math.max(1, Math.round(requestedWeeks)))
    : 6;
  const endDate = addDays(startDate, durationWeeks * 7 - 1);
  const planId = `npl_${crypto.randomUUID()}`;
  const syncId = `syn_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  await env.DB.prepare(`INSERT INTO sync_events
    (id, organization_id, patient_id, client_id, idempotency_key, entity_type, entity_id,
    status, created_at) VALUES (?, ?, ?, 'legacy-pwa', ?, 'nutrition_plan', ?, 'processing', ?)`) 
    .bind(syncId, context.organizationId, context.patientId, key, planId, now).run();
  let importedDays = 0;
  let importedMeasurements = 0;
  try {
  await env.DB.prepare(`INSERT OR IGNORE INTO nutrition_plans
    (id, organization_id, patient_id, title, start_date, end_date, status, goals, version,
    created_by, created_at, updated_at)
    VALUES (?, ?, ?, 'Seguimiento nutricional migrado', ?, ?, 'active',
    'Constancia, hidratación y organización', 1, ?, ?, ?)`)
    .bind(planId, context.organizationId, context.patientId, startDate, endDate, context.userId, now, now).run();

  for (const [date, raw] of Object.entries(state.days || {}).sort(([a], [b]) => a.localeCompare(b)).slice(0, 400)) {
    if (!validDate(date)) continue;
    const day = raw as Record<string, unknown>;
    const meals = day.meals && typeof day.meals === "object"
      ? Object.entries(day.meals as Record<string, Record<string, unknown>>).map(([mealKey, meal]) => ({
        mealKey,
        timeLabel: mealTime(mealKey),
        status: meal.status,
        structure: meal.structure,
        foods: meal.foods,
        notes: meal.notes,
      }))
      : [];
    await recordClinical(context, {
      kind: "nutrition_day",
      planId,
      date,
      hydration: hydrationNumber(day.hydration),
      sleepHours: day.sleepHours,
      sleepQuality: day.sleepQuality,
      energy: day.energy,
      hungerAnxiety: day.hunger,
      digestion: day.digestion,
      observations: day.observations,
      meals,
    });
    importedDays += 1;
    if (day.weight) {
      await recordClinical(context, { kind: "weight", effectiveAt: `${date}T12:00:00.000Z`, weightKg: day.weight, conditions: "Migrado del seguimiento nutricional" });
      importedMeasurements += 1;
    }
    const pressure = day.bloodPressure as Record<string, Record<string, unknown>> | undefined;
    const readings = pressure ? Object.entries(pressure).map(([period, value]) => ({
      systolic: value.systolic,
      diastolic: value.diastolic,
      pulse: period === "morning" ? day.restingPulse : null,
      effectiveAt: `${date}T${period === "morning" ? "09" : period === "afternoon" ? "16" : "22"}:00:00.000Z`,
      context: `Migrado · ${period}`,
    })).filter((item) => item.systolic && item.diastolic) : [];
    if (readings.length) {
      await recordClinical(context, { kind: "blood_pressure", effectiveAt: `${date}T09:00:00.000Z`, readings });
      importedMeasurements += readings.length;
    }
    const activity = day.activity as Record<string, unknown> | undefined;
    if (activity?.type) {
      await recordClinical(context, {
        kind: "activity",
        effectiveAt: `${date}T18:00:00.000Z`,
        activityType: activity.type,
        durationMinutes: activity.duration,
        perceivedEffort: activity.intensity,
        comments: activity.comments,
      });
      importedMeasurements += 1;
    }
  }
  } catch {
    await env.DB.prepare("UPDATE sync_events SET status = 'failed' WHERE id = ? AND patient_id = ?")
      .bind(syncId, context.patientId).run();
    await writeAudit(context, "migrate", "nutrition_plan", planId, { source: "legacy", status: "failed" }, "error");
    return jsonResponse({ error: "La migración se detuvo. Revisá la historia antes de volver a intentar para evitar duplicados." }, { status: 409 });
  }
  await env.DB.prepare("UPDATE sync_events SET status = 'completed' WHERE id = ? AND patient_id = ?")
    .bind(syncId, context.patientId).run();
  await writeAudit(context, "migrate", "nutrition_plan", planId, { source: "legacy", count: importedDays });
  return jsonResponse({ ok: true, importedDays, importedMeasurements, planId });
}

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function hydrationNumber(value: unknown) {
  if (typeof value === "number") return value;
  const normalized = String(value || "").toLowerCase();
  return ({ baja: 1, media: 2, buena: 3, excelente: 4 } as Record<string, number>)[normalized] || Number(value) || null;
}

function mealTime(key: string) {
  return ({ breakfast: "06:30", midmorning: "09:00", lunch: "13:00", drinks: "Día", snack: "17:00", dinner: "21:00" } as Record<string, string>)[key] || "";
}
