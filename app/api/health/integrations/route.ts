import { env } from "cloudflare:workers";
import {
  authorizeClinicalRequest,
  cleanText,
  jsonResponse,
  sameOrigin,
  sha256,
  unauthorizedResponse,
  writeAudit,
} from "@/db/clinical";
import {
  formatPairingCode,
  integrationPublicRow,
  randomPairingCode,
} from "@/db/integrations";
import {
  INTERVALS_PROVIDER,
  intervalsConfigurationStatus,
} from "@/db/intervals";

const LEGACY_HEALTH_CONNECT_PROVIDER = "health_connect";
const PAIRING_LIFETIME_MS = 10 * 60 * 1000;

type ConnectionRow = Record<string, unknown>;

export async function GET(request: Request) {
  const context = await authorizeClinicalRequest(request, ["health.read"]);
  if (!context || context.authMode !== "platform") return unauthorizedResponse();
  const [connections, sources, intervalsConfiguration] = await Promise.all([
    env.DB.prepare(`SELECT id, provider, display_name, status, device_label, device_model,
      capabilities_json, paired_at, pairing_expires_at, last_seen_at, last_sync_at,
      last_success_at, last_error_code, last_error_message, last_error_at, created_at, updated_at
      FROM integration_connections
      WHERE patient_id = ? AND organization_id = ? AND revoked_at IS NULL
        AND provider <> 'health_connect'
      ORDER BY created_at DESC LIMIT 30`)
      .bind(context.patientId, context.organizationId).all<ConnectionRow>(),
    env.DB.prepare(`SELECT source_type, SUM(count) AS count, MAX(latest) AS latest FROM (
        SELECT source_type, COUNT(*) AS count, MAX(effective_at) AS latest
        FROM observations WHERE patient_id = ? AND organization_id = ? AND deleted_at IS NULL
        GROUP BY source_type
        UNION ALL
        SELECT source_type, COUNT(*) AS count, MAX(effective_at) AS latest
        FROM activity_sessions WHERE patient_id = ? AND organization_id = ? AND deleted_at IS NULL
        GROUP BY source_type
      ) GROUP BY source_type`)
      .bind(context.patientId, context.organizationId,
        context.patientId, context.organizationId).all<Record<string, unknown>>(),
    intervalsConfigurationStatus(),
  ]);
  return jsonResponse({
    connections: connections.results.map(integrationPublicRow),
    sources: sources.results.map((row) => ({
      source: cleanText(row.source_type, 60),
      count: Number(row.count || 0),
      latest: cleanText(row.latest, 40) || null,
    })),
    providers: [{
      id: INTERVALS_PROVIDER,
      name: "Intervals.icu",
      status: intervalsConfiguration.ready ? "available" : "registration_required",
      transport: "oauth2",
      capabilities: ["Actividades", "Pasos", "Sueño", "Frecuencia cardíaca en reposo"],
    }],
  });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonResponse({ error: "Solicitud no permitida." }, { status: 403 });
  const context = await authorizeClinicalRequest(request, ["health.read"]);
  if (!context || context.authMode !== "platform") return unauthorizedResponse();
  let payload: Record<string, unknown>;
  try {
    payload = await request.json() as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "Solicitud inválida." }, { status: 400 });
  }
  const action = cleanText(payload.action, 40);
  if (action === "pair") return createPairing(request, context);
  if (action === "disconnect") return disconnect(context, cleanText(payload.connectionId, 100));
  if (action === "new_code") return createPairing(request, context);
  return jsonResponse({ error: "Acción de integración no reconocida." }, { status: 400 });
}

async function createPairing(
  request: Request,
  context: NonNullable<Awaited<ReturnType<typeof authorizeClinicalRequest>>>,
) {
  const now = new Date();
  const nowIso = now.toISOString();
  const expiresAt = new Date(now.getTime() + PAIRING_LIFETIME_MS).toISOString();
  const code = randomPairingCode();
  const codeHash = await sha256(code);
  const id = `int_${crypto.randomUUID()}`;
  await env.DB.batch([
    env.DB.prepare(`UPDATE integration_connections SET status = 'revoked', revoked_at = ?,
      pairing_code_hash = NULL, connector_token_hash = NULL, updated_at = ?
      WHERE patient_id = ? AND organization_id = ? AND provider = ?
        AND status IN ('pending_pairing', 'pending_permissions') AND revoked_at IS NULL`)
      .bind(nowIso, nowIso, context.patientId, context.organizationId, LEGACY_HEALTH_CONNECT_PROVIDER),
    env.DB.prepare(`INSERT INTO integration_connections
      (id, organization_id, patient_id, user_id, provider, display_name, status,
      pairing_code_hash, pairing_expires_at, capabilities_json, config_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'Health Connect', 'pending_pairing', ?, ?, ?, '{}', ?, ?)`)
      .bind(id, context.organizationId, context.patientId, context.userId, LEGACY_HEALTH_CONNECT_PROVIDER,
        codeHash, expiresAt, JSON.stringify([]), nowIso, nowIso),
  ]);
  await writeAudit(context, "pairing_created", "integration_connection", id, { source: LEGACY_HEALTH_CONNECT_PROVIDER, status: "pending_pairing" });
  const origin = new URL(request.url).origin;
  const formattedCode = formatPairingCode(code);
  return jsonResponse({
    connection: integrationPublicRow({
      id, provider: LEGACY_HEALTH_CONNECT_PROVIDER, display_name: "Health Connect", status: "pending_pairing",
      capabilities_json: JSON.stringify([]), pairing_expires_at: expiresAt,
      created_at: nowIso, updated_at: nowIso,
    }),
    pairing: {
      code: formattedCode,
      expiresAt,
      deepLink: `entheos://pair?code=${encodeURIComponent(formattedCode)}&server=${encodeURIComponent(origin)}`,
      launchUrl: `${origin}/connect/health-connect?code=${encodeURIComponent(formattedCode)}`,
    },
  }, { status: 201 });
}

async function disconnect(
  context: NonNullable<Awaited<ReturnType<typeof authorizeClinicalRequest>>>,
  connectionId: string,
) {
  if (!connectionId) return jsonResponse({ error: "Conexión inválida." }, { status: 400 });
  const now = new Date().toISOString();
  const result = await env.DB.prepare(`UPDATE integration_connections
    SET status = 'revoked', revoked_at = ?, pairing_code_hash = NULL,
      connector_token_hash = NULL, updated_at = ?
    WHERE id = ? AND patient_id = ? AND organization_id = ? AND revoked_at IS NULL`)
    .bind(now, now, connectionId, context.patientId, context.organizationId).run();
  if (!result.meta.changes) return jsonResponse({ error: "Conexión no encontrada." }, { status: 404 });
  await env.DB.prepare(`UPDATE consent_records SET revoked_at = ?, updated_at = ?
    WHERE patient_id = ? AND organization_id = ? AND consent_type = ? AND revoked_at IS NULL`)
    .bind(now, now, context.patientId, context.organizationId, `integration:${connectionId}`).run();
  await writeAudit(context, "revoke", "integration_connection", connectionId, { source: LEGACY_HEALTH_CONNECT_PROVIDER, status: "revoked" });
  return jsonResponse({ ok: true });
}
