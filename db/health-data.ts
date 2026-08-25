import { env } from "cloudflare:workers";
import {
  cleanText,
  finiteNumber,
  type ClinicalContext,
  validDate,
  validIsoDateTime,
  writeAudit,
} from "./clinical";

type AnyRow = Record<string, unknown>;

export class ClinicalInputError extends Error {}

export type ClinicalOverview = {
  user: { displayName: string; email: string; isGlobalAdmin: boolean };
  profile: AnyRow | null;
  weights: AnyRow[];
  pressures: AnyRow[];
  activities: AnyRow[];
  sleeps: AnyRow[];
  symptoms: AnyRow[];
  facts: AnyRow[];
  timeline: (AnyRow & { tags: string[] })[];
  history: (AnyRow & { tags: string[]; details: AnyRow })[];
  documents: (AnyRow & { tags: string[] })[];
  nutrition: { plan: AnyRow | null; days: AnyRow[] };
  suggestions: (AnyRow & { payload: AnyRow })[];
  audits: (AnyRow & { metadata: AnyRow })[];
  laboratory: { panels: AnyRow[]; results: AnyRow[] };
  devices: { observations: (AnyRow & { context: AnyRow })[]; connection: AnyRow | null };
  generatedAt: string;
};

function db(): D1Database {
  if (!env.DB) throw new Error("Clinical database unavailable");
  return env.DB;
}

function nowIso() {
  return new Date().toISOString();
}

function rowId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function safeJson<T>(value: unknown, fallback: T): T {
  try {
    return (typeof value === "string" ? JSON.parse(value) : value) as T;
  } catch {
    return fallback;
  }
}

