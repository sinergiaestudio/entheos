import { unzipSync, strFromU8 } from "fflate";
import { authorizeClinicalRequest, cleanText, jsonResponse, sameOrigin, sha256, unauthorizedResponse, writeAudit } from "@/db/clinical";
import { env } from "cloudflare:workers";

const MAX_UPLOAD = 25 * 1024 * 1024;
const MAX_EXPANDED = 40 * 1024 * 1024;
const MAX_OBSERVATIONS = 12_000;

type Row = Record<string, unknown>;
type Observation = { code: string; label: string; value: number; unit: string; effectiveAt: string; sourceType: string; file: string };

const metrics = [
  { code: "heart_rate_bpm", label: "Frecuencia cardíaca", keys: ["heart_rate", "heartrate", "heart_rate_bpm", "bpm", "hr"], hints: ["heart", "heartrate", "frecuencia"], unit: "lpm", min: 20, max: 260 },
  { code: "resting_heart_rate_bpm", label: "Frecuencia cardíaca en reposo", keys: ["resting_heart_rate", "resting_heartrate", "resting_hr"], hints: ["resting"], unit: "lpm", min: 20, max: 220 },
  { code: "steps", label: "Pasos", keys: ["steps", "step_count", "stepcount"], hints: ["step", "activity"], unit: "pasos", min: 0, max: 200_000 },
  { code: "spo2_percent", label: "Oxígeno en sangre", keys: ["spo2", "blood_oxygen", "oxygen_saturation"], hints: ["spo2", "oxygen"], unit: "%", min: 40, max: 100 },
  { code: "stress_score", label: "Estrés", keys: ["stress", "stress_score"], hints: ["stress"], unit: "puntos", min: 0, max: 100 },
  { code: "active_calories_kcal", label: "Calorías activas", keys: ["active_calories", "calories", "calorie", "kcal"], hints: ["calorie", "activity"], unit: "kcal", min: 0, max: 30_000 },
  { code: "distance_km", label: "Distancia", keys: ["distance_km", "distance", "total_distance"], hints: ["distance", "sport"], unit: "km", min: 0, max: 1_000 },
  { code: "respiratory_rate", label: "Frecuencia respiratoria", keys: ["respiratory_rate", "breathing_rate", "respiration"], hints: ["respiratory", "breathing"], unit: "resp/min", min: 4, max: 80 },
  { code: "vo2max", label: "VO₂ máx.", keys: ["vo2max", "vo2_max"], hints: ["vo2"], unit: "ml/kg/min", min: 5, max: 100 },
  { code: "sleep_duration_minutes", label: "Duración del sueño", keys: ["sleep_duration", "sleep_minutes", "total_sleep", "duration"], hints: ["sleep"], unit: "min", min: 0, max: 1_440 },
  { code: "deep_sleep_minutes", label: "Sueño profundo", keys: ["deep_sleep", "deep_sleep_minutes"], hints: ["sleep"], unit: "min", min: 0, max: 1_440 },
  { code: "light_sleep_minutes", label: "Sueño ligero", keys: ["light_sleep", "light_sleep_minutes"], hints: ["sleep"], unit: "min", min: 0, max: 1_440 },
  { code: "rem_sleep_minutes", label: "Sueño REM", keys: ["rem_sleep", "rem_sleep_minutes"], hints: ["sleep"], unit: "min", min: 0, max: 1_440 },
  { code: "weight_kg", label: "Peso", keys: ["weight_kg", "weight"], hints: ["weight", "body"], unit: "kg", min: 20, max: 400 },
] as const;

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonResponse({ error: "Solicitud no permitida." }, { status: 403 });
  const context = await authorizeClinicalRequest(request, ["observations.write"]);
  if (!context) return unauthorizedResponse("observations.write", request);
  let syncId: string | null = null;
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size <= 0) return jsonResponse({ error: "Elegí una exportación de Zepp o Health Connect." }, { status: 400 });
    if (file.size > MAX_UPLOAD) return jsonResponse({ error: "La exportación supera el límite de 25 MB." }, { status: 413 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const fileHash = await sha256(bytes.buffer);
    const importKey = `device-import:${fileHash}`;
    const previous = await env.DB.prepare("SELECT id, status FROM sync_events WHERE patient_id = ? AND idempotency_key = ?")
      .bind(context.patientId, importKey).first<{ id: string; status: string }>();
    if (previous?.status === "completed") return jsonResponse({ ok: true, duplicate: true, imported: 0, message: "Esta exportación ya estaba integrada." });
    if (previous?.status === "processing") return jsonResponse({ error: "Esta actualización ya está en curso." }, { status: 409 });
    const startedAt = new Date().toISOString();
    if (previous) {
      syncId = previous.id;
      await env.DB.prepare("UPDATE sync_events SET status = 'processing', created_at = ? WHERE id = ? AND patient_id = ?")
        .bind(startedAt, syncId, context.patientId).run();
    } else {
      syncId = `syn_${crypto.randomUUID()}`;
      await env.DB.prepare(`INSERT INTO sync_events
        (id, organization_id, patient_id, client_id, idempotency_key, entity_type, status, payload_hash, created_at)
        VALUES (?, ?, ?, 'zepp-importer', ?, 'device_import', 'processing', ?, ?)`)
        .bind(syncId, context.organizationId, context.patientId, importKey, fileHash, startedAt).run();
    }

    const payloads = extractPayloads(file.name, bytes);
    const observations: Observation[] = [];
    for (const payload of payloads) {
      for (const row of parseRows(payload.name, payload.text)) {
        observations.push(...normalizeRow(row, payload.name));
        if (observations.length >= MAX_OBSERVATIONS) break;
      }
      if (observations.length >= MAX_OBSERVATIONS) break;
    }
    const unique = deduplicate(observations).slice(0, MAX_OBSERVATIONS);
    if (!unique.length) {
      await env.DB.prepare("UPDATE sync_events SET status = 'failed' WHERE id = ? AND patient_id = ?").bind(syncId, context.patientId).run();
      await writeAudit(context, "import", "device_observations", fileHash, { source: "zepp", status: "failed" }, "error");
      return jsonResponse({ error: "No reconocimos métricas de salud en este archivo. Conservá la exportación: podremos ampliar el lector con su formato." }, { status: 422 });
    }

    const now = new Date().toISOString();
    let imported = 0;
    for (let offset = 0; offset < unique.length; offset += 60) {
      const batch = await Promise.all(unique.slice(offset, offset + 60).map(async (entry) => {
        const fingerprint = await sha256(`${context.patientId}:${fileHash}:${entry.file}:${entry.code}:${entry.effectiveAt}:${entry.value}`);
        return env.DB.prepare(`INSERT OR IGNORE INTO observations
          (id, organization_id, patient_id, code, value_numeric, unit, effective_at, recorded_at,
          context_json, source_type, source_id, status, verification_status, version, created_by,
          created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'final', 'device_recorded', 1, ?, ?, ?)`)
          .bind(`obs_${fingerprint.slice(0, 30)}`, context.organizationId, context.patientId,
            entry.code, entry.value, entry.unit, entry.effectiveAt, now,
            JSON.stringify({ label: entry.label, sourceFile: cleanText(entry.file, 180), importer: "entheos-zepp-v2" }),
            entry.sourceType, fileHash, context.userId, now, now);
      }));
      const result = await env.DB.batch(batch);
      imported += result.reduce((total, item) => total + Number(item.meta.changes || 0), 0);
    }
    await env.DB.prepare("UPDATE sync_events SET status = 'completed', entity_id = ? WHERE id = ? AND patient_id = ?")
      .bind(`observations:${imported}`, syncId, context.patientId).run();
    await writeAudit(context, "import", "device_observations", fileHash, { source: "zepp", count: imported });
    const counts = Object.fromEntries([...new Set(unique.map((item) => item.code))].map((code) => [code, unique.filter((item) => item.code === code).length]));
    return jsonResponse({ ok: true, imported, recognized: unique.length, filesRead: payloads.length, counts, limited: observations.length >= MAX_OBSERVATIONS });
  } catch {
    if (syncId) await env.DB.prepare("UPDATE sync_events SET status = 'failed' WHERE id = ? AND patient_id = ?")
      .bind(syncId, context.patientId).run().catch(() => undefined);
    await writeAudit(context, "import", "device_observations", syncId, { source: "zepp", status: "failed" }, "error").catch(() => undefined);
    return jsonResponse({ error: "No pudimos leer esta exportación. No se modificó tu historia." }, { status: 400 });
  }
}

