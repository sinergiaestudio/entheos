import { env } from "cloudflare:workers";
import {
  cleanText,
  finiteNumber,
  sha256,
  validDate,
  validIsoDateTime,
  writeAudit,
  type ClinicalContext,
} from "./clinical";
import { getProviderCredentials } from "./provider-config";

export const INTERVALS_PROVIDER = "intervals_icu";
export const INTERVALS_SCOPES = ["ACTIVITY:READ", "WELLNESS:READ"] as const;

const AUTHORIZE_URL = "https://intervals.icu/oauth/authorize";
const TOKEN_URL = "https://intervals.icu/api/oauth/token";
const API_ROOT = "https://intervals.icu/api/v1";
const MAX_SYNC_DAYS = 366;

type AnyRow = Record<string, unknown>;

type ConnectionRow = {
  id: string;
  config_json: string;
  status: string;
};

type StoredIntervalsConfig = {
  version: 1;
  accessTokenCipher: string;
  athleteId: string;
  athleteName: string;
  scopes: string[];
  tokenType: string;
};

export type IntervalsOAuthResult = {
  accessToken: string;
  athleteId: string;
  athleteName: string;
  scopes: string[];
  tokenType: string;
};

export type IntervalsSyncResult = {
  status: "active" | "degraded";
  activities: number;
  wellnessDays: number;
  observations: number;
  warnings: string[];
  oldest: string;
  newest: string;
  syncedAt: string;
};

export class IntervalsIntegrationError extends Error {
  constructor(
    message: string,
    readonly code = "intervals_error",
    readonly status = 502,
  ) {
    super(message);
    this.name = "IntervalsIntegrationError";
  }
}

export async function intervalsConfigurationStatus() {
  const credentials = await getProviderCredentials(INTERVALS_PROVIDER);
  return { ready: credentials.ready, source: credentials.source };
}

export async function intervalsAuthorizationUrl(redirectUri: string, state: string) {
  const credentials = await getProviderCredentials(INTERVALS_PROVIDER);
  if (!credentials.ready) {
    throw new IntervalsIntegrationError(
      "La autorización de Intervals.icu todavía no está habilitada para Entheos.",
      "provider_registration_required",
      503,
    );
  }
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", credentials.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", INTERVALS_SCOPES.join(","));
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeIntervalsCode(codeValue: string): Promise<IntervalsOAuthResult> {
  const code = cleanText(codeValue, 180);
  const credentials = await getProviderCredentials(INTERVALS_PROVIDER);
  if (!code || !credentials.ready) {
    throw new IntervalsIntegrationError(
      "No se pudo completar la autorización de Intervals.icu.",
      "invalid_oauth_exchange",
      400,
    );
  }
  const body = new URLSearchParams({
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    code,
  });
  let response: Response;
  try {
    response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body,
    });
  } catch {
    throw new IntervalsIntegrationError(
      "Intervals.icu no respondió durante la autorización. Podés volver a intentarlo.",
      "oauth_unreachable",
    );
  }
  const payload = await response.json().catch(() => null) as AnyRow | null;
  const accessToken = cleanText(payload?.access_token, 500);
  if (!response.ok || !accessToken) {
    throw new IntervalsIntegrationError(
      "Intervals.icu rechazó o venció la autorización. Volvé a iniciar el vínculo.",
      "oauth_rejected",
      response.status === 400 ? 400 : 502,
    );
  }
  const athlete = payload?.athlete && typeof payload.athlete === "object"
    ? payload.athlete as AnyRow
    : {};
  const scopes = cleanText(payload?.scope, 500)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return {
    accessToken,
    athleteId: cleanText(athlete.id, 100) || "0",
    athleteName: cleanText(athlete.name, 160) || "Cuenta de Intervals.icu",
    scopes,
    tokenType: cleanText(payload?.token_type, 30) || "Bearer",
  };
}

export async function encodeIntervalsConfig(result: IntervalsOAuthResult) {
  const config: StoredIntervalsConfig = {
    version: 1,
    accessTokenCipher: await encryptToken(result.accessToken),
    athleteId: result.athleteId,
    athleteName: result.athleteName,
    scopes: result.scopes,
    tokenType: result.tokenType,
  };
  return JSON.stringify(config);
}