export async function getOverview(context: ClinicalContext): Promise<ClinicalOverview> {
  const database = db();
  const patient = context.patientId;
  const org = context.organizationId;
  const [profile, weights, pressures, activities, sleeps, symptoms, facts, timeline, documents, nutritionPlan, nutritionDays, suggestions, audits, labPanels, labResults, observations, latestDeviceSync] = await Promise.all([
    database.prepare(`SELECT id, display_name, birth_date, sex, gender, height_cm, blood_type,
      coverage, emergency_contact, clinical_summary, timezone, updated_at
      FROM patient_profiles WHERE id = ? AND organization_id = ? AND deleted_at IS NULL`)
      .bind(patient, org).first<AnyRow>(),
    database.prepare(`SELECT id, effective_at, weight_kg, waist_cm, bmi, scale, conditions,
      source_type, verification_status FROM weight_entries
      WHERE patient_id = ? AND organization_id = ? AND deleted_at IS NULL
      ORDER BY effective_at DESC LIMIT 1000`).bind(patient, org).all<AnyRow>(),
    database.prepare(`SELECT id, effective_at, systolic, diastolic, pulse, arm, position, context,
      series_id, source_type, verification_status FROM blood_pressure_readings
      WHERE patient_id = ? AND organization_id = ? AND deleted_at IS NULL
      ORDER BY effective_at DESC LIMIT 2000`).bind(patient, org).all<AnyRow>(),
    database.prepare(`SELECT id, effective_at, activity_type, duration_minutes, distance_km,
      average_heart_rate, max_heart_rate, perceived_effort, recovery, comments,
      source_type, verification_status FROM activity_sessions
      WHERE patient_id = ? AND organization_id = ? AND deleted_at IS NULL
      ORDER BY effective_at DESC LIMIT 1000`).bind(patient, org).all<AnyRow>(),
    database.prepare(`SELECT id, effective_at, bedtime_at, wake_at, hours, quality, awakenings,
      notes, source_type, verification_status FROM sleep_entries
      WHERE patient_id = ? AND organization_id = ? AND deleted_at IS NULL
      ORDER BY effective_at DESC LIMIT 1000`).bind(patient, org).all<AnyRow>(),
    database.prepare(`SELECT id, effective_at, title, body_area, intensity, duration, frequency,
      triggers, associated_symptoms, status, notes, source_type, verification_status
      FROM symptom_entries WHERE patient_id = ? AND organization_id = ? AND deleted_at IS NULL
      ORDER BY effective_at DESC LIMIT 1000`).bind(patient, org).all<AnyRow>(),
    database.prepare(`SELECT id, category, title, details, dose, schedule, status, effective_at,
      end_at, source_type, verification_status, version FROM clinical_facts
      WHERE patient_id = ? AND organization_id = ? AND deleted_at IS NULL
      ORDER BY COALESCE(effective_at, created_at) DESC LIMIT 1000`).bind(patient, org).all<AnyRow>(),
    database.prepare(`SELECT id, effective_at, recorded_at, type, title, description, source_type,
      source_id, status, verification_status, relevance, tags_json, version
      FROM timeline_events WHERE patient_id = ? AND organization_id = ? AND deleted_at IS NULL
      ORDER BY effective_at DESC LIMIT 2000`).bind(patient, org).all<AnyRow>(),
    database.prepare(`SELECT id, display_name, original_name, mime_type, size_bytes, sha256,
      document_type, study_date, institution, professional, specialty, description,
      tags_json, source_type, review_status, version, created_at
      FROM document_references WHERE patient_id = ? AND organization_id = ? AND deleted_at IS NULL
      ORDER BY COALESCE(study_date, created_at) DESC LIMIT 1000`).bind(patient, org).all<AnyRow>(),
    database.prepare(`SELECT id, title, start_date, end_date, status, professional, goals, version
      FROM nutrition_plans WHERE patient_id = ? AND organization_id = ? AND deleted_at IS NULL
      ORDER BY start_date DESC LIMIT 1`).bind(patient, org).first<AnyRow>(),
    database.prepare(`SELECT id, plan_id, date, hydration, sleep_hours, sleep_quality, energy,
      hunger_anxiety, digestion, observations, adherence, source_type, verification_status
      FROM nutrition_days WHERE patient_id = ? AND organization_id = ? AND deleted_at IS NULL
      ORDER BY date DESC LIMIT 1000`).bind(patient, org).all<AnyRow>(),
    database.prepare(`SELECT id, suggestion_type, title, payload_json, source_type, source_reference,
      model_name, confidence, status, reviewed_at, review_notes, created_at
      FROM ai_suggestions WHERE patient_id = ? AND organization_id = ? AND deleted_at IS NULL
      ORDER BY created_at DESC LIMIT 100`).bind(patient, org).all<AnyRow>(),
    database.prepare(`SELECT id, action, entity_type, entity_id, outcome, metadata_json, occurred_at
      FROM audit_logs WHERE patient_id = ? AND organization_id = ?
      ORDER BY occurred_at DESC LIMIT 80`).bind(patient, org).all<AnyRow>(),
    database.prepare(`SELECT id, document_id, title, effective_at, institution, status,
      verification_status FROM lab_panels WHERE patient_id = ? AND organization_id = ?
      AND deleted_at IS NULL ORDER BY effective_at DESC LIMIT 1000`).bind(patient, org).all<AnyRow>(),
    database.prepare(`SELECT id, panel_id, analyte, result_text, result_numeric, unit,
      reference_range, flag, method, source_page, verification_status
      FROM lab_results WHERE patient_id = ? AND organization_id = ? AND deleted_at IS NULL
      ORDER BY created_at DESC, source_page ASC, analyte ASC LIMIT 5000`).bind(patient, org).all<AnyRow>(),
    database.prepare(`SELECT id, code, value_numeric, value_text, unit, effective_at, recorded_at,
      context_json, source_type, verification_status, created_at
      FROM observations WHERE patient_id = ? AND organization_id = ? AND deleted_at IS NULL
      ORDER BY effective_at DESC LIMIT 12000`).bind(patient, org).all<AnyRow>(),
    database.prepare(`SELECT id, client_id, entity_type, status, entity_id, created_at
      FROM sync_events WHERE patient_id = ? AND organization_id = ? AND entity_type = 'device_import'
      ORDER BY created_at DESC LIMIT 1`).bind(patient, org).first<AnyRow>(),
  ]);

  const timelineRows = timeline.results.map((row) => ({ ...row, tags: safeJson<string[]>(row.tags_json, []) }));
  const documentRows = documents.results.map((row) => ({ ...row, tags: safeJson<string[]>(row.tags_json, []) }));
  const observationRows = observations.results.map((row) => ({ ...row, context: safeJson<AnyRow>(row.context_json, {}) }));
  return {
    user: { displayName: context.displayName, email: context.email, isGlobalAdmin: context.isGlobalAdmin },
    profile: profile || null,
    weights: weights.results,
    pressures: pressures.results,
    activities: activities.results,
    sleeps: sleeps.results,
    symptoms: symptoms.results,
    facts: facts.results,
    timeline: timelineRows,
    history: buildHistory({
      weights: weights.results, pressures: pressures.results, activities: activities.results,
      sleeps: sleeps.results, symptoms: symptoms.results, facts: facts.results,
      timeline: timelineRows, documents: documentRows, nutritionDays: nutritionDays.results,
      labPanels: labPanels.results, labResults: labResults.results, observations: observationRows,
    }),
    documents: documentRows,
    nutrition: { plan: nutritionPlan || null, days: nutritionDays.results },
    suggestions: suggestions.results.map((row) => ({ ...row, payload: safeJson<AnyRow>(row.payload_json, {}) })),
    audits: audits.results.map((row) => ({ ...row, metadata: safeJson<AnyRow>(row.metadata_json, {}) })),
    laboratory: { panels: labPanels.results, results: labResults.results },
    devices: { observations: observationRows, connection: latestDeviceSync || null },
    generatedAt: nowIso(),
  };
}

type HistorySource = {
  weights: AnyRow[]; pressures: AnyRow[]; activities: AnyRow[]; sleeps: AnyRow[];
  symptoms: AnyRow[]; facts: AnyRow[]; timeline: (AnyRow & { tags: string[] })[];
  documents: (AnyRow & { tags: string[] })[]; nutritionDays: AnyRow[];
  labPanels: AnyRow[]; labResults: AnyRow[];
  observations: (AnyRow & { context: AnyRow })[];
};