function extractPayloads(name: string, bytes: Uint8Array) {
  const lower = name.toLocaleLowerCase("en-US");
  if (!lower.endsWith(".zip")) return [{ name, text: strFromU8(bytes) }];
  const archive = unzipSync(bytes);
  const result: { name: string; text: string }[] = [];
  let expanded = 0;
  for (const [entryName, content] of Object.entries(archive)) {
    if (!/\.(csv|json|txt)$/i.test(entryName) || content.length > 8 * 1024 * 1024) continue;
    expanded += content.length;
    if (expanded > MAX_EXPANDED || result.length >= 100) break;
    result.push({ name: entryName, text: strFromU8(content) });
  }
  return result;
}

function parseRows(name: string, text: string): Row[] {
  if (name.toLocaleLowerCase("en-US").endsWith(".json")) {
    try { return collectObjects(JSON.parse(text)); } catch { return []; }
  }
  return parseCsv(text);
}

function collectObjects(value: unknown, depth = 0): Row[] {
  if (depth > 7) return [];
  if (Array.isArray(value)) return value.slice(0, MAX_OBSERVATIONS).flatMap((item) => isRow(item) ? [item] : collectObjects(item, depth + 1));
  if (isRow(value)) {
    const values = Object.values(value);
    if (values.some((item) => typeof item === "string" || typeof item === "number")) return [value];
    return values.flatMap((item) => collectObjects(item, depth + 1));
  }
  return [];
}