export async function syncIntervalsConnection(
  context: Pick<ClinicalContext, "userId" | "organizationId" | "patientId">,
  connectionId: string,
  requestedRange: { oldest?: string | null; newest?: string | null } = {},
): Promise<IntervalsSyncResult> {
  const connection = await env.DB.prepare(`SELECT id, config_json, status
    FROM integration_connections
    WHERE id = ? AND patient_id = ? AND organization_id = ? AND provider = ?
      AND revoked_at IS NULL AND status IN ('active', 'degraded', 'interrupted')`)
    .bind(connectionId, context.patientId, context.organizationId, INTERVALS_PROVIDER)
    .first<ConnectionRow>();
  if (!connection) {
    throw new IntervalsIntegrationError(
      "No encontramos una cuenta activa de Intervals.icu.",
      "connection_not_found",
      404,
    );
  }
  const stored = await decodeIntervalsConfig(connection.config_json);
  const range = normalizeRange(requestedRange.oldest, requestedRange.newest);
  const now = new Date().toISOString();
  await env.DB.prepare(`UPDATE integration_connections SET last_sync_at = ?, updated_at = ?
    WHERE id = ? AND patient_id = ? AND organization_id = ?`)
    .bind(now, now, connection.id, context.patientId, context.organizationId).run();

  const [wellnessResult, activitiesResult] = await Promise.allSettled([
    intervalsJson(
      `/athlete/0/wellness?oldest=${encodeURIComponent(range.oldest)}&newest=${encodeURIComponent(range.newest)}`,
      stored.accessToken,
    ),
    intervalsJson(
      `/athlete/0/activities?oldest=${encodeURIComponent(range.oldest)}&newest=${encodeURIComponent(range.newest)}`,
      stored.accessToken,
    ),
  ]);

  const warnings: string[] = [];
  let wellnessDays = 0;
  let observations = 0;
  let activities = 0;
  if (wellnessResult.status === "fulfilled") {
    const rows = Array.isArray(wellnessResult.value) ? wellnessResult.value : [];
    const ingested = await ingestWellness(context, rows.slice(0, MAX_SYNC_DAYS), now);
    wellnessDays = ingested.days;
    observations = ingested.observations;
  } else {
    warnings.push(friendlyRemoteFailure(wellnessResult.reason, "bienestar diario"));
  }
  if (activitiesResult.status === "fulfilled") {
    const rows = Array.isArray(activitiesResult.value) ? activitiesResult.value : [];
    activities = await ingestActivities(context, rows.slice(0, 4_000), now);
  } else {
    warnings.push(friendlyRemoteFailure(activitiesResult.reason, "actividades"));
  }

  if (wellnessResult.status === "rejected" && activitiesResult.status === "rejected") {
    const unauthorized = [wellnessResult.reason, activitiesResult.reason]
      .some((error) => error instanceof IntervalsIntegrationError && error.code === "authorization_expired");
    const message = unauthorized
      ? "Intervals.icu dejó de autorizar esta conexión. Volvé a vincular la cuenta."
      : "Intervals.icu no respondió a las consultas de bienestar ni de actividades.";
    await markConnectionFailure(context, connection.id, unauthorized ? "authorization_expired" : "remote_unavailable", message, now);
    throw new IntervalsIntegrationError(message, unauthorized ? "authorization_expired" : "remote_unavailable", unauthorized ? 401 : 502);
  }

  const status: "active" | "degraded" = warnings.length ? "degraded" : "active";
  const errorMessage = warnings.length ? warnings.join(" ").slice(0, 240) : null;
  await env.DB.prepare(`UPDATE integration_connections SET status = ?, last_seen_at = ?,
    last_sync_at = ?, last_success_at = ?, last_error_code = ?, last_error_message = ?,
    last_error_at = ?, updated_at = ?
    WHERE id = ? AND patient_id = ? AND organization_id = ? AND revoked_at IS NULL`)
    .bind(status, now, now, now, warnings.length ? "partial_sync" : null, errorMessage,
      warnings.length ? now : null, now, connection.id, context.patientId, context.organizationId).run();
  await writeAudit(context, "sync", "intervals_icu", connection.id, {
    source: INTERVALS_PROVIDER,
    count: activities + observations,
    status,
  });
  return { status, activities, wellnessDays, observations, warnings, ...range, syncedAt: now };
}