function buildHistory(source: HistorySource) {
  const at = (value: unknown) => {
    const text = String(value || "");
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T12:00:00.000Z` : text || nowIso();
  };
  const item = (category: string, row: AnyRow, title: string, description: string | null, details: AnyRow, tags: string[] = []) => ({
    id: String(row.id), source_id: String(row.id), category, type: category,
    effective_at: at(row.effective_at || row.study_date || row.date || row.created_at),
    recorded_at: String(row.created_at || row.recorded_at || row.effective_at || row.date || nowIso()),
    title, description, source_type: String(row.source_type || "patient"),
    verification_status: String(row.verification_status || row.review_status || "declared"),
    relevance: 1, tags, details,
  });
  const history = [
    ...source.weights.map((row) => item("weight", row, "Peso", `${row.weight_kg} kg${row.waist_cm ? ` · cintura ${row.waist_cm} cm` : ""}`, { weight_kg: Number(row.weight_kg), waist_cm: numberOrNull(row.waist_cm), bmi: numberOrNull(row.bmi) }, ["peso"])),
    ...source.pressures.map((row) => item("blood_pressure", row, "Presión arterial", `${row.systolic}/${row.diastolic} mmHg${row.pulse ? ` · pulso ${row.pulse}` : ""}`, { systolic: Number(row.systolic), diastolic: Number(row.diastolic), pulse: numberOrNull(row.pulse), series_id: stringOrNull(row.series_id) }, ["presión arterial"])),
    ...source.activities.map((row) => item("activity", row, String(row.activity_type), row.comments ? String(row.comments) : null, { duration_minutes: numberOrNull(row.duration_minutes), perceived_effort: numberOrNull(row.perceived_effort) }, ["actividad"])),
    ...source.sleeps.map((row) => item("sleep", row, "Sueño", `${row.hours ?? "—"} h · calidad ${row.quality ?? "—"}/5`, { hours: numberOrNull(row.hours), quality: numberOrNull(row.quality), awakenings: numberOrNull(row.awakenings) }, ["sueño"])),
    ...source.symptoms.map((row) => item("symptom", row, String(row.title), row.notes ? String(row.notes) : null, { body_area: stringOrNull(row.body_area), intensity: numberOrNull(row.intensity), status: stringOrNull(row.status) }, ["síntoma"])),
    ...source.facts.map((row) => item("clinical_fact", row, String(row.title), row.details ? String(row.details) : null, { category: stringOrNull(row.category), dose: stringOrNull(row.dose), schedule: stringOrNull(row.schedule), status: stringOrNull(row.status) }, [clinicalCategoryLabel(String(row.category))])),
    ...source.documents.map((row) => item("document", row, String(row.display_name), row.description ? String(row.description) : null, { document_type: stringOrNull(row.document_type), institution: stringOrNull(row.institution), mime_type: stringOrNull(row.mime_type) }, ["documento", ...row.tags])),
    ...source.nutritionDays.map((row) => item("nutrition", row, "Seguimiento nutricional", `Adherencia ${row.adherence ?? "—"}% · hidratación ${row.hydration ?? "—"}`, { hydration: numberOrNull(row.hydration), sleep_hours: numberOrNull(row.sleep_hours), energy: numberOrNull(row.energy), hunger_anxiety: numberOrNull(row.hunger_anxiety), adherence: numberOrNull(row.adherence) }, ["nutrición"])),
    ...source.labPanels.map((row) => {
      const results = source.labResults.filter((result) => result.panel_id === row.id);
      const flagged = results.filter((result) => result.flag === "high" || result.flag === "low");
      const description = results.length
        ? `${results.length} resultados${flagged.length ? ` · ${flagged.length} marcados fuera de rango en el informe` : ""}`
        : "Panel sin resultados cargados";
      return item("laboratory", row, String(row.title), description, { institution: stringOrNull(row.institution), result_count: results.length, flagged_count: flagged.length }, ["laboratorio", "estudio"]);
    }),
    ...source.observations.map((row) => {
      const context = row.context || {};
      const label = cleanText(context.label, 120) || deviceMetricLabel(String(row.code));
      const value = row.value_numeric ?? row.value_text ?? "—";
      const source = String(row.source_type || "device");
      return item("device", row, label, `${value}${row.unit ? ` ${row.unit}` : ""}`, {
        code: String(row.code), value_numeric: numberOrNull(row.value_numeric),
        value_text: stringOrNull(row.value_text), unit: stringOrNull(row.unit),
        source_file: stringOrNull(context.sourceFile),
        data_origin: stringOrNull(context.dataOrigin),
        device: stringOrNull(context.device),
      }, [source === "health_connect" ? "Health Connect" : source === "intervals_icu" ? "Intervals.icu" : "Zepp", "dispositivo"]);
    }),
  ];
  const canonicalIds = new Set(history.map((entry) => entry.source_id));
  history.push(...source.timeline.filter((row) => !row.source_id || !canonicalIds.has(String(row.source_id))).map((row) => ({
    id: String(row.id), source_id: String(row.id), category: String(row.type || "note"), type: String(row.type || "note"),
    effective_at: at(row.effective_at), recorded_at: String(row.recorded_at || row.effective_at),
    title: String(row.title), description: row.description ? String(row.description) : null,
    source_type: String(row.source_type || "patient"), verification_status: String(row.verification_status || "declared"),
    relevance: Number(row.relevance || 1), tags: row.tags, details: {},
  })));
  return history.sort((a, b) => Date.parse(b.effective_at) - Date.parse(a.effective_at));
}

function numberOrNull(value: unknown) { return value === null || value === undefined || value === "" ? null : Number(value); }
function stringOrNull(value: unknown) { return value === null || value === undefined || value === "" ? null : String(value); }
function deviceMetricLabel(code: string) {
  return ({
    heart_rate_bpm: "Frecuencia cardíaca", resting_heart_rate_bpm: "Frecuencia cardíaca en reposo",
    hrv_ms: "Variabilidad de frecuencia cardíaca",
    steps: "Pasos", spo2_percent: "Oxígeno en sangre", stress_score: "Estrés",
    active_calories_kcal: "Calorías activas", distance_km: "Distancia",
    respiratory_rate: "Frecuencia respiratoria", vo2max: "VO₂ máx.",
    sleep_duration_minutes: "Duración del sueño", deep_sleep_minutes: "Sueño profundo",
    light_sleep_minutes: "Sueño ligero", rem_sleep_minutes: "Sueño REM", weight_kg: "Peso",
    sleep_quality_score: "Calidad de sueño", systolic_blood_pressure_mmhg: "Presión sistólica",
    diastolic_blood_pressure_mmhg: "Presión diastólica",
  } as Record<string, string>)[code] || code.replaceAll("_", " ");
}

export async function getPatientSummary(context: ClinicalContext) {
  const overview = await getOverview(context);
  const latestWeight = overview.weights[0] || null;
  const latestPressure = overview.pressures[0] || null;
  const activeSymptoms = overview.symptoms.filter((item) => item.status !== "resolved").slice(0, 10);
  const recentActivities = overview.activities.filter((item) => Date.parse(String(item.effective_at)) >= Date.now() - 7 * 86400000);
  const activePlan = overview.nutrition.plan;
  const nutritionDays = overview.nutrition.days;
  const adherence = nutritionDays.length
    ? Math.round(nutritionDays.reduce((total, item) => total + Number(item.adherence || 0), 0) / nutritionDays.length)
    : null;
  return {
    patient: {
      displayName: overview.profile?.display_name || context.displayName,
      birthDate: overview.profile?.birth_date || null,
      clinicalSummary: overview.profile?.clinical_summary || null,
    },
    latestMeasurements: { weight: latestWeight, bloodPressure: latestPressure },
    weeklyActivityMinutes: recentActivities.reduce((total, item) => total + Number(item.duration_minutes || 0), 0),
    recentSleep: overview.sleeps[0] || null,
    activeSymptoms,
    activeClinicalFacts: overview.facts.filter((item) => item.status === "active").slice(0, 20),
    nutrition: activePlan ? { plan: activePlan, recordedDays: nutritionDays.length, averageAdherence: adherence } : null,
    recentDocuments: overview.documents.slice(0, 5),
    deviceObservations: overview.devices.observations.slice(0, 30),
    provenanceNotice: "Los datos conservan su fuente y estado de validación; los originales documentales permanecen vinculados a la historia.",
    generatedAt: overview.generatedAt,
  };
}

export async function recordClinical(context: ClinicalContext, payload: AnyRow) {
  const kind = cleanText(payload.kind, 40);
  const database = db();
  const now = nowIso();
  const effectiveAt = validIsoDateTime(payload.effectiveAt) || now;

  if (kind === "weight") {
    const weight = finiteNumber(payload.weightKg, 20, 400);
    const waist = finiteNumber(payload.waistCm, 30, 250);
    if (weight === null) throw new ClinicalInputError("Ingresá un peso válido.");
    const profile = await database.prepare("SELECT height_cm FROM patient_profiles WHERE id = ? AND organization_id = ?")
      .bind(context.patientId, context.organizationId).first<{ height_cm: number | null }>();
    const bmi = profile?.height_cm ? Number((weight / ((profile.height_cm / 100) ** 2)).toFixed(2)) : null;
    const id = rowId("wei");
    const eventId = rowId("evt");
    await database.batch([
      database.prepare(`INSERT INTO weight_entries
        (id, organization_id, patient_id, effective_at, weight_kg, waist_cm, bmi, scale,
        conditions, source_type, verification_status, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'patient', 'declared', ?, ?, ?)`)
        .bind(id, context.organizationId, context.patientId, effectiveAt, weight, waist,
          bmi, cleanText(payload.scale, 80) || null, cleanText(payload.conditions, 500) || null,
          context.userId, now, now),
      database.prepare(`INSERT INTO timeline_events
        (id, organization_id, patient_id, effective_at, recorded_at, type, title, description,
        source_type, source_id, status, verification_status, visibility, relevance, tags_json,
        version, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'measurement', 'Registro de peso', ?, 'patient', ?, 'active',
        'declared', 'private', 1, '["peso"]', 1, ?, ?, ?)`)
        .bind(eventId, context.organizationId, context.patientId, effectiveAt, now,
          `${weight.toLocaleString("es-AR")} kg${waist ? ` · cintura ${waist.toLocaleString("es-AR")} cm` : ""}`,
          id, context.userId, now, now),
    ]);
    await writeAudit(context, "create", "weight_entry", id, { source: "patient" });
    return { id, eventId };
  }

  if (kind === "blood_pressure") {
    const readings = Array.isArray(payload.readings) ? payload.readings.slice(0, 3) as AnyRow[] : [];
    const valid = readings.map((reading, index) => ({
      systolic: finiteNumber(reading.systolic, 60, 260),
      diastolic: finiteNumber(reading.diastolic, 30, 180),
      pulse: finiteNumber(reading.pulse, 25, 250),
      effectiveAt: validIsoDateTime(reading.effectiveAt) || new Date(Date.parse(effectiveAt) + index * 60000).toISOString(),
      arm: cleanText(reading.arm, 20) || null,
      position: cleanText(reading.position, 40) || null,
      context: cleanText(reading.context, 120) || null,
    })).filter((reading) => reading.systolic !== null && reading.diastolic !== null);
    if (!valid.length) throw new ClinicalInputError("Ingresá al menos una medición válida.");
    const seriesId = rowId("bps");
    const ids = valid.map(() => rowId("bpr"));
    const avgS = Math.round(valid.reduce((sum, item) => sum + Number(item.systolic), 0) / valid.length);
    const avgD = Math.round(valid.reduce((sum, item) => sum + Number(item.diastolic), 0) / valid.length);
    const eventId = rowId("evt");
    const statements = valid.map((reading, index) => database.prepare(`INSERT INTO blood_pressure_readings
      (id, organization_id, patient_id, effective_at, systolic, diastolic, pulse, arm, position,
      context, series_id, source_type, verification_status, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'patient', 'declared', ?, ?, ?)`)
      .bind(ids[index], context.organizationId, context.patientId, reading.effectiveAt, reading.systolic,
        reading.diastolic, reading.pulse, reading.arm, reading.position, reading.context, seriesId,
        context.userId, now, now));
    statements.push(database.prepare(`INSERT INTO timeline_events
      (id, organization_id, patient_id, effective_at, recorded_at, type, title, description,
      source_type, source_id, status, verification_status, visibility, relevance, tags_json,
      version, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'measurement', 'Presión arterial', ?, 'patient', ?, 'active',
      'declared', 'private', 1, '["presión arterial"]', 1, ?, ?, ?)`)
      .bind(eventId, context.organizationId, context.patientId, effectiveAt, now,
        `${valid.length} medición${valid.length === 1 ? "" : "es"} · promedio ${avgS}/${avgD} mmHg`,
        seriesId, context.userId, now, now));
    await database.batch(statements);
    await writeAudit(context, "create_series", "blood_pressure_reading", seriesId, { count: valid.length, source: "patient" });
    return { seriesId, ids, eventId, average: { systolic: avgS, diastolic: avgD } };
  }

  if (kind === "activity") {
    const activityType = cleanText(payload.activityType, 100);
    if (!activityType) throw new ClinicalInputError("Indicá qué actividad realizaste.");
    const duration = finiteNumber(payload.durationMinutes, 1, 1440);
    const effort = finiteNumber(payload.perceivedEffort, 1, 10);
    const id = rowId("act");
    const eventId = rowId("evt");
    await database.batch([
      database.prepare(`INSERT INTO activity_sessions
        (id, organization_id, patient_id, effective_at, activity_type, duration_minutes,
        distance_km, perceived_effort, recovery, comments, source_type, verification_status,
        created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'patient', 'declared', ?, ?, ?)`)
        .bind(id, context.organizationId, context.patientId, effectiveAt, activityType, duration,
          finiteNumber(payload.distanceKm, 0, 1000), effort, cleanText(payload.recovery, 200) || null,
          cleanText(payload.comments, 1000) || null, context.userId, now, now),
      database.prepare(`INSERT INTO timeline_events
        (id, organization_id, patient_id, effective_at, recorded_at, type, title, description,
        source_type, source_id, status, verification_status, visibility, relevance, tags_json,
        version, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'activity', ?, ?, 'patient', ?, 'active', 'declared', 'private',
        1, '["actividad"]', 1, ?, ?, ?)`)
        .bind(eventId, context.organizationId, context.patientId, effectiveAt, now, activityType,
          duration ? `${duration} minutos${effort ? ` · esfuerzo ${effort}/10` : ""}` : null,
          id, context.userId, now, now),
    ]);
    await writeAudit(context, "create", "activity_session", id, { source: "patient" });
    return { id, eventId };
  }

  if (kind === "sleep") {
    const bedtimeAt = validIsoDateTime(payload.bedtimeAt);
    const wakeAt = validIsoDateTime(payload.wakeAt);
    let hours = finiteNumber(payload.hours, 0, 24);
    if (hours === null && bedtimeAt && wakeAt) {
      const calculated = (Date.parse(wakeAt) - Date.parse(bedtimeAt)) / 3600000;
      if (calculated >= 0 && calculated <= 24) hours = Number(calculated.toFixed(2));
    }
    if (hours === null && !bedtimeAt && !wakeAt) throw new ClinicalInputError("Indicá las horas dormidas o el horario de sueño.");
    const sleepEffectiveAt = wakeAt || validIsoDateTime(payload.effectiveAt) || effectiveAt;
    const quality = finiteNumber(payload.quality, 1, 5);
    const awakenings = finiteNumber(payload.awakenings, 0, 100);
    const id = rowId("slp");
    const eventId = rowId("evt");
    await database.batch([
      database.prepare(`INSERT INTO sleep_entries
        (id, organization_id, patient_id, effective_at, bedtime_at, wake_at, hours, quality,
        awakenings, notes, source_type, verification_status, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'patient', 'declared', ?, ?, ?)`) 
        .bind(id, context.organizationId, context.patientId, sleepEffectiveAt, bedtimeAt, wakeAt,
          hours, quality, awakenings, cleanText(payload.notes, 1200) || null, context.userId, now, now),
      database.prepare(`INSERT INTO timeline_events
        (id, organization_id, patient_id, effective_at, recorded_at, type, title, description,
        source_type, source_id, status, verification_status, visibility, relevance, tags_json,
        version, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'measurement', 'Registro de sueño', ?, 'patient', ?, 'active',
        'declared', 'private', 1, '["sueño"]', 1, ?, ?, ?)`) 
        .bind(eventId, context.organizationId, context.patientId, sleepEffectiveAt, now,
          `${hours === null ? "Duración no calculada" : `${hours.toLocaleString("es-AR")} h`}${quality ? ` · calidad ${quality}/5` : ""}`,
          id, context.userId, now, now),
    ]);
    await writeAudit(context, "create", "sleep_entry", id, { source: "patient" });
    return { id, eventId };
  }

  if (kind === "symptom") {
    const title = cleanText(payload.title, 160);
    if (!title) throw new ClinicalInputError("Describí el síntoma.");
    const id = rowId("sym");
    const eventId = rowId("evt");
    const intensity = finiteNumber(payload.intensity, 0, 10);
    const status = ["active", "improving", "resolved"].includes(String(payload.status)) ? String(payload.status) : "active";
    await database.batch([
      database.prepare(`INSERT INTO symptom_entries
        (id, organization_id, patient_id, effective_at, title, body_area, intensity, duration,
        frequency, triggers, associated_symptoms, status, notes, source_type, verification_status,
        created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'patient', 'declared', ?, ?, ?)`)
        .bind(id, context.organizationId, context.patientId, effectiveAt, title,
          cleanText(payload.bodyArea, 100) || null, intensity, cleanText(payload.duration, 100) || null,
          cleanText(payload.frequency, 100) || null, cleanText(payload.triggers, 500) || null,
          cleanText(payload.associatedSymptoms, 500) || null, status,
          cleanText(payload.notes, 1500) || null, context.userId, now, now),
      database.prepare(`INSERT INTO timeline_events
        (id, organization_id, patient_id, effective_at, recorded_at, type, title, description,
        source_type, source_id, status, verification_status, visibility, relevance, tags_json,
        version, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'symptom', ?, ?, 'patient', ?, 'active', 'declared', 'private',
        2, '["síntoma"]', 1, ?, ?, ?)`)
        .bind(eventId, context.organizationId, context.patientId, effectiveAt, now, title,
          intensity === null ? null : `Intensidad declarada: ${intensity}/10`, id, context.userId, now, now),
    ]);
    await writeAudit(context, "create", "symptom_entry", id, { source: "patient", status });
    return { id, eventId };
  }

  if (kind === "clinical_fact") {
    const allowedCategories = ["condition", "medication", "allergy", "family_history", "procedure", "vaccination", "habit", "risk", "treatment", "other"];
    const category = allowedCategories.includes(String(payload.category)) ? String(payload.category) : "other";
    const title = cleanText(payload.title, 180);
    if (!title) throw new ClinicalInputError("Agregá un nombre o descripción breve.");
    const allowedStatuses = ["active", "inactive", "resolved", "historical", "suspected"];
    const status = allowedStatuses.includes(String(payload.status)) ? String(payload.status) : "active";
    const factEffectiveAt = validDate(payload.effectiveAt) || validIsoDateTime(payload.effectiveAt);
    const endAt = validDate(payload.endAt) || validIsoDateTime(payload.endAt);
    const id = rowId("cft");
    const eventId = rowId("evt");
    await database.batch([
      database.prepare(`INSERT INTO clinical_facts
        (id, organization_id, patient_id, category, title, details, dose, schedule, status,
        effective_at, end_at, source_type, verification_status, version, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'patient', 'declared', 1, ?, ?, ?)`) 
        .bind(id, context.organizationId, context.patientId, category, title,
          cleanText(payload.details, 2000) || null, cleanText(payload.dose, 120) || null,
          cleanText(payload.schedule, 200) || null, status, factEffectiveAt, endAt,
          context.userId, now, now),
      database.prepare(`INSERT INTO timeline_events
        (id, organization_id, patient_id, effective_at, recorded_at, type, title, description,
        source_type, source_id, status, verification_status, visibility, relevance, tags_json,
        version, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'note', ?, ?, 'patient', ?, 'active', 'declared', 'private',
        2, ?, 1, ?, ?, ?)`) 
        .bind(eventId, context.organizationId, context.patientId,
          factEffectiveAt ? (factEffectiveAt.length === 10 ? `${factEffectiveAt}T12:00:00.000Z` : factEffectiveAt) : now,
          now, `${clinicalCategoryLabel(category)}: ${title}`,
          cleanText(payload.details, 2000) || null, id, JSON.stringify([clinicalCategoryLabel(category)]),
          context.userId, now, now),
    ]);
    await writeAudit(context, "create", "clinical_fact", id, { source: "patient", status });
    return { id, eventId };
  }

  if (kind === "timeline") {
    const title = cleanText(payload.title, 200);
    const type = cleanText(payload.eventType, 50) || "note";
    if (!title) throw new ClinicalInputError("Agregá un título.");
    const id = rowId("evt");
    await database.prepare(`INSERT INTO timeline_events
      (id, organization_id, patient_id, effective_at, recorded_at, type, title, description,
      source_type, status, verification_status, visibility, relevance, tags_json, version,
      created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'patient', 'active', 'declared', 'private', ?, ?, 1, ?, ?, ?)`)
      .bind(id, context.organizationId, context.patientId, effectiveAt, now, type, title,
        cleanText(payload.description, 4000) || null, finiteNumber(payload.relevance, 1, 3) || 1,
        JSON.stringify(String(payload.tags || "").split(",").map((item) => cleanText(item, 40)).filter(Boolean).slice(0, 12)),
        context.userId, now, now).run();
    await writeAudit(context, "create", "timeline_event", id, { source: "patient" });
    return { id };
  }

  if (kind === "nutrition_day") {
    const date = validDate(payload.date);
    if (!date) throw new ClinicalInputError("Seleccioná una fecha válida.");
    const requestedPlanId = cleanText(payload.planId, 100);
    let plan = requestedPlanId
      ? await database.prepare(`SELECT id FROM nutrition_plans
          WHERE id = ? AND patient_id = ? AND organization_id = ? AND deleted_at IS NULL`)
          .bind(requestedPlanId, context.patientId, context.organizationId).first<{ id: string }>()
      : await database.prepare(`SELECT id FROM nutrition_plans
          WHERE patient_id = ? AND organization_id = ? AND status = 'active' AND deleted_at IS NULL
          ORDER BY start_date DESC LIMIT 1`).bind(context.patientId, context.organizationId).first<{ id: string }>();
    if (!plan) {
      const planId = rowId("npl");
      await database.prepare(`INSERT INTO nutrition_plans
        (id, organization_id, patient_id, title, start_date, status, goals, version, created_by, created_at, updated_at)
        VALUES (?, ?, ?, 'Primer ciclo nutricional', ?, 'active', 'Constancia, hidratación y organización', 1, ?, ?, ?)`)
        .bind(planId, context.organizationId, context.patientId, date, context.userId, now, now).run();
      plan = { id: planId };
    }
    const meals = Array.isArray(payload.meals) ? payload.meals.slice(0, 8) as AnyRow[] : [];
    const scores: Record<string, number> = { done: 1, partial: 0.7, replaced: 0.7, missed: 0 };
    const scored = meals.map((meal) => scores[String(meal.status)]).filter((value) => value !== undefined);
    const adherence = scored.length ? Number((scored.reduce((a, b) => a + b, 0) / scored.length * 100).toFixed(1)) : null;
    const existing = await database.prepare("SELECT id FROM nutrition_days WHERE plan_id = ? AND date = ?")
      .bind(plan.id, date).first<{ id: string }>();
    const dayId = existing?.id || rowId("ndy");
    const statements: D1PreparedStatement[] = [
      database.prepare(`INSERT INTO nutrition_days
        (id, organization_id, patient_id, plan_id, date, hydration, sleep_hours, sleep_quality,
        energy, hunger_anxiety, digestion, observations, adherence, source_type,
        verification_status, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'patient', 'declared', ?, ?, ?)
        ON CONFLICT(plan_id, date) DO UPDATE SET hydration = excluded.hydration,
        sleep_hours = excluded.sleep_hours, sleep_quality = excluded.sleep_quality,
        energy = excluded.energy, hunger_anxiety = excluded.hunger_anxiety,
        digestion = excluded.digestion, observations = excluded.observations,
        adherence = excluded.adherence, updated_at = excluded.updated_at`)
        .bind(dayId, context.organizationId, context.patientId, plan.id, date,
          finiteNumber(payload.hydration, 1, 4), finiteNumber(payload.sleepHours, 0, 24),
          finiteNumber(payload.sleepQuality, 1, 5), finiteNumber(payload.energy, 1, 5),
          finiteNumber(payload.hungerAnxiety, 1, 5), cleanText(payload.digestion, 80) || null,
          cleanText(payload.observations, 2000) || null, adherence, context.userId, now, now),
      database.prepare("DELETE FROM nutrition_meals WHERE nutrition_day_id = ?").bind(dayId),
    ];
    for (const meal of meals) {
      const mealKey = cleanText(meal.mealKey, 40);
      if (!mealKey) continue;
      statements.push(database.prepare(`INSERT INTO nutrition_meals
        (id, nutrition_day_id, meal_key, time_label, status, structure, foods_json, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(rowId("nml"), dayId, mealKey, cleanText(meal.timeLabel, 20) || null,
          cleanText(meal.status, 20) || null, cleanText(meal.structure, 80) || null,
          JSON.stringify(meal.foods && typeof meal.foods === "object" ? meal.foods : {}),
          cleanText(meal.notes, 800) || null, now, now));
    }
    await database.batch(statements);
    await writeAudit(context, existing ? "update" : "create", "nutrition_day", dayId, { source: "patient" });
    return { id: dayId, adherence };
  }

  if (kind === "lab_result") {
    const analyte = cleanText(payload.analyte, 160);
    const resultText = cleanText(payload.resultText, 120);
    const date = validDate(payload.date);
    if (!analyte || !resultText || !date) throw new ClinicalInputError("Completá estudio, resultado y fecha.");
    const panelId = rowId("lab");
    const resultId = rowId("lbr");
    await database.batch([
      database.prepare(`INSERT INTO lab_panels
        (id, organization_id, patient_id, title, effective_at, institution, status,
        verification_status, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'final', 'declared', ?, ?, ?)`)
        .bind(panelId, context.organizationId, context.patientId,
          cleanText(payload.panelTitle, 200) || "Laboratorio manual", date,
          cleanText(payload.institution, 160) || null, context.userId, now, now),
      database.prepare(`INSERT INTO lab_results
        (id, organization_id, patient_id, panel_id, analyte, result_text, result_numeric,
        unit, reference_range, flag, method, verification_status, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'declared', ?, ?, ?)`)
        .bind(resultId, context.organizationId, context.patientId, panelId, analyte, resultText,
          finiteNumber(payload.resultNumeric, -1000000, 1000000), cleanText(payload.unit, 40) || null,
          cleanText(payload.referenceRange, 120) || null,
          ["low", "normal", "high"].includes(String(payload.flag)) ? String(payload.flag) : null,
          cleanText(payload.method, 120) || null, context.userId, now, now),
    ]);
    await writeAudit(context, "create", "lab_result", resultId, { source: "patient" });
    return { panelId, resultId };
  }

  if (kind === "profile") {
    const birthDate = validDate(payload.birthDate);
    const height = finiteNumber(payload.heightCm, 50, 260);
    const sex = ["masculino", "femenino", "no_informar"].includes(String(payload.sex)) ? String(payload.sex) : null;
    await database.prepare(`UPDATE patient_profiles SET birth_date = ?, sex = ?, gender = ?,
      height_cm = ?, blood_type = ?, coverage = ?, emergency_contact = ?, clinical_summary = ?,
      updated_at = ? WHERE id = ? AND organization_id = ?`)
      .bind(birthDate, sex, null,
        height, cleanText(payload.bloodType, 20) || null, cleanText(payload.coverage, 160) || null,
        cleanText(payload.emergencyContact, 240) || null, cleanText(payload.clinicalSummary, 4000) || null,
        now, context.patientId, context.organizationId).run();
    await writeAudit(context, "update", "patient_profile", context.patientId, { source: "patient" });
    return { id: context.patientId };
  }

  throw new ClinicalInputError("Tipo de registro no admitido.");
}

