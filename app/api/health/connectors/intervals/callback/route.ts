import { env } from "cloudflare:workers";
import {
  authorizeClinicalRequest,
  cleanText,
  sha256,
  unauthorizedResponse,
  writeAudit,
} from "@/db/clinical";
import {
  INTERVALS_PROVIDER,
  INTERVALS_SCOPES,
  IntervalsIntegrationError,
  encodeIntervalsConfig,
  exchangeIntervalsCode,
  intervalsConfigurationStatus,
  syncIntervalsConnection,
} from "@/db/intervals";

type PendingRow = {
  id: string;
  pairing_expires_at: string | null;
};

export async function GET(request: Request) {
  const context = await authorizeClinicalRequest(request, ["health.read"]);
  if (!context || context.authMode !== "platform") return unauthorizedResponse();
  const url = new URL(request.url);
  const resultUrl = new URL("/app", url.origin);
  resultUrl.searchParams.set("integration", "intervals");
  const error = cleanText(url.searchParams.get("error"), 80);
  if (error) {
    resultUrl.searchParams.set("result", error === "access_denied" ? "cancelled" : "failed");
    return Response.redirect(resultUrl, 302);
  }
  if (!(await intervalsConfigurationStatus()).ready) {
    resultUrl.searchParams.set("result", "registration-required");
    return Response.redirect(resultUrl, 302);
  }

  const state = cleanText(url.searchParams.get("state"), 180);
  const code = cleanText(url.searchParams.get("code"), 180);
  if (!state || !code) {
    resultUrl.searchParams.set("result", "invalid-callback");
    return Response.redirect(resultUrl, 302);
  }
  const stateHash = await sha256(state);
  const pending = await env.DB.prepare(`SELECT id, pairing_expires_at
    FROM integration_connections
    WHERE patient_id = ? AND organization_id = ? AND provider = ?
      AND pairing_code_hash = ? AND status = 'pending_pairing' AND revoked_at IS NULL`)
    .bind(context.patientId, context.organizationId, INTERVALS_PROVIDER, stateHash)
    .first<PendingRow>();
  if (!pending || !pending.pairing_expires_at || Date.parse(pending.pairing_expires_at) <= Date.now()) {
    resultUrl.searchParams.set("result", "expired");
    return Response.redirect(resultUrl, 302);
  }

  const now = new Date().toISOString();
  try {
    const oauth = await exchangeIntervalsCode(code);
    const configJson = await encodeIntervalsConfig(oauth);
    await env.DB.batch([
      env.DB.prepare(`UPDATE integration_connections SET status = 'revoked', revoked_at = ?,
        config_json = '{}', pairing_code_hash = NULL, updated_at = ?
        WHERE patient_id = ? AND organization_id = ? AND provider = ? AND id <> ?
          AND revoked_at IS NULL AND status IN ('active', 'degraded', 'interrupted')`)
        .bind(now, now, context.patientId, context.organizationId, INTERVALS_PROVIDER, pending.id),
      env.DB.prepare(`UPDATE integration_connections SET display_name = ?, status = 'active',
        pairing_code_hash = NULL, pairing_expires_at = NULL, capabilities_json = ?,
        config_json = ?, device_label = ?, paired_at = ?, last_seen_at = ?,
        last_error_code = NULL, last_error_message = NULL, last_error_at = NULL, updated_at = ?
        WHERE id = ? AND patient_id = ? AND organization_id = ? AND revoked_at IS NULL`)
        .bind(`Intervals.icu · ${oauth.athleteName}`, JSON.stringify(oauth.scopes),
          configJson, oauth.athleteName, now, now, now, pending.id,
          context.patientId, context.organizationId),
      env.DB.prepare(`INSERT INTO consent_records
        (id, organization_id, patient_id, consent_type, scope_json, granted_at,
        created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(`con_${crypto.randomUUID()}`, context.organizationId, context.patientId,
          `integration:${pending.id}`, JSON.stringify(oauth.scopes.length ? oauth.scopes : INTERVALS_SCOPES),
          now, context.userId, now, now),
    ]);
    await writeAudit(context, "oauth_connected", "integration_connection", pending.id, {
      source: INTERVALS_PROVIDER,
      status: "active",
    });

    try {
      const sync = await syncIntervalsConnection(context, pending.id);
      resultUrl.searchParams.set("result", sync.status === "active" ? "connected" : "connected-partial");
    } catch {
      resultUrl.searchParams.set("result", "connected-sync-pending");
    }
    return Response.redirect(resultUrl, 302);
  } catch (caught) {
    const integrationError = caught instanceof IntervalsIntegrationError ? caught : null;
    await env.DB.prepare(`UPDATE integration_connections SET status = 'interrupted',
      pairing_code_hash = NULL, last_error_code = ?, last_error_message = ?,
      last_error_at = ?, updated_at = ?
      WHERE id = ? AND patient_id = ? AND organization_id = ?`)
      .bind(integrationError?.code || "oauth_failed",
        integrationError?.message || "No se pudo completar la autorización.", now, now,
        pending.id, context.patientId, context.organizationId).run();
    resultUrl.searchParams.set("result", "failed");
    return Response.redirect(resultUrl, 302);
  }
}