export async function revokeIntervalsToken(configJson: string) {
  let token: string;
  try {
    token = (await decodeIntervalsConfig(configJson)).accessToken;
  } catch {
    return false;
  }
  try {
    const response = await fetch(`${API_ROOT}/disconnect-app`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
    });
    return response.ok || response.status === 401 || response.status === 403 || response.status === 404;
  } catch {
    return false;
  }
}

async function decodeIntervalsConfig(value: string) {
  let parsed: StoredIntervalsConfig;
  try {
    parsed = JSON.parse(value) as StoredIntervalsConfig;
  } catch {
    throw new IntervalsIntegrationError("La conexión guardada no es válida.", "invalid_connection", 500);
  }
  if (parsed?.version !== 1 || !parsed.accessTokenCipher) {
    throw new IntervalsIntegrationError("La conexión guardada no es válida.", "invalid_connection", 500);
  }
  return { ...parsed, accessToken: await decryptToken(parsed.accessTokenCipher) };
}

async function intervalsJson(path: string, token: string) {
  let response: Response;
  try {
    response = await fetch(`${API_ROOT}${path}`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
    });
  } catch {
    throw new IntervalsIntegrationError("Intervals.icu no respondió.", "remote_unavailable");
  }
  if (response.status === 204) return [];
  if (response.status === 401 || response.status === 403) {
    throw new IntervalsIntegrationError("La autorización de Intervals.icu venció.", "authorization_expired", 401);
  }
  if (!response.ok) {
    throw new IntervalsIntegrationError(`Intervals.icu respondió con estado ${response.status}.`, "remote_error");
  }
  const payload = await response.json().catch(() => null);
  if (!Array.isArray(payload)) {
    throw new IntervalsIntegrationError("Intervals.icu devolvió un formato inesperado.", "invalid_remote_payload");
  }
  return payload as AnyRow[];
}