export async function searchClinical(context: ClinicalContext, queryValue: unknown, origin: string) {
  const query = cleanText(queryValue, 160);
  if (!query) return [];
  const normalized = query.toLocaleLowerCase("es-AR");
  const overview = await getOverview(context);
  return overview.history.filter((entry) => JSON.stringify(entry).toLocaleLowerCase("es-AR").includes(normalized)).slice(0, 20).map((entry) => ({
    id: `history:${entry.category}:${entry.id}`,
    title: String(entry.title),
    url: `${origin}/?item=${encodeURIComponent(`history:${entry.category}:${entry.id}`)}`,
  }));
}

export async function fetchClinical(context: ClinicalContext, itemId: unknown, origin: string) {
  const value = cleanText(itemId, 220);
  const [kind, category, historyId] = value.split(":", 3);
  if (kind === "history" && category && historyId) {
    const overview = await getOverview(context);
    const row = overview.history.find((entry) => entry.category === category && entry.id === historyId);
    if (!row) return null;
    return { id: value, title: String(row.title), text: [row.description, `Fecha clínica: ${row.effective_at}`, `Fuente: ${row.source_type}`, `Validación: ${row.verification_status}`].filter(Boolean).join("\n"), url: `${origin}/?item=${encodeURIComponent(value)}`, metadata: row };
  }
  const id = category;
  if (!id) return null;
  if (kind === "event") {
    const row = await db().prepare(`SELECT id, title, description, effective_at, recorded_at, type,
      source_type, verification_status, status FROM timeline_events
      WHERE id = ? AND patient_id = ? AND organization_id = ? AND deleted_at IS NULL`)
      .bind(id, context.patientId, context.organizationId).first<AnyRow>();
    if (!row) return null;
    return {
      id: value,
      title: String(row.title),
      text: [row.description, `Fecha clínica: ${row.effective_at}`, `Fuente: ${row.source_type}`, `Validación: ${row.verification_status}`].filter(Boolean).join("\n"),
      url: `${origin}/?item=event:${encodeURIComponent(id)}`,
      metadata: row,
    };
  }
  if (kind === "document") {
    const row = await db().prepare(`SELECT id, display_name, description, study_date, document_type,
      institution, professional, source_type, review_status FROM document_references
      WHERE id = ? AND patient_id = ? AND organization_id = ? AND deleted_at IS NULL`)
      .bind(id, context.patientId, context.organizationId).first<AnyRow>();
    if (!row) return null;
    return {
      id: value,
      title: String(row.display_name),
      text: [row.description, `Tipo: ${row.document_type}`, row.study_date && `Fecha: ${row.study_date}`, row.institution && `Institución: ${row.institution}`, `Fuente: ${row.source_type}`, `Revisión: ${row.review_status}`].filter(Boolean).join("\n"),
      url: `${origin}/?item=document:${encodeURIComponent(id)}`,
      metadata: row,
    };
  }
  return null;
}

function clinicalCategoryLabel(value: string) {
  return ({
    condition: "Antecedente o condición",
    medication: "Medicación",
    allergy: "Alergia",
    family_history: "Antecedente familiar",
    procedure: "Procedimiento",
    vaccination: "Vacunación",
    habit: "Hábito",
    risk: "Factor de riesgo",
    treatment: "Tratamiento",
    other: "Dato clínico",
  } as Record<string, string>)[value] || "Dato clínico";
}
