import { env } from "cloudflare:workers";
import { cleanText, parseStringArray, sha256 } from "./clinical";

export const HEALTH_CONNECT_PROVIDER = "health_connect";

export const healthConnectMetrics = {
  steps: { label: "Pasos", unit: "pasos", min: 0, max: 250_000 },
  heart_rate_bpm: { label: "Frecuencia cardíaca", unit: "lpm", min: 20, max: 260 },
  resting_heart_rate_bpm: { label: "Frecuencia cardíaca en reposo", unit: "lpm", min: 20, max: 220 },
  spo2_percent: { label: "Oxígeno en sangre", unit: "%", min: 40, max: 100 },
  respiratory_rate: { label: "Frecuencia respiratoria", unit: "resp/min", min: 4, max: 80 },
  sleep_duration_minutes: { label: "Duración del sueño", unit: "min", min: 0, max: 1_440 },
  deep_sleep_minutes: { label: "Sueño profundo", unit: "min", min: 0, max: 1_440 },
  light_sleep_minutes: { label: "Sueño ligero", unit: "min", min: 0, max: 1_440 },
  rem_sleep_minutes: { label: "Sueño REM", unit: "min", min: 0, max: 1_440 },
  weight_kg: { label: "Peso", unit: "kg", min: 20, max: 400 },
  distance_km: { label: "Distancia", unit: "km", min: 0, max: 1_000 },
  active_calories_kcal: { label: "Calorías activas", unit: "kcal", min: 0, max: 30_000 },
  total_calories_kcal: { label: "Calorías totales", unit: "kcal", min: 0, max: 30_000 },
  exercise_duration_minutes: { label: "Actividad física", unit: "min", min: 0, max: 1_440 },
  vo2max: { label: "VO₂ máx.", unit: "ml/kg/min", min: 5, max: 100 },
} as const;

export type HealthConnectMetricCode = keyof typeof healthConnectMetrics;

type IntegrationRow = {
  id: string;
  organization_id: string;
  patient_id: string;
  user_id: string;
  provider: string;
  display_name: string;
  status: string;
  token_expires_at: string | null;
  capabilities_json: string;
  display_name_user: string;
  email: string;
};

export type IntegrationContext = {
  connectionId: string;
  organizationId: string;
  patientId: string;
  userId: string;
  provider: string;
  connectionName: string;
  displayName: string;
  email: string;
  capabilities: string[];
};

function database(): D1Database {
  if (!env.DB) throw new Error("Clinical database unavailable");
  return env.DB;
}

export async function authorizeIntegrationRequest(
  request: Request,
  provider = HEALTH_CONNECT_PROVIDER,
): Promise<IntegrationContext | null> {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return null;
  const rawToken = authorization.slice(7).trim();
  if (!rawToken.startsWith("ent_") || rawToken.length < 40) return null;
  const tokenHash = await sha256(rawToken);
  const row = await database().prepare(`SELECT c.id, c.organization_id, c.patient_id, c.user_id,
    c.provider, c.display_name, c.status, c.token_expires_at, c.capabilities_json,
    u.display_name AS display_name_user, u.email
    FROM integration_connections c
    JOIN users u ON u.id = c.user_id
    WHERE c.connector_token_hash = ? AND c.provider = ? AND c.revoked_at IS NULL
      AND c.status IN ('active', 'degraded', 'interrupted', 'pending_permissions') AND u.status = 'active'`)
    .bind(tokenHash, provider).first<IntegrationRow>();
  if (!row || (row.token_expires_at && Date.parse(row.token_expires_at) <= Date.now())) return null;
  return {
    connectionId: row.id,
    organizationId: row.organization_id,
    patientId: row.patient_id,
    userId: row.user_id,
    provider: row.provider,
    connectionName: row.display_name,
    displayName: row.display_name_user,
    email: row.email,
    capabilities: parseStringArray(row.capabilities_json),
  };
}

export function integrationPublicRow(row: Record<string, unknown>) {
  return {
    id: cleanText(row.id, 100),
    provider: cleanText(row.provider, 60),
    displayName: cleanText(row.display_name, 120),
    status: cleanText(row.status, 40),
    deviceLabel: cleanText(row.device_label, 120) || null,
    deviceModel: cleanText(row.device_model, 120) || null,
    capabilities: parseStringArray(row.capabilities_json),
    pairedAt: cleanText(row.paired_at, 40) || null,
    pairingExpiresAt: cleanText(row.pairing_expires_at, 40) || null,
    lastSeenAt: cleanText(row.last_seen_at, 40) || null,
    lastSyncAt: cleanText(row.last_sync_at, 40) || null,
    lastSuccessAt: cleanText(row.last_success_at, 40) || null,
    lastErrorCode: cleanText(row.last_error_code, 80) || null,
    lastErrorMessage: cleanText(row.last_error_message, 240) || null,
    lastErrorAt: cleanText(row.last_error_at, 40) || null,
    createdAt: cleanText(row.created_at, 40),
    updatedAt: cleanText(row.updated_at, 40),
  };
}

export function randomUrlToken(bytesLength = 32) {
  const bytes = new Uint8Array(bytesLength);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function randomPairingCode() {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => alphabet[byte & 31]).join("");
}

export function normalizePairingCode(value: unknown) {
  return cleanText(value, 16).toUpperCase().replace(/[^2-9A-HJ-NP-Z]/g, "").slice(0, 8);
}

export function formatPairingCode(code: string) {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}