async function ingestWellness(
  context: Pick<ClinicalContext, "userId" | "organizationId" | "patientId">,
  rows: AnyRow[],
  now: string,
) {
  let days = 0;
  let observations = 0;
  const statements: D1PreparedStatement[] = [];
  for (const row of rows) {
    const date = validDate(row.id ?? row.date);
    if (!date) continue;
    days += 1;
    const effectiveAt = `${date}T12:00:00.000Z`;
    const recordedAt = validIsoDateTime(row.updated) || now;
    const upstream = upstreamSource(row);
    const metrics = wellnessMetrics(row);
    for (const metric of metrics) {
      const sourceId = `wellness:${date}:${metric.code}`;
      const fingerprint = await sha256(`${context.patientId}:${INTERVALS_PROVIDER}:${sourceId}`);
      const contextJson = JSON.stringify({
        label: metric.label,
        connector: "intervals-icu-oauth-v1",
        dataOrigin: upstream,
        sourceRecordId: date,
      });
      statements.push(env.DB.prepare(`INSERT INTO observations
        (id, organization_id, patient_id, code, value_numeric, unit, effective_at,
        recorded_at, context_json, source_type, source_id, status, verification_status,
        version, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'final', 'device_recorded', 1, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET value_numeric = excluded.value_numeric,
          unit = excluded.unit, effective_at = excluded.effective_at,
          recorded_at = excluded.recorded_at, context_json = excluded.context_json,
          status = 'final', verification_status = 'device_recorded',
          version = observations.version + 1, deleted_at = NULL, updated_at = excluded.updated_at`)
        .bind(`obs_${fingerprint.slice(0, 30)}`, context.organizationId, context.patientId,
          metric.code, metric.value, metric.unit, effectiveAt, recordedAt, contextJson,
          INTERVALS_PROVIDER, sourceId, context.userId, now, now));
      observations += 1;
    }

    const weight = finiteNumber(row.weight, 20, 400);
    if (weight !== null) {
      const id = await deterministicId("wei", `${context.patientId}:${INTERVALS_PROVIDER}:${date}:weight`);
      statements.push(env.DB.prepare(`INSERT INTO weight_entries
        (id, organization_id, patient_id, effective_at, weight_kg, conditions,
        source_type, verification_status, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'device_recorded', ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET weight_kg = excluded.weight_kg,
          conditions = excluded.conditions, verification_status = 'device_recorded',
          deleted_at = NULL, updated_at = excluded.updated_at`)
        .bind(id, context.organizationId, context.patientId, effectiveAt, weight,
          `Importado desde Intervals.icu · origen ${upstream}`, INTERVALS_PROVIDER,
          context.userId, now, now));
    }

    const sleepSeconds = pickNumber(row, ["sleepSecs", "sleep_seconds"], 0, 86_400);
    if (sleepSeconds !== null) {
      const id = await deterministicId("sle", `${context.patientId}:${INTERVALS_PROVIDER}:${date}:sleep`);
      const rawQuality = pickNumber(row, ["sleepQuality", "sleep_quality"], 0, 100);
      const quality = rawQuality !== null && rawQuality >= 1 && rawQuality <= 5 ? Math.round(rawQuality) : null;
      statements.push(env.DB.prepare(`INSERT INTO sleep_entries
        (id, organization_id, patient_id, effective_at, hours, quality, notes,
        source_type, verification_status, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'device_recorded', ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET hours = excluded.hours, quality = excluded.quality,
          notes = excluded.notes, verification_status = 'device_recorded',
          deleted_at = NULL, updated_at = excluded.updated_at`)
        .bind(id, context.organizationId, context.patientId, effectiveAt,
          Number((sleepSeconds / 3600).toFixed(2)), quality,
          `Importado desde Intervals.icu · origen ${upstream}`, INTERVALS_PROVIDER,
          context.userId, now, now));
    }

    const systolic = pickNumber(row, ["systolic", "systolicBP"], 60, 260);
    const diastolic = pickNumber(row, ["diastolic", "diastolicBP"], 30, 180);
    if (systolic !== null && diastolic !== null) {
      const id = await deterministicId("bpr", `${context.patientId}:${INTERVALS_PROVIDER}:${date}:pressure`);
      statements.push(env.DB.prepare(`INSERT INTO blood_pressure_readings
        (id, organization_id, patient_id, effective_at, systolic, diastolic, context,
        series_id, source_type, verification_status, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'device_recorded', ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET systolic = excluded.systolic,
          diastolic = excluded.diastolic, context = excluded.context,
          verification_status = 'device_recorded', deleted_at = NULL,
          updated_at = excluded.updated_at`)
        .bind(id, context.organizationId, context.patientId, effectiveAt,
          Math.round(systolic), Math.round(diastolic),
          `Importado desde Intervals.icu · origen ${upstream}`, id,
          INTERVALS_PROVIDER, context.userId, now, now));
    }
  }
  await runInChunks(statements);
  return { days, observations };
}

