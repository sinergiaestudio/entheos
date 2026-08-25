import { env } from "cloudflare:workers";

const EMAIL_HEADER = "oai-authenticated-user-email";
const FULL_NAME_HEADER = "oai-authenticated-user-full-name";
const FULL_NAME_ENCODING_HEADER = "oai-authenticated-user-full-name-encoding";
const FULL_NAME_ENCODING = "percent-encoded-utf-8";

export type ClinicalContext = {
  userId: string;
  organizationId: string;
  patientId: string;
  email: string;
  displayName: string;
  scopes: string[];
  authMode: "platform" | "token";
  isGlobalAdmin: boolean;
};

type TokenRow = {
  user_id: string;
  patient_id: string;
  organization_id: string;
  scopes_json: string;
  expires_at: string | null;
  display_name: string;
  email: string;
};

function database(): D1Database {
  if (!env.DB) throw new Error("Clinical database unavailable");
  return env.DB;
}

export async function authorizeClinicalRequest(
  request: Request,
  requiredScopes: string[] = [],
): Promise<ClinicalContext | null> {
  const platform = platformIdentity(request);
  if (platform) {
    const context = await ensureClinicalIdentity(platform.email, platform.displayName);
    if (!context) return null;
    return { ...context, scopes: ["health.read", "documents.read", "documents.write", "observations.write", "profile.write"], authMode: "platform", isGlobalAdmin: platform.isGlobalAdmin };
  }

  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return null;
  const rawToken = authorization.slice(7).trim();
  if (rawToken.length < 32) return null;
  const tokenHash = await sha256(rawToken);
  const row = await database()
    .prepare(`SELECT t.user_id, t.patient_id, t.organization_id, t.scopes_json, t.expires_at,
      u.display_name, u.email
      FROM api_tokens t
      JOIN users u ON u.id = t.user_id
      WHERE t.token_hash = ? AND t.revoked_at IS NULL AND u.status = 'active'`)
    .bind(tokenHash)
    .first<TokenRow>();
  if (!row || (row.expires_at && Date.parse(row.expires_at) <= Date.now())) return null;

  const scopes = parseStringArray(row.scopes_json);
  if (requiredScopes.some((scope) => !scopes.includes(scope))) return null;
  await database().prepare("UPDATE api_tokens SET last_used_at = ? WHERE token_hash = ?")
    .bind(new Date().toISOString(), tokenHash).run();
  return {
    userId: row.user_id,
    patientId: row.patient_id,
    organizationId: row.organization_id,
    displayName: row.display_name,
    email: row.email,
    scopes,
    authMode: "token",
    isGlobalAdmin: false,
  };
}

