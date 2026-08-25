import { env } from "cloudflare:workers";
import {
  authorizeClinicalRequest,
  cleanText,
  jsonResponse,
  sameOrigin,
  unauthorizedResponse,
} from "@/db/clinical";
import {
  INTERVALS_PROVIDER,
  IntervalsIntegrationError,
  syncIntervalsConnection,
} from "@/db/intervals";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonResponse({ error: "Solicitud no permitida." }, { status: 403 });
  const context = await authorizeClinicalRequest(request, ["health.read"]);
  if (!context || context.authMode !== "platform") return unauthorizedResponse();
  const payload = await request.json().catch(() => ({})) as Record<string, unknown>;
  const requestedId = cleanText(payload.connectionId, 100);
  const connection = await env.DB.prepare(`SELECT id FROM integration_connections
    WHERE patient_id = ? AND organization_id = ? AND provider = ? AND revoked_at IS NULL
      AND status IN ('active', 'degraded', 'interrupted')
      AND (? = '' OR id = ?)
    ORDER BY paired_at DESC LIMIT 1`)
    .bind(context.patientId, context.organizationId, INTERVALS_PROVIDER, requestedId, requestedId)
    .first<{ id: string }>();
  if (!connection) return jsonResponse({ error: "Primero vinculá tu cuenta de Intervals.icu." }, { status: 404 });
  try {
    const result = await syncIntervalsConnection(context, connection.id, {
      oldest: cleanText(payload.oldest, 10) || null,
      newest: cleanText(payload.newest, 10) || null,
    });
    return jsonResponse({ ok: true, result });
  } catch (caught) {
    const error = caught instanceof IntervalsIntegrationError
      ? caught
      : new IntervalsIntegrationError("No pudimos actualizar Intervals.icu.");
    return jsonResponse({ error: error.message, code: error.code }, { status: error.status });
  }
}