async function ingestActivities(
  context: Pick<ClinicalContext, "userId" | "organizationId" | "patientId">,
  rows: AnyRow[],
  now: string,
) {
  const statements: D1PreparedStatement[] = [];
  let accepted = 0;
  for (const row of rows) {
    const externalId = cleanText(row.id ?? row.activity_id, 180);
    const effectiveAt = activityDate(row);
    if (!externalId || !effectiveAt) continue;
    const type = cleanText(row.type ?? row.sport ?? row.category, 100) || "Actividad";
    const name = cleanText(row.name, 180);
    const durationSeconds = pickNumber(row, ["moving_time", "elapsed_time", "duration", "icu_recording_time"], 0, 2_592_000);
    const durationMinutes = durationSeconds === null ? null : Math.max(0, Math.round(durationSeconds / 60));
    const distanceMeters = pickNumber(row, ["distance"], 0, 5_000_000);
    const distanceKm = distanceMeters === null ? null : Number((distanceMeters / 1000).toFixed(3));
    const averageHr = pickNumber(row, ["average_heartrate", "average_hr", "icu_average_hr"], 20, 260);
    const maxHr = pickNumber(row, ["max_heartrate", "max_hr", "icu_max_hr"], 20, 280);
    const upstream = upstreamSource(row);
    const id = await deterministicId("act", `${context.patientId}:${INTERVALS_PROVIDER}:${externalId}`);
    const eventId = await deterministicId("evt", `${context.patientId}:${INTERVALS_PROVIDER}:${externalId}`);
    const detail = [
      durationMinutes !== null ? `${durationMinutes} min` : "",
      distanceKm !== null ? `${distanceKm.toLocaleString("es-AR")} km` : "",
      averageHr !== null ? `FC media ${Math.round(averageHr)} lpm` : "",
      maxHr !== null ? `máxima ${Math.round(maxHr)} lpm` : "",
    ].filter(Boolean).join(" · ");
    const comments = [name, `Origen ${upstream}`, `Referencia ${externalId}`].filter(Boolean).join(" · ").slice(0, 1200);
    statements.push(env.DB.prepare(`INSERT INTO activity_sessions
      (id, organization_id, patient_id, effective_at, activity_type, duration_minutes,
      distance_km, average_heart_rate, max_heart_rate, comments, source_type,
      verification_status, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'device_recorded', ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET effective_at = excluded.effective_at,
        activity_type = excluded.activity_type, duration_minutes = excluded.duration_minutes,
        distance_km = excluded.distance_km, average_heart_rate = excluded.average_heart_rate,
        max_heart_rate = excluded.max_heart_rate, comments = excluded.comments,
        verification_status = 'device_recorded', deleted_at = NULL,
        updated_at = excluded.updated_at`)
      .bind(id, context.organizationId, context.patientId, effectiveAt, type,
        durationMinutes, distanceKm, averageHr === null ? null : Math.round(averageHr),
        maxHr === null ? null : Math.round(maxHr), comments, INTERVALS_PROVIDER,
        context.userId, now, now));
    statements.push(env.DB.prepare(`INSERT INTO timeline_events
      (id, organization_id, patient_id, effective_at, recorded_at, type, title,
      description, source_type, source_id, status, verification_status, visibility,
      relevance, tags_json, version, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'activity', ?, ?, ?, ?, 'active', 'device_recorded',
      'private', 1, ?, 1, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET effective_at = excluded.effective_at,
        recorded_at = excluded.recorded_at, title = excluded.title,
        description = excluded.description, status = 'active',
        verification_status = 'device_recorded', version = timeline_events.version + 1,
        deleted_at = NULL, updated_at = excluded.updated_at`)
      .bind(eventId, context.organizationId, context.patientId, effectiveAt, now,
        name || `Actividad · ${type}`, detail || `Importada desde ${upstream}`,
        INTERVALS_PROVIDER, externalId, JSON.stringify(["actividad", "Intervals.icu"]),
        context.userId, now, now));
    accepted += 1;
  }
  await runInChunks(statements);
  return accepted;
}

function wellnessMetrics(row: AnyRow) {
  const specs = [
    { fields: ["steps"], code: "steps", label: "Pasos", unit: "pasos", min: 0, max: 250_000, transform: (value: number) => value },
    { fields: ["restingHR", "resting_hr"], code: "resting_heart_rate_bpm", label: "Frecuencia cardíaca en reposo", unit: "lpm", min: 20, max: 220, transform: (value: number) => value },
    { fields: ["hrv"], code: "hrv_ms", label: "Variabilidad de frecuencia cardíaca", unit: "ms", min: 0, max: 500, transform: (value: number) => value },
    { fields: ["sleepSecs", "sleep_seconds"], code: "sleep_duration_minutes", label: "Duración del sueño", unit: "min", min: 0, max: 86_400, transform: (value: number) => Number((value / 60).toFixed(1)) },
    { fields: ["sleepQuality", "sleep_quality"], code: "sleep_quality_score", label: "Calidad de sueño", unit: "puntaje", min: 0, max: 100, transform: (value: number) => value },
    { fields: ["weight"], code: "weight_kg", label: "Peso", unit: "kg", min: 20, max: 400, transform: (value: number) => value },
    { fields: ["spO2", "spo2"], code: "spo2_percent", label: "Oxígeno en sangre", unit: "%", min: 40, max: 100, transform: (value: number) => value },
    { fields: ["systolic", "systolicBP"], code: "systolic_blood_pressure_mmhg", label: "Presión sistólica", unit: "mmHg", min: 60, max: 260, transform: (value: number) => value },
    { fields: ["diastolic", "diastolicBP"], code: "diastolic_blood_pressure_mmhg", label: "Presión diastólica", unit: "mmHg", min: 30, max: 180, transform: (value: number) => value },
  ];
  return specs.flatMap((spec) => {
    const value = pickNumber(row, spec.fields, spec.min, spec.max);
    return value === null ? [] : [{ ...spec, value: spec.transform(value) }];
  });
}

