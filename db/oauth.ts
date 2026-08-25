import { env } from "cloudflare:workers";
import { cleanText, parseStringArray, sha256, type ClinicalContext } from "./clinical";

const allowedScopes = new Set(["health.read", "documents.read"]);

function database() {
  if (!env.DB) throw new Error("OAuth database unavailable");
  return env.DB;
}

export function requestedScopes(value: unknown) {
  const scopes = cleanText(value, 200).split(/\s+/).filter((scope) => allowedScopes.has(scope));
  return scopes.length ? [...new Set(scopes)] : ["health.read", "documents.read"];
}

export function validRedirectUri(value: unknown) {
  try {
    const url = new URL(cleanText(value, 600));
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLocaleLowerCase("en-US");
    if (!(host === "chatgpt.com" || host.endsWith(".chatgpt.com") || host === "openai.com" || host.endsWith(".openai.com"))) return null;
    url.hash = "";
    return url.toString();
  } catch { return null; }
}

export async function registerOAuthClient(nameValue: unknown, redirectValues: unknown) {
  const name = cleanText(nameValue, 120) || "ChatGPT";
  const redirects = Array.isArray(redirectValues) ? redirectValues.map(validRedirectUri).filter((uri): uri is string => Boolean(uri)).slice(0, 10) : [];
  if (!redirects.length) throw new Error("invalid_redirect_uris");
  const id = `client_${crypto.randomUUID()}`;
  await database().prepare("INSERT INTO oauth_clients (id, client_name, redirect_uris_json, created_at) VALUES (?, ?, ?, ?)")
    .bind(id, name, JSON.stringify(redirects), new Date().toISOString()).run();
  return { client_id: id, client_name: name, redirect_uris: redirects, token_endpoint_auth_method: "none" };
}

export async function validateOAuthClient(clientIdValue: unknown, redirectValue: unknown) {
  const clientId = cleanText(clientIdValue, 120);
  const redirectUri = validRedirectUri(redirectValue);
  if (!clientId || !redirectUri) return null;
  const row = await database().prepare("SELECT id, client_name, redirect_uris_json FROM oauth_clients WHERE id = ?")
    .bind(clientId).first<{ id: string; client_name: string; redirect_uris_json: string }>();
  if (!row || !parseStringArray(row.redirect_uris_json).includes(redirectUri)) return null;
  return { id: row.id, name: row.client_name, redirectUri };
}

export async function issueAuthorizationCode(context: ClinicalContext, clientId: string, redirectUri: string, codeChallenge: string, scopes: string[]) {
  const code = randomToken();
  await database().prepare(`INSERT INTO oauth_authorization_codes
    (code_hash, client_id, user_id, organization_id, patient_id, redirect_uri, code_challenge, scopes_json, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(await sha256(code), clientId, context.userId, context.organizationId, context.patientId, redirectUri, codeChallenge, JSON.stringify(scopes), new Date(Date.now() + 5 * 60_000).toISOString(), new Date().toISOString()).run();
  return code;
}

export async function exchangeAuthorizationCode(codeValue: unknown, clientIdValue: unknown, redirectValue: unknown, verifierValue: unknown) {
  const codeHash = await sha256(cleanText(codeValue, 300));
  const clientId = cleanText(clientIdValue, 120);
  const redirectUri = validRedirectUri(redirectValue);
  const verifier = cleanText(verifierValue, 200);
  const row = await database().prepare(`SELECT code_hash, client_id, user_id, organization_id, patient_id,
    redirect_uri, code_challenge, scopes_json, expires_at, used_at FROM oauth_authorization_codes WHERE code_hash = ?`)
    .bind(codeHash).first<Record<string, string | null>>();
  if (!row || row.client_id !== clientId || row.redirect_uri !== redirectUri || row.used_at || Date.parse(String(row.expires_at)) <= Date.now()) return null;
  if (!verifier || base64Url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))) !== row.code_challenge) return null;
  const used = await database().prepare("UPDATE oauth_authorization_codes SET used_at = ? WHERE code_hash = ? AND used_at IS NULL")
    .bind(new Date().toISOString(), codeHash).run();
  if (!used.meta.changes) return null;
  return issueTokens(row, clientId);
}

export async function exchangeRefreshToken(tokenValue: unknown, clientIdValue: unknown) {
  const tokenHash = await sha256(cleanText(tokenValue, 300));
  const clientId = cleanText(clientIdValue, 120);
  const row = await database().prepare(`SELECT token_hash, client_id, user_id, organization_id, patient_id,
    scopes_json, expires_at, revoked_at FROM oauth_refresh_tokens WHERE token_hash = ?`)
    .bind(tokenHash).first<Record<string, string | null>>();
  if (!row || row.client_id !== clientId || row.revoked_at || Date.parse(String(row.expires_at)) <= Date.now()) return null;
  const revoked = await database().prepare("UPDATE oauth_refresh_tokens SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL")
    .bind(new Date().toISOString(), tokenHash).run();
  if (!revoked.meta.changes) return null;
  return issueTokens(row, clientId);
}

async function issueTokens(row: Record<string, string | null>, clientId: string) {
  const accessToken = randomToken();
  const refreshToken = randomToken();
  const now = new Date().toISOString();
  const scopes = parseStringArray(row.scopes_json);
  await database().batch([
    database().prepare(`INSERT INTO api_tokens
      (id, organization_id, patient_id, user_id, label, token_hash, scopes_json, expires_at, created_at)
      VALUES (?, ?, ?, ?, 'ChatGPT OAuth', ?, ?, ?, ?)`)
      .bind(`tok_${crypto.randomUUID()}`, row.organization_id, row.patient_id, row.user_id, await sha256(accessToken), JSON.stringify(scopes), new Date(Date.now() + 60 * 60_000).toISOString(), now),
    database().prepare(`INSERT INTO oauth_refresh_tokens
      (token_hash, client_id, user_id, organization_id, patient_id, scopes_json, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(await sha256(refreshToken), clientId, row.user_id, row.organization_id, row.patient_id, JSON.stringify(scopes), new Date(Date.now() + 90 * 86400_000).toISOString(), now),
  ]);
  return { access_token: accessToken, token_type: "Bearer", expires_in: 3600, refresh_token: refreshToken, scope: scopes.join(" ") };
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return base64Url(bytes.buffer);
}

function base64Url(value: ArrayBuffer) {
  const bytes = new Uint8Array(value);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