export async function ensureClinicalIdentity(emailValue: string, displayNameValue: string) {
  const email = emailValue.trim().toLocaleLowerCase("en-US");
  const displayName = cleanText(displayNameValue, 120) || email;
  const db = database();
  const userId = await stableId("user", email);
  const organizationId = await stableId("organization", email);
  const patientId = await stableId("patient", email);
  const membershipId = await stableId("membership", email);
  const now = new Date().toISOString();

  const existing = await db.prepare("SELECT status FROM users WHERE id = ? OR email = ?")
    .bind(userId, email).first<{ status: string }>();
  if (existing && existing.status !== "active") return null;

  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO users
      (id, email, display_name, status, last_login_at, created_at, updated_at)
      VALUES (?, ?, ?, 'active', ?, ?, ?)`)
      .bind(userId, email, displayName, now, now, now),
    db.prepare("UPDATE users SET display_name = ?, last_login_at = ?, updated_at = ? WHERE id = ?")
      .bind(displayName, now, now, userId),
    db.prepare(`INSERT OR IGNORE INTO organizations
      (id, name, mode, created_at, updated_at)
      VALUES (?, 'Espacio personal', 'individual', ?, ?)`)
      .bind(organizationId, now, now),
    db.prepare(`INSERT OR IGNORE INTO memberships
      (id, organization_id, user_id, role, status, created_at, updated_at)
      VALUES (?, ?, ?, 'patient_admin', 'active', ?, ?)`)
      .bind(membershipId, organizationId, userId, now, now),
    db.prepare(`INSERT OR IGNORE INTO patient_profiles
      (id, organization_id, owner_user_id, display_name, timezone, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'America/Argentina/Buenos_Aires', ?, ?)`)
      .bind(patientId, organizationId, userId, displayName, now, now),
  ]);

  return { userId, organizationId, patientId, email, displayName };
}

export async function writeAudit(
  context: Pick<ClinicalContext, "userId" | "organizationId" | "patientId">,
  action: string,
  entityType: string,
  entityId?: string | null,
  metadata: Record<string, unknown> = {},
  outcome = "success",
) {
  const safeMetadata = Object.fromEntries(
    Object.entries(metadata)
      .filter(([key]) => ["source", "count", "format", "status", "documentType", "clientId"].includes(key))
      .map(([key, value]) => [key, typeof value === "string" ? cleanText(value, 80) : value]),
  );
  await database().prepare(`INSERT INTO audit_logs
    (id, organization_id, patient_id, user_id, action, entity_type, entity_id, outcome, metadata_json, occurred_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(
      crypto.randomUUID(),
      context.organizationId,
      context.patientId,
      context.userId,
      cleanText(action, 80),
      cleanText(entityType, 80),
      entityId || null,
      outcome,
      JSON.stringify(safeMetadata),
      new Date().toISOString(),
    )
    .run();
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export function cleanText(value: unknown, max = 2000): string {
  return String(value ?? "").normalize("NFKC").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
}

export function finiteNumber(value: unknown, min: number, max: number): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const result = Number(value);
  return Number.isFinite(result) && result >= min && result <= max ? result : null;
}

export function validIsoDateTime(value: unknown): string | null {
  const text = cleanText(value, 40);
  if (!text || !Number.isFinite(Date.parse(text))) return null;
  return new Date(text).toISOString();
}

export function validDate(value: unknown): string | null {
  const text = cleanText(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const [year, month, day] = text.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day ? text : null;
}

export function parseStringArray(value: unknown): string[] {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").slice(0, 100) : [];
  } catch {
    return [];
  }
}

export function jsonResponse(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "no-store");
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "no-referrer");
  headers.set("permissions-policy", "camera=(self), microphone=(self), geolocation=()");
  return new Response(JSON.stringify(body), { ...init, headers });
}

export function unauthorizedResponse(scope = "health.read", request?: Request) {
  const resourceMetadata = request
    ? ` resource_metadata="${new URL("/.well-known/oauth-protected-resource", request.url)}",`
    : "";
  return jsonResponse(
    { error: "Autenticación requerida." },
    { status: 401, headers: { "www-authenticate": `Bearer${resourceMetadata} scope="${scope}"` } },
  );
}

export async function sha256(value: string | ArrayBuffer): Promise<string> {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function platformIdentity(request: Request): { email: string; displayName: string; isGlobalAdmin: boolean } | null {
  const email = request.headers.get(EMAIL_HEADER)?.trim();
  if (!email) return null;
  const ownerEmail = env.APP_OWNER_EMAIL?.trim().toLocaleLowerCase("en-US");
  const encoded = request.headers.get(FULL_NAME_HEADER);
  let displayName = email;
  if (encoded && request.headers.get(FULL_NAME_ENCODING_HEADER) === FULL_NAME_ENCODING) {
    try {
      displayName = decodeURIComponent(encoded);
    } catch {
      displayName = email;
    }
  }
  return { email, displayName, isGlobalAdmin: Boolean(ownerEmail && email.toLocaleLowerCase("en-US") === ownerEmail) };
}

async function stableId(namespace: string, value: string): Promise<string> {
  const hash = await sha256(`${namespace}:${value}`);
  return `${namespace.slice(0, 3)}_${hash.slice(0, 28)}`;
}
