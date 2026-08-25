import { env } from "cloudflare:workers";
import {
  authorizeClinicalRequest,
  sha256,
  unauthorizedResponse,
  writeAudit,
} from "@/db/clinical";
import {
  INTERVALS_PROVIDER,
  INTERVALS_SCOPES,
  intervalsAuthorizationUrl,
  intervalsConfigurationStatus,
} from "@/db/intervals";
import { randomUrlToken } from "@/db/integrations";

const STATE_LIFETIME_MS = 10 * 60 * 1000;

export async function GET(request: Request) {
  const context = await authorizeClinicalRequest(request, ["health.read"]);
  if (!context || context.authMode !== "platform") return unauthorizedResponse();
  const origin = new URL(request.url).origin;
  if (!(await intervalsConfigurationStatus()).ready) {
    return Response.redirect(new URL("/app?integration=intervals&result=registration-required", origin), 302);
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const expiresAt = new Date(now.getTime() + STATE_LIFETIME_MS).toISOString();
  const state = randomUrlToken(32);
  const stateHash = await sha256(state);
  const id = `int_${crypto.randomUUID()}`;
  const callbackUrl = `${origin}/api/health/connectors/intervals/callback`;

  await env.DB.batch([
    env.DB.prepare(`UPDATE integration_connections SET status = 'revoked', revoked_at = ?,
      pairing_code_hash = NULL, updated_at = ?
      WHERE patient_id = ? AND organization_id = ? AND provider = ?
        AND status = 'pending_pairing' AND revoked_at IS NULL`)
      .bind(nowIso, nowIso, context.patientId, context.organizationId, INTERVALS_PROVIDER),
    env.DB.prepare(`INSERT INTO integration_connections
      (id, organization_id, patient_id, user_id, provider, display_name, status,
      pairing_code_hash, pairing_expires_at, capabilities_json, config_json,
      created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'Intervals.icu', 'pending_pairing', ?, ?, ?, '{}', ?, ?)`)
      .bind(id, context.organizationId, context.patientId, context.userId,
        INTERVALS_PROVIDER, stateHash, expiresAt, JSON.stringify(INTERVALS_SCOPES),
        nowIso, nowIso),
  ]);
  await writeAudit(context, "oauth_started", "integration_connection", id, {
    source: INTERVALS_PROVIDER,
    status: "pending_pairing",
  });

  return Response.redirect(await intervalsAuthorizationUrl(callbackUrl, state), 302);
}
