import {
  authorizeClinicalRequest,
  jsonResponse,
  sameOrigin,
  unauthorizedResponse,
} from "@/db/clinical";
import { ClinicalInputError, recordClinical } from "@/db/health-data";
import { env } from "cloudflare:workers";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonResponse({ error: "Solicitud no permitida." }, { status: 403 });
  const context = await authorizeClinicalRequest(request, ["observations.write"]);
  if (!context) return unauthorizedResponse("observations.write");

  const idempotencyKey = request.headers.get("x-idempotency-key")?.trim().slice(0, 120) || "";
  let syncId: string | null = null;
  try {
    const payload = await request.json() as Record<string, unknown>;
    if (idempotencyKey) {
      const existing = await env.DB.prepare(`SELECT entity_id, status FROM sync_events
        WHERE patient_id = ? AND idempotency_key = ?`)
        .bind(context.patientId, idempotencyKey).first<{ entity_id: string | null; status: string }>();
      if (existing?.status === "completed") {
        return jsonResponse({ ok: true, replayed: true, result: { id: existing.entity_id } });
      }
      if (existing) {
        return jsonResponse({ error: "Este registro ya tiene una sincronización en curso o fallida." }, { status: 409 });
      }

      syncId = `syn_${crypto.randomUUID()}`;
      const reservation = await env.DB.prepare(`INSERT OR IGNORE INTO sync_events
        (id, organization_id, patient_id, client_id, idempotency_key, entity_type,
        status, created_at) VALUES (?, ?, ?, 'offline-pwa', ?, ?, 'processing', ?)`)
        .bind(syncId, context.organizationId, context.patientId, idempotencyKey,
          String(payload.kind || "record").slice(0, 80), new Date().toISOString()).run();
      if (!reservation.meta.changes) {
        return jsonResponse({ error: "La sincronización de este registro ya fue recibida." }, { status: 409 });
      }
    }

    const result = await recordClinical(context, payload);
    if (syncId) {
      const entityId = typeof result === "object" && result && "id" in result
        ? String((result as { id?: unknown }).id || "")
        : null;
      await env.DB.prepare(`UPDATE sync_events SET status = 'completed', entity_id = ?
        WHERE id = ? AND patient_id = ?`)
        .bind(entityId, syncId, context.patientId).run();
    }
    return jsonResponse({ ok: true, result }, { status: 201 });
  } catch (error) {
    if (syncId) {
      await env.DB.prepare("UPDATE sync_events SET status = 'failed' WHERE id = ? AND patient_id = ?")
        .bind(syncId, context.patientId).run().catch(() => undefined);
    }
    const message = error instanceof ClinicalInputError
      ? error.message
      : "No pudimos guardar el registro. No se modificó la historia clínica.";
    return jsonResponse({ error: message }, { status: error instanceof ClinicalInputError ? 400 : 500 });
  }
}
