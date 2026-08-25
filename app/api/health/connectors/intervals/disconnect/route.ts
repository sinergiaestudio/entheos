import { env } from "cloudflare:workers";
import {
  authorizeClinicalRequest,
  cleanText,
  jsonResponse,
  sameOrigin,
  unauthorizedResponse,
  writeAudit,
} from "@/db/clinical";
import { INTERVALS_PROVIDER, revokeIntervalsToken } from "@/db/intervals";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonResponse({ error: "Solicitud no permitida." }, { status: 403 });
  const context = await authorizeClinicalRequest(request, ["health.read"]);
  if (!context || context.authMode !== "platform") return unauthorizedResponse();
  const payload = await request.json().catch(() => ({})) as Record<string, unknown>;
  const connectionId = cleanText(payload.connectionId, 100);
  if (!connectionId) return jsonResponse({ error: "Conexión inválida." }, { status: 400 });
  const row = await env.DB.prepare(`SELECT id, config_json FROM integration_connections
    WHERE id = ? AND patient_id = ? AND organization_id = ? AND provider = ?
      AND revoked_at IS NULL`)
    .bind(connectionId, context.patientId, context.organizationId, INTERVALS_PROVIDER)
    .first<{ id: string; config_json: string }>();
  if (!row) return jsonResponse({ error: "Conexión no encontrada." }, { status: 404 });

  const remoteRevoked = await revokeIntervalsToken(row.config_json);
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(`UPDATE integration_connections SET status = 'revoked', revoked_at = ?,
      config_json = '{}', pairing_code_hash = NULL, updated_at = ?
      WHERE id = ? AND patient_id = ? AND organization_id = ?`)
      .bind(now, now, row.id, context.patientId, context.organizationId),
    env.DB.prepare(`UPDATE consent_records SET revoked_at = ?, updated_at = ?
      WHERE patient_id = ? AND organization_id = ? AND consent_type = ? AND revoked_at IS NULL`)
      .bind(now, now, context.patientId, context.organizationId, `integration:${row.id}`),
  ]);
  await writeAudit(context, "revoke", "integration_connection", row.id, {
    source: INTERVALS_PROVIDER,
    status: remoteRevoked ? "revoked" : "revoked_locally",
  });
  return jsonResponse({ ok: true, remoteRevoked });
}