function parseCsv(text: string): Row[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const delimiter = count(lines[0], ";") > count(lines[0], ",") ? ";" : ",";
  const headers = splitCsv(lines[0], delimiter).map(normalizeKey);
  return lines.slice(1, MAX_OBSERVATIONS + 1).map((line) => {
    const values = splitCsv(line, delimiter);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function splitCsv(line: string, delimiter: string) {
  const values: string[] = []; let current = ""; let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && quoted && line[index + 1] === '"') { current += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) { values.push(current.trim()); current = ""; }
    else current += char;
  }
  values.push(current.trim()); return values;
}

function normalizeRow(raw: Row, file: string): Observation[] {
  const row = Object.fromEntries(Object.entries(raw).map(([key, value]) => [normalizeKey(key), value]));
  const effectiveAt = parseDate(row);
  if (!effectiveAt) return [];
  const sourceType = /health.?connect/i.test(file) ? "health_connect" : "zepp";
  const filename = normalizeKey(file);
  return metrics.flatMap((metric) => {
    let key: string | undefined = metric.keys.find((candidate) => row[candidate] !== undefined && row[candidate] !== "");
    if (!key && metric.hints.some((hint) => filename.includes(hint)) && row.value !== undefined) key = "value";
    if (!key) return [];
    let value = parseNumber(row[key]);
    if (value === null) return [];
    const unit = metric.unit;
    if (metric.code.includes("sleep") && /second/.test(key)) value /= 60;
    if (metric.code.includes("sleep") && /hour/.test(key)) value *= 60;
    if (metric.code === "distance_km" && !key.includes("km") && value > 1000) value /= 1000;
    if (metric.code === "weight_kg" && !key.includes("kg") && value > 1000) value /= 1000;
    if (value < metric.min || value > metric.max) return [];
    value = Number(value.toFixed(3));
    return [{ code: metric.code, label: metric.label, value, unit, effectiveAt, sourceType, file }];
  });
}

function parseDate(row: Row) {
  const dateKey = ["timestamp", "time", "datetime", "date_time", "start_time", "starttime", "start", "date", "day"].find((key) => row[key] !== undefined && row[key] !== "");
  if (!dateKey) return null;
  const raw = String(row[dateKey]).trim();
  const numeric = Number(raw);
  const parsed = Number.isFinite(numeric) && /^\d{10,13}$/.test(raw)
    ? new Date(raw.length === 10 ? numeric * 1000 : numeric)
    : new Date(raw.includes("T") ? raw : raw.replace(" ", "T"));
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function parseNumber(value: unknown) {
  const normalized = String(value ?? "").trim().replace(/\s/g, "").replace(/,(?=\d{1,3}$)/, ".").replace(/[^\d.+-]/g, "");
  const number = Number(normalized); return Number.isFinite(number) ? number : null;
}

function normalizeKey(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""); }
function deduplicate(items: Observation[]) { const seen = new Set<string>(); return items.filter((item) => { const key = `${item.code}:${item.effectiveAt}:${item.value}`; if (seen.has(key)) return false; seen.add(key); return true; }); }
function isRow(value: unknown): value is Row { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function count(value: string, token: string) { return value.split(token).length - 1; }
