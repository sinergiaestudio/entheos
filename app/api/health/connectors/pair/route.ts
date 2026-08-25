import { env } from "cloudflare:workers";
import { cleanText, jsonResponse, sameOrigin, sha256 } from "@/db/clinical";
import {
  HEALTH_CONNECT_PROVIDER,
  healthConnectMetrics,
  normalizePairingCode,
  randomUrlToken,
} from "@/db/integrations";

type PairingRow = {
  id: string;
  organization_id: string;
  patient_id: string;
  user_id: string;
  pairing_expires_at: string;
  display_name: string;
};

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonResponse({ error: "Solicitud no permitida." }, { status: 403 });
  if (Number(request.headers.get("content-length") || 0) > 16_384) {
    return jsonResponse({ error: "Solicitud demasiado grande." }, { status: 413 });
  }
  let payload: Record<string, unknown>;
  try {
    payload = await request.json() as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "Código de vinculación inválido." }, { status: 400 });
  }
  const code = normalizePairingCode(payload.code);
  if (code.length !== 8) return jsonResponse({ error: "Código de vinculación inválido o vencido." }, { status: 400 });
  const codeHash = await sha256(code);
  const row = await env.DB.prepare(`SELECT c.id, c.organization_id, c.patient_id, c.user_id,
    c.pairing_expires_at, u.display_name
    FROM integration_connections c
    JOIN users u ON u.id = c.user_id
    WHERE c.pairing_code_hash = ? AND c.provider = ? AND c.status = 'pending_pairing'
      AND c.revoked_at IS NULL AND u.status = 'active'`)
    .bind(codeHash, HEALTH_CONNECT_PROVIDER).first<PairingRow>();
  if (!row || Date.parse(row.pairing_expires_at) <= Date.now()) {
    return jsonResponse({ error: "Código de vinculación inválido o vencido." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const tokenExpiresAt = new Date(Date.now() + 365 * 86400000).toISOString();
  const rawToken = `ent_hc_${randomUrlToken(36)}`;
  const tokenHash = await sha256(rawToken);
  const deviceLabel = cleanText(payload.deviceLabel, 120) || "Teléfono Android";
  const deviceModel = cleanText(payload.deviceModel, 120) || null;
  const appVersion = cleanText(payload.appVersion, 40) || "unknown";
  const update = await env.DB.prepare(`UPDATE integration_connections SET
    status = 'pending_permissions', pairing_code_hash = NULL, pairing_expires_at = NULL,
    connector_token_hash = ?, token_expires_at = ?, device_label = ?, device_model = ?,
    paired_at = ?, last_seen_at = ?, config_json = ?, updated_at = ?
    WHERE id = ? AND pairing_code_hash = ? AND status = 'pending_pairing' AND revoked_at IS NULL`)
    .bind(tokenHash, tokenExpiresAt, deviceLabel, deviceModel, now, now,
      JSON.stringify({ bridgeVersion: appVersion, syncContract: 1 }), now, row.id, codeHash).run();
  if (!update.meta.changes) return jsonResponse({ error: "El código ya fue utilizado." }, { status: 409 });

  await env.DB.batch([
    env.DB.prepare(`INSERT INTO consent_records
      (id, organization_id, patient_id, consent_type, scope_json, granted_at, expires_at,
      created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(`con_${crypto.randomUUID()}`, row.organization_id, row.patient_id,
        `integration:${row.id}`, JSON.stringify({ provider: HEALTH_CONNECT_PROVIDER, permissions: "requested_on_device" }),
        now, tokenExpiresAt, row.user_id, now, now),
    env.DB.prepare(`INSERT INTO audit_logs
      (id, organization_id, patient_id, user_id, action, entity_type, entity_id,
      outcome, metadata_json, occurred_at)
      VALUES (?, ?, ?, ?, 'paired', 'integration_connection', ?, 'success', ?, ?)`)
      .bind(`aud_${crypto.randomUUID()}`, row.organization_id, row.patient_id, row.user_id,
        row.id, JSON.stringify({ source: HEALTH_CONNECT_PROVIDER, status: "pending_permissions" }), now),
  ]);

  return jsonResponse({
    ok: true,
    token: rawToken,
    connectionId: row.id,
    provider: HEALTH_CONNECT_PROVIDER,
    accountDisplayName: cleanText(row.display_name, 120),
    tokenExpiresAt,
    status: "pending_permissions",
    endpoints: {
      sync: "/api/health/connectors/health-connect/sync",
      status: "/api/health/connectors/health-connect/status",
    },
    supportedMetrics: Object.keys(healthConnectMetrics),
  }, { status: 201 });
}
