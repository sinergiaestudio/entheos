import { env } from "cloudflare:workers";
import { cleanText, jsonResponse } from "@/db/clinical";
import {
  authorizeIntegrationRequest,
  HEALTH_CONNECT_PROVIDER,
  healthConnectMetrics,
} from "@/db/integrations";

export async function POST(request: Request) {
  const context = await authorizeIntegrationRequest(request, HEALTH_CONNECT_PROVIDER);
  if (!context) return jsonResponse({ error: "Conector no autorizado." }, { status: 401 });
  if (Number(request.headers.get("content-length") || 0) > 32_768) {
    return jsonResponse({ error: "Solicitud demasiado grande." }, { status: 413 });
  }
  let payload: Record<string, unknown>;
  try {
    payload = await request.json() as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "Estado inválido." }, { status: 400 });
  }
  const requestedStatus = cleanText(payload.status, 40);
  const status = requestedStatus === "active" || requestedStatus === "degraded" || requestedStatus === "interrupted" || requestedStatus === "pending_permissions"
    ? requestedStatus
    : null;
  if (!status) return jsonResponse({ error: "Estado inválido." }, { status: 400 });
  const supported = new Set(Object.keys(healthConnectMetrics));
  const capabilities = Array.isArray(payload.capabilities)
    ? payload.capabilities.map((item) => cleanText(item, 80)).filter((item) => supported.has(item)).slice(0, supported.size)
    : [];
  const effectiveCapabilities = status === "interrupted" && capabilities.length === 0
    ? context.capabilities.filter((item) => supported.has(item))
    : capabilities;
  const hasErrorDetail = status === "interrupted" || status === "degraded";
  const errorCode = hasErrorDetail ? cleanText(payload.errorCode, 80) || "bridge_error" : null;
  const errorMessage = hasErrorDetail ? cleanText(payload.errorMessage, 240) || "La conexión informó una interrupción." : null;
  const now = new Date().toISOString();
  await env.DB.prepare(`UPDATE integration_connections SET status = ?, capabilities_json = ?,
    last_seen_at = ?, last_error_code = ?, last_error_message = ?, last_error_at = ?, updated_at = ?
    WHERE id = ? AND patient_id = ? AND organization_id = ? AND revoked_at IS NULL`)
    .bind(status, JSON.stringify(effectiveCapabilities), now, errorCode, errorMessage,
      hasErrorDetail ? now : null, now,
      context.connectionId, context.patientId, context.organizationId).run();
  if (status === "active" || status === "degraded") {
    await env.DB.batch([
      env.DB.prepare(`UPDATE integration_connections SET last_sync_at = ?, last_success_at = ?
        WHERE id = ? AND patient_id = ? AND organization_id = ? AND revoked_at IS NULL`)
        .bind(now, now, context.connectionId, context.patientId, context.organizationId),
      env.DB.prepare(`UPDATE consent_records SET scope_json = ?, updated_at = ?
        WHERE patient_id = ? AND organization_id = ? AND consent_type = ? AND revoked_at IS NULL`)
        .bind(JSON.stringify({ provider: HEALTH_CONNECT_PROVIDER, permissions: effectiveCapabilities }), now,
          context.patientId, context.organizationId, `integration:${context.connectionId}`),
    ]);
  }
  return jsonResponse({ ok: true, status, lastSeenAt: now, capabilities: effectiveCapabilities });
}