function normalizeRange(oldestValue?: string | null, newestValue?: string | null) {
  const today = new Date().toISOString().slice(0, 10);
  const newest = validDate(newestValue) || today;
  const fallbackOldest = new Date(Date.parse(`${newest}T12:00:00.000Z`) - 41 * 86_400_000)
    .toISOString().slice(0, 10);
  const oldest = validDate(oldestValue) || fallbackOldest;
  const oldestTime = Date.parse(`${oldest}T12:00:00.000Z`);
  const newestTime = Date.parse(`${newest}T12:00:00.000Z`);
  if (oldestTime > newestTime || newestTime - oldestTime > (MAX_SYNC_DAYS - 1) * 86_400_000) {
    throw new IntervalsIntegrationError(
      `Elegí un período válido de hasta ${MAX_SYNC_DAYS} días.`,
      "invalid_date_range",
      400,
    );
  }
  return { oldest, newest };
}

function activityDate(row: AnyRow) {
  for (const key of ["start_date", "start_date_local", "startDate", "date"]) {
    const raw = cleanText(row[key], 40);
    if (!raw) continue;
    const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(raw)
      ? `${raw}Z`
      : /^\d{4}-\d{2}-\d{2}$/.test(raw)
        ? `${raw}T12:00:00.000Z`
        : raw;
    const parsed = validIsoDateTime(normalized);
    if (parsed) return parsed;
  }
  return null;
}

function pickNumber(row: AnyRow, fields: string[], min: number, max: number) {
  for (const field of fields) {
    const value = finiteNumber(row[field], min, max);
    if (value !== null) return value;
  }
  return null;
}

function upstreamSource(row: AnyRow) {
  for (const field of ["source", "sourceName", "source_name", "device_name"]) {
    if (typeof row[field] === "string" && cleanText(row[field], 120)) return cleanText(row[field], 120);
  }
  return "Intervals.icu";
}

async function deterministicId(prefix: string, value: string) {
  return `${prefix}_${(await sha256(value)).slice(0, 30)}`;
}

async function runInChunks(statements: D1PreparedStatement[]) {
  for (let offset = 0; offset < statements.length; offset += 50) {
    await env.DB.batch(statements.slice(offset, offset + 50));
  }
}

async function markConnectionFailure(
  context: Pick<ClinicalContext, "organizationId" | "patientId">,
  connectionId: string,
  code: string,
  message: string,
  now: string,
) {
  await env.DB.prepare(`UPDATE integration_connections SET status = 'interrupted',
    last_error_code = ?, last_error_message = ?, last_error_at = ?, updated_at = ?
    WHERE id = ? AND patient_id = ? AND organization_id = ? AND revoked_at IS NULL`)
    .bind(code, message.slice(0, 240), now, now, connectionId,
      context.patientId, context.organizationId).run();
}

function friendlyRemoteFailure(reason: unknown, category: string) {
  if (reason instanceof IntervalsIntegrationError && reason.code === "authorization_expired") {
    return `Intervals.icu rechazó el acceso a ${category}.`;
  }
  return `No se pudo actualizar ${category}.`;
}

async function encryptionKey() {
  const secret = env.ENTHEOS_INTEGRATION_KEY?.trim();
  if (!secret) {
    throw new IntervalsIntegrationError(
      "El almacenamiento seguro de integraciones no está configurado.",
      "encryption_unavailable",
      503,
    );
  }
  const material = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", material, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptToken(token: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await encryptionKey(),
    new TextEncoder().encode(token),
  );
  return `v1.${base64Url(iv)}.${base64Url(new Uint8Array(cipher))}`;
}

async function decryptToken(value: string) {
  const [version, ivValue, cipherValue] = value.split(".");
  if (version !== "v1" || !ivValue || !cipherValue) {
    throw new IntervalsIntegrationError("La credencial guardada no es válida.", "invalid_token_cipher", 500);
  }
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64Url(ivValue) },
      await encryptionKey(),
      fromBase64Url(cipherValue),
    );
    return new TextDecoder().decode(plain);
  } catch {
    throw new IntervalsIntegrationError("No se pudo abrir la credencial guardada.", "token_decryption_failed", 500);
  }
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
