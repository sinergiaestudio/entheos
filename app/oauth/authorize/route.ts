import { authorizeClinicalRequest, cleanText, jsonResponse } from "@/db/clinical";
import { issueAuthorizationCode, requestedScopes, validateOAuthClient } from "@/db/oauth";

export async function GET(request: Request) {
  const context = await authorizeClinicalRequest(request, []);
  if (!context) return Response.redirect(new URL(`/signin-with-chatgpt?return_to=${encodeURIComponent(new URL(request.url).pathname + new URL(request.url).search)}`, request.url), 302);
  const url = new URL(request.url);
  const client = await validateOAuthClient(url.searchParams.get("client_id"), url.searchParams.get("redirect_uri"));
  const challenge = cleanText(url.searchParams.get("code_challenge"), 200);
  if (!client || url.searchParams.get("response_type") !== "code" || url.searchParams.get("code_challenge_method") !== "S256" || !challenge) return jsonResponse({ error: "invalid_request" }, { status: 400 });
  const scopes = requestedScopes(url.searchParams.get("scope"));
  const fields = ["client_id", "redirect_uri", "state", "scope", "code_challenge", "code_challenge_method"].map((key) => `<input type="hidden" name="${key}" value="${escapeHtml(url.searchParams.get(key) || "")}">`).join("");
  const permissions = permissionLabels(scopes).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const canWrite = scopes.some((scope) => scope.endsWith(".write"));
  const warning = canWrite
    ? "Sólo se guardarán datos o archivos cuando lo pidas explícitamente en una conversación. La frase Enviar a Entheos y sus equivalentes se consideran tu aprobación para esa carga concreta."
    : "La conexión sólo podrá consultar los datos autorizados.";
  return new Response(`<!doctype html><html lang="es"><meta name="viewport" content="width=device-width"><title>Conectar Entheos</title><style>body{font:16px system-ui;background:#f4f7f4;color:#18352b;display:grid;place-items:center;min-height:100vh;margin:0}.card{background:white;padding:32px;border-radius:24px;max-width:520px;box-shadow:0 16px 50px #173d2920}button{width:100%;padding:14px;border:0;border-radius:12px;background:#287a5b;color:white;font-weight:700}small{color:#61736b}ul{padding-left:22px;line-height:1.55}.notice{background:#eef6f1;border:1px solid #bed8c9;padding:14px;border-radius:14px}</style><main class="card"><h1>Conectar Entheos con ChatGPT</h1><p><strong>${escapeHtml(client.name)}</strong> solicita estos permisos:</p><ul>${permissions}</ul><p class="notice"><small>${escapeHtml(warning)}</small></p><form method="post">${fields}<button type="submit">Autorizar conexión</button></form></main></html>`, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'" } });
}

export async function POST(request: Request) {
  const context = await authorizeClinicalRequest(request, []);
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

function permissionLabels(scopes: string[]) {
  const labels: Record<string, string> = {
    "health.read": "Consultar tu resumen e historia clínica.",
    "documents.read": "Consultar el catálogo de documentos y estudios.",
    "documents.write": "Guardar archivos originales que adjuntes y apruebes.",
    "observations.write": "Guardar mediciones, antecedentes, tratamientos y eventos que apruebes.",
    "profile.write": "Actualizar datos de tu ficha clínica cuando lo solicites.",
  };
  return scopes.map((scope) => labels[scope] || scope);
}

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] || char); }
