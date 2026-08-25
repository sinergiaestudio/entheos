import { env } from "cloudflare:workers";
import {
  cleanText,
  finiteNumber,
  jsonResponse,
  sha256,
  validIsoDateTime,
} from "@/db/clinical";
import {
  authorizeIntegrationRequest,
  HEALTH_CONNECT_PROVIDER,
  healthConnectMetrics,
  type HealthConnectMetricCode,
} from "@/db/integrations";

const MAX_BODY_BYTES = 1_500_000;
const MAX_RECORDS = 500;
const MAX_DELETIONS = 500;

type NormalizedRecord = {
  externalId: string;
  code: HealthConnectMetricCode;
  label: string;
  value: number;
  unit: string;
  effectiveAt: string;
  recordedAt: string;
  contextJson: string;
};

export async function POST(request: Request) {
  const context = await authorizeIntegrationRequest(request, HEALTH_CONNECT_PROVIDER);
  if (!context) return jsonResponse({ error: "Conector no autorizado." }, { status: 401 });
  if (Number(request.headers.get("content-length") || 0) > MAX_BODY_BYTES) {
    return jsonResponse({ error: "El lote supera el límite permitido." }, { status: 413 });
  }
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return jsonResponse({ error: "El lote supera el límite permitido." }, { status: 413 });
  }
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "Lote inválido." }, { status: 400 });
  }
  const batchId = cleanText(payload.batchId, 120);
  if (!/^[A-Za-z0-9._:-]{8,120}$/.test(batchId)) {
    return jsonResponse({ error: "El lote no tiene un identificador válido." }, { status: 400 });
  }
  const inputRecords = Array.isArray(payload.records) ? payload.records : [];
  const inputDeletions = Array.isArray(payload.deletions) ? payload.deletions : [];
  if (inputRecords.length > MAX_RECORDS || inputDeletions.length > MAX_DELETIONS) {
    return jsonResponse({ error: "El lote contiene demasiados registros." }, { status: 413 });
  }
  if (!inputRecords.length && !inputDeletions.length) {
    return jsonResponse({ error: "El lote está vacío." }, { status: 400 });
  }

  const normalized: NormalizedRecord[] = [];
  for (let index = 0; index < inputRecords.length; index += 1) {
    const record = normalizeRecord(inputRecords[index], index);
    if (record instanceof Error) {
      await markInterrupted(context, "invalid_record", record.message);
      return jsonResponse({ error: record.message, index }, { status: 422 });
    }
    normalized.push(record);
  }
  const deletions = inputDeletions.map((item) => cleanText(item, 240)).filter(Boolean);
  if (deletions.length !== inputDeletions.length) {
    await markInterrupted(context, "invalid_deletion", "El lote contiene una baja sin identificador.");
    return jsonResponse({ error: "El lote contiene una baja inválida." }, { status: 422 });
  }

  const idempotencyKey = `health-connect:${context.connectionId}:${batchId}`;
  const existing = await env.DB.prepare(`SELECT id, status, entity_id FROM sync_events
    WHERE patient_id = ? AND idempotency_key = ?`)
    .bind(context.patientId, idempotencyKey).first<{ id: string; status: string; entity_id: string | null }>();
  if (existing?.status === "completed") {
    return jsonResponse({ ok: true, duplicate: true, accepted: 0, deleted: 0, result: existing.entity_id });
  }
  if (existing?.status === "processing") {
    return jsonResponse({ error: "Este lote ya se está procesando." }, { status: 409 });
  }

  const syncId = existing?.id || `syn_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const payloadHash = await sha256(rawBody);
  if (existing) {
    await env.DB.prepare(`UPDATE sync_events SET status = 'processing', payload_hash = ?, created_at = ?
      WHERE id = ? AND patient_id = ?`).bind(payloadHash, now, syncId, context.patientId).run();
  } else {
    await env.DB.prepare(`INSERT INTO sync_events
      (id, organization_id, patient_id, client_id, idempotency_key, entity_type,
      status, payload_hash, created_at)
      VALUES (?, ?, ?, ?, ?, 'connector_sync', 'processing', ?, ?)`)
      .bind(syncId, context.organizationId, context.patientId, context.connectionId,
        idempotencyKey, payloadHash, now).run();
  }

  try {
    for (let offset = 0; offset < normalized.length; offset += 50) {
      const statements = await Promise.all(normalized.slice(offset, offset + 50).map(async (record) => {
        const fingerprint = await sha256(`${context.patientId}:${HEALTH_CONNECT_PROVIDER}:${record.externalId}:${record.code}`);
        return env.DB.prepare(`INSERT INTO observations
          (id, organization_id, patient_id, code, value_numeric, unit, effective_at,
          recorded_at, context_json, source_type, source_id, status, verification_status,
          version, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'health_connect', ?, 'final',
          'device_recorded', 1, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            value_numeric = excluded.value_numeric,
            unit = excluded.unit,
            effective_at = excluded.effective_at,
            recorded_at = excluded.recorded_at,
            context_json = excluded.context_json,
            status = 'final',
            verification_status = 'device_recorded',
            version = observations.version + 1,
            deleted_at = NULL,
            updated_at = excluded.updated_at`)
          .bind(`obs_${fingerprint.slice(0, 30)}`, context.organizationId, context.patientId,
            record.code, record.value, record.unit, record.effectiveAt, record.recordedAt,
            record.contextJson, record.externalId, context.userId, now, now);
      }));
      await env.DB.batch(statements);
    }

    let deleted = 0;
    for (let offset = 0; offset < deletions.length; offset += 50) {
      const result = await env.DB.batch(deletions.slice(offset, offset + 50).map((externalId) =>
        env.DB.prepare(`UPDATE observations SET status = 'entered-in-error', deleted_at = ?, updated_at = ?
          WHERE patient_id = ? AND organization_id = ? AND source_type = 'health_connect'
            AND source_id = ? AND deleted_at IS NULL`)
          .bind(now, now, context.patientId, context.organizationId, externalId)));
      deleted += result.reduce((total, item) => total + Number(item.meta.changes || 0), 0);
    }

    const resultLabel = `accepted:${normalized.length};deleted:${deleted}`;
    await env.DB.batch([
      env.DB.prepare(`UPDATE sync_events SET status = 'completed', entity_id = ?
        WHERE id = ? AND patient_id = ?`).bind(resultLabel, syncId, context.patientId),
      env.DB.prepare(`UPDATE integration_connections SET status = 'active', last_seen_at = ?,
        last_sync_at = ?, last_success_at = ?, last_error_code = NULL,
        last_error_message = NULL, last_error_at = NULL, updated_at = ?
        WHERE id = ? AND patient_id = ? AND organization_id = ? AND revoked_at IS NULL`)
        .bind(now, now, now, now, context.connectionId, context.patientId, context.organizationId),
      env.DB.prepare(`INSERT INTO audit_logs
        (id, organization_id, patient_id, user_id, action, entity_type, entity_id,
        outcome, metadata_json, occurred_at)
        VALUES (?, ?, ?, ?, 'sync', 'device_observations', ?, 'success', ?, ?)`)
        .bind(`aud_${crypto.randomUUID()}`, context.organizationId, context.patientId,
          context.userId, syncId, JSON.stringify({ source: HEALTH_CONNECT_PROVIDER, count: normalized.length }), now),
    ]);
    return jsonResponse({ ok: true, duplicate: false, accepted: normalized.length, deleted, syncedAt: now });
  } catch {
    await env.DB.prepare(`UPDATE sync_events SET status = 'failed' WHERE id = ? AND patient_id = ?`)
      .bind(syncId, context.patientId).run().catch(() => undefined);
    await markInterrupted(context, "sync_failed", "No se pudo completar la actualización.");
    return jsonResponse({ error: "No pudimos guardar este lote. El puente podrá reintentarlo con el mismo identificador." }, { status: 503 });
  }
}

function normalizeRecord(value: unknown, index: number): NormalizedRecord | Error {
  if (!value || typeof value !== "object" || Array.isArray(value)) return new Error(`Registro ${index + 1}: formato inválido.`);
  const input = value as Record<string, unknown>;
  const externalId = cleanText(input.externalId, 240);
  const code = cleanText(input.code, 80) as HealthConnectMetricCode;
  const metric = healthConnectMetrics[code];
  const numeric = metric ? finiteNumber(input.value, metric.min, metric.max) : null;
  const effectiveAt = validIsoDateTime(input.effectiveAt);
  const recordedAt = validIsoDateTime(input.recordedAt) || new Date().toISOString();
  if (!externalId) return new Error(`Registro ${index + 1}: falta el identificador de origen.`);
  if (!metric) return new Error(`Registro ${index + 1}: métrica no admitida.`);
  if (numeric === null) return new Error(`Registro ${index + 1}: valor fuera del rango técnico admitido.`);
  if (!effectiveAt) return new Error(`Registro ${index + 1}: fecha inválida.`);
  const endAt = input.endAt ? validIsoDateTime(input.endAt) : null;
  if (input.endAt && !endAt) return new Error(`Registro ${index + 1}: fecha final inválida.`);
  return {
    externalId,
    code,
    label: metric.label,
    value: numeric,
    unit: metric.unit,
    effectiveAt,
    recordedAt,
    contextJson: JSON.stringify({
      label: metric.label,
      connector: "entheos-android-health-connect-v1",
      dataOrigin: cleanText(input.dataOrigin, 160) || null,
      device: cleanText(input.device, 160) || null,
      endAt,
      clientRecordVersion: finiteNumber(input.clientRecordVersion, 0, 1_000_000),
    }),
  };
}

async function markInterrupted(
  context: NonNullable<Awaited<ReturnType<typeof authorizeIntegrationRequest>>>,
  code: string,
  message: string,
) {
  const now = new Date().toISOString();
  await env.DB.prepare(`UPDATE integration_connections SET status = 'interrupted', last_seen_at = ?,
    last_error_code = ?, last_error_message = ?, last_error_at = ?, updated_at = ?
    WHERE id = ? AND patient_id = ? AND organization_id = ? AND revoked_at IS NULL`)
    .bind(now, cleanText(code, 80), cleanText(message, 240), now, now,
      context.connectionId, context.patientId, context.organizationId).run();
}
