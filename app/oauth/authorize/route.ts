import { authorizeClinicalRequest, cleanText, jsonResponse } from "@/db/clinical";
import { issueAuthorizationCode, requestedScopes, validateOAuthClient } from "@/db/oauth";

export async function GET(request: Request) {
  const context = await authorizeClinicalRequest(request, ["health.read"]);
  if (!context) return Response.redirect(new URL(`/signin-with-chatgpt?return_to=${encodeURIComponent(new URL(request.url).pathname + new URL(request.url).search)}`, request.url), 302);
  const url = new URL(request.url);
  const client = await validateOAuthClient(url.searchParams.get("client_id"), url.searchParams.get("redirect_uri"));
  const challenge = cleanText(url.searchParams.get("code_challenge"), 200);
  if (!client || url.searchParams.get("response_type") !== "code" || url.searchParams.get("code_challenge_method") !== "S256" || !challenge) return jsonResponse({ error: "invalid_request" }, { status: 400 });
  const fields = ["client_id", "redirect_uri", "state", "scope", "code_challenge", "code_challenge_method"].map((key) => `<input type="hidden" name="${key}" value="${escapeHtml(url.searchParams.get(key) || "")}">`).join("");
  return new Response(`<!doctype html><html lang="es"><meta name="viewport" content="width=device-width"><title>Conectar Entheos</title><style>body{font:16px system-ui;background:#f4f7f4;color:#18352b;display:grid;place-items:center;min-height:100vh;margin:0}.card{background:white;padding:32px;border-radius:24px;max-width:480px;box-shadow:0 16px 50px #173d2920}button{width:100%;padding:14px;border:0;border-radius:12px;background:#287a5b;color:white;font-weight:700}small{color:#61736b}</style><main class="card"><h1>Conectar Entheos con ChatGPT</h1><p><strong>${escapeHtml(client.name)}</strong> podrá consultar tu historia, documentos y estudios en modo de solo lectura.</p><p><small>No podrá modificar ni borrar datos.</small></p><form method="post">${fields}<button type="submit">Autorizar conexión</button></form></main></html>`, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'" } });
}

export async function POST(request: Request) {
  const context = await authorizeClinicalRequest(request, ["health.read"]);
  if (!context) return jsonResponse({ error: "access_denied" }, { status: 401 });
  const form = await request.formData();
  const client = await validateOAuthClient(form.get("client_id"), form.get("redirect_uri"));
  const challenge = cleanText(form.get("code_challenge"), 200);
  if (!client || form.get("code_challenge_method") !== "S256" || !challenge) return jsonResponse({ error: "invalid_request" }, { status: 400 });
  const code = await issueAuthorizationCode(context, client.id, client.redirectUri, challenge, requestedScopes(form.get("scope")));
  const redirect = new URL(client.redirectUri);
  redirect.searchParams.set("code", code);
  const state = cleanText(form.get("state"), 400);
  if (state) redirect.searchParams.set("state", state);
  return Response.redirect(redirect, 303);
}

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] || char); }
