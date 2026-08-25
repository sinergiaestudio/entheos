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

export async function GET(request: Request) {
  const context = await authorizeClinicalRequest(request, ["health.read"]);
  if (!context || context.authMode !== "platform") return unauthorizedResponse();
  const rows = await env.DB.prepare(`SELECT id, label, scopes_json, expires_at, last_used_at,
    revoked_at, created_at FROM api_tokens WHERE patient_id = ? AND organization_id = ?
    ORDER BY created_at DESC LIMIT 30`).bind(context.patientId, context.organizationId).all();
  return jsonResponse({ tokens: rows.results.map((row) => ({
    ...row,
    scopes: JSON.parse(String(row.scopes_json || "[]")),
    scopes_json: undefined,
  })) });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonResponse({ error: "Solicitud no permitida." }, { status: 403 });
  const context = await authorizeClinicalRequest(request, ["health.read"]);
  if (!context || context.authMode !== "platform") return unauthorizedResponse();
  const payload = await request.json() as Record<string, unknown>;
  const label = cleanText(payload.label, 80) || "Lectura personal";
  const rawToken = `msh_${randomToken(32)}`;
  const id = `tok_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
  const scopes = ["health.read", "documents.read"];
  await env.DB.prepare(`INSERT INTO api_tokens
    (id, organization_id, patient_id, user_id, label, token_hash, scopes_json, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, context.organizationId, context.patientId, context.userId, label,
      await sha256(rawToken), JSON.stringify(scopes), expiresAt, now).run();
  await writeAudit(context, "create", "api_token", id, { source: "patient" });
  return jsonResponse({ token: rawToken, tokenInfo: { id, label, scopes, expiresAt } }, { status: 201 });
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return jsonResponse({ error: "Solicitud no permitida." }, { status: 403 });
  const context = await authorizeClinicalRequest(request, ["health.read"]);
  if (!context || context.authMode !== "platform") return unauthorizedResponse();
  const id = cleanText(new URL(request.url).searchParams.get("id"), 100);
  if (!id) return jsonResponse({ error: "Token inválido." }, { status: 400 });
  await env.DB.prepare(`UPDATE api_tokens SET revoked_at = ?
    WHERE id = ? AND patient_id = ? AND organization_id = ?`)
    .bind(new Date().toISOString(), id, context.patientId, context.organizationId).run();
  await writeAudit(context, "revoke", "api_token", id, { source: "patient" });
  return jsonResponse({ ok: true });
}

function randomToken(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
