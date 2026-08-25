import { env } from "cloudflare:workers";

// Compatibility boundary for the one-time import from the retired family
// tracker. No registration, login, session creation or public auth route uses
// this module in Entheos.
const LEGACY_SESSION_COOKIE = "nutri_family_session";
const encoder = new TextEncoder();

export type LegacyFamilyUser = {
  id: string;
  displayName: string;
};

type LegacySessionRow = {
  id: string;
  display_name: string;
};

type LegacyPasswordRow = {
  password_hash: string;
  password_salt: string;
  password_iterations: number;
};

let schemaPromise: Promise<void> | null = null;

function database(): D1Database {
  if (!env.DB) throw new Error("La base de datos no está disponible.");
  return env.DB;
}

async function ensureLegacySchema(): Promise<void> {
  if (!schemaPromise) {
    const db = database();
    schemaPromise = db
      .batch([
        db.prepare(`CREATE TABLE IF NOT EXISTS family_users (
          id TEXT PRIMARY KEY NOT NULL,
          display_name TEXT NOT NULL,
          name_key TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          password_salt TEXT NOT NULL,
          password_iterations INTEGER NOT NULL DEFAULT 100000,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`),
        db.prepare(`CREATE TABLE IF NOT EXISTS family_sessions (
          token_hash TEXT PRIMARY KEY NOT NULL,
          user_id TEXT NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
          expires_at INTEGER NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`),
        db.prepare(`CREATE TABLE IF NOT EXISTS nutrition_data (
          user_id TEXT PRIMARY KEY NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
          payload TEXT NOT NULL DEFAULT '{}',
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`),
      ])
      .then(() => undefined)
      .catch((error) => {
        schemaPromise = null;
        throw error;
      });
  }
  return schemaPromise;
}

export async function getFamilySession(request: Request): Promise<LegacyFamilyUser | null> {
  await ensureLegacySchema();
  const token = readCookie(request.headers.get("cookie"), LEGACY_SESSION_COOKIE);
  if (!token) return null;
  const row = await database()
    .prepare(`SELECT u.id, u.display_name
      FROM family_sessions s
      JOIN family_users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ?`)
    .bind(await sha256(token), Date.now())
    .first<LegacySessionRow>();
  return row ? { id: row.id, displayName: row.display_name } : null;
}

export async function verifyFamilyPassword(userId: string, passwordValue: unknown): Promise<boolean> {
  await ensureLegacySchema();
  const password = String(passwordValue ?? "");
  if (password.length < 4 || password.length > 128) return false;
  const row = await database()
    .prepare(`SELECT password_hash, password_salt, password_iterations
      FROM family_users WHERE id = ?`)
    .bind(userId)
    .first<LegacyPasswordRow>();
  if (!row) return false;
  const candidate = await derivePassword(password, row.password_salt, row.password_iterations);
  return constantTimeEqual(candidate, row.password_hash);
}

async function derivePassword(password: string, salt: string, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const decodedSalt = fromBase64Url(salt);
  const saltBuffer = new ArrayBuffer(decodedSalt.byteLength);
  new Uint8Array(saltBuffer).set(decodedSalt);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: saltBuffer, iterations },
    key,
    256,
  );
  return toBase64Url(new Uint8Array(bits));
}

async function sha256(value: string): Promise<string> {
  return toBase64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}

function constantTimeEqual(left: string, right: string): boolean {
  const size = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < size; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) {
      try {
        return decodeURIComponent(value.join("="));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}
