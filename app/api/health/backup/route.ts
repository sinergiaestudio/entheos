import { env } from "cloudflare:workers";
import {
  authorizeClinicalRequest,
  jsonResponse,
  sameOrigin,
  sha256,
  unauthorizedResponse,
  writeAudit,
} from "@/db/clinical";
import { getOverview, recordClinical } from "@/db/health-data";

type Backup = {
  format?: string;
  version?: number;
  exportedAt?: string;
  data?: Record<string, unknown>;
};

export async function GET(request: Request) {
  const context = await authorizeClinicalRequest(request, ["health.read"]);
  if (!context) return unauthorizedResponse();
  const overview = await getOverview(context);
  const meals = await env.DB.prepare(`SELECT m.* FROM nutrition_meals m
    JOIN nutrition_days d ON d.id = m.nutrition_day_id
    WHERE d.patient_id = ? AND d.organization_id = ? AND d.deleted_at IS NULL`)
    .bind(context.patientId, context.organizationId).all();
  const backup = {
    format: "mi-salud-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: { ...overview, user: undefined, audits: undefined, nutritionMeals: meals.results },
    notes: ["Los archivos originales se exportan por separado.", "Las propuestas de IA conservan su estado de revisión."],
  };
  await writeAudit(context, "export", "backup", null, { format: "json" });
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "content-disposition": `attachment; filename="entheos-respaldo-${new Date().toISOString().slice(0, 10)}.json"`,
    "cache-control": "no-store",
  });
  return new Response(JSON.stringify(backup, null, 2), { headers });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonResponse({ error: "Solicitud no permitida." }, { status: 403 });
  const context = await authorizeClinicalRequest(request, ["observations.write"]);
  if (!context) return unauthorizedResponse("observations.write");
  const payload = await request.json() as { mode?: string; backup?: Backup };
  const backup = payload.backup;
  if (!backup || backup.format !== "mi-salud-backup" || backup.version !== 1 || !backup.data) {
    return jsonResponse({ error: "El respaldo no pertenece a Entheos o tiene una versión incompatible." }, { status: 400 });
  }
  const counts = backupCounts(backup.data);
  if (payload.mode !== "apply") return jsonResponse({
    valid: true,
    counts,
    warnings: [
      "La restauración agrega registros; no reemplaza silenciosamente la historia existente.",
      "Los archivos originales de documentos deben volver a cargarse por separado.",
      "Las propuestas de IA y el registro de auditoría no se restauran desde este JSON.",
    ],
  });
  const fingerprint = await sha256(JSON.stringify(backup));
  const restoreKey = `restore:${fingerprint}`;
  const already = await env.DB.prepare(`SELECT id, status FROM sync_events
    WHERE patient_id = ? AND idempotency_key = ?`)
    .bind(context.patientId, restoreKey).first<{ id: string; status: string }>();
  if (already?.status === "completed") return jsonResponse({ error: "Este respaldo ya fue restaurado." }, { status: 409 });
  if (already) return jsonResponse({ error: "Existe un intento incompleto de este respaldo. Revisá la historia antes de intentar otra importación." }, { status: 409 });

  const syncId = `syn_${crypto.randomUUID()}`;
  await env.DB.prepare(`INSERT INTO sync_events
    (id, organization_id, patient_id, client_id, idempotency_key, entity_type, status, payload_hash, created_at)
    VALUES (?, ?, ?, 'backup-import', ?, 'backup', 'processing', ?, ?)`) 
    .bind(syncId, context.organizationId, context.patientId, restoreKey, fingerprint, new Date().toISOString()).run();

  const data = backup.data as Record<string, unknown>;
  try {
  const profile = objectOf(data.profile);
  if (profile) {
    await recordClinical(context, {
      kind: "profile",
      birthDate: profile.birth_date,
      sex: profile.sex,
      gender: profile.gender,
      heightCm: profile.height_cm,
      bloodType: profile.blood_type,
      coverage: profile.coverage,
      emergencyContact: profile.emergency_contact,
      clinicalSummary: profile.clinical_summary,
    });
  }
  for (const item of arrayOf(data.weights, 500)) {
    await recordClinical(context, { kind: "weight", effectiveAt: item.effective_at, weightKg: item.weight_kg, waistCm: item.waist_cm, scale: item.scale, conditions: item.conditions });
  }
  const pressureGroups = new Map<string, Record<string, unknown>[]>();
  for (const item of arrayOf(data.pressures, 800)) {
    const key = String(item.series_id || item.effective_at || crypto.randomUUID());
    pressureGroups.set(key, [...(pressureGroups.get(key) || []), item]);
  }
  for (const readings of pressureGroups.values()) {
    await recordClinical(context, { kind: "blood_pressure", effectiveAt: readings[0]?.effective_at, readings: readings.map((item) => ({
      systolic: item.systolic, diastolic: item.diastolic, pulse: item.pulse, effectiveAt: item.effective_at,
      arm: item.arm, position: item.position, context: item.context,
    })) });
  }
  for (const item of arrayOf(data.activities, 500)) {
    await recordClinical(context, { kind: "activity", effectiveAt: item.effective_at, activityType: item.activity_type, durationMinutes: item.duration_minutes, distanceKm: item.distance_km, perceivedEffort: item.perceived_effort, recovery: item.recovery, comments: item.comments });
  }
  for (const item of arrayOf(data.sleeps, 500)) {
    await recordClinical(context, { kind: "sleep", effectiveAt: item.effective_at, bedtimeAt: item.bedtime_at, wakeAt: item.wake_at, hours: item.hours, quality: item.quality, awakenings: item.awakenings, notes: item.notes });
  }
  for (const item of arrayOf(data.symptoms, 500)) {
    await recordClinical(context, { kind: "symptom", effectiveAt: item.effective_at, title: item.title, bodyArea: item.body_area, intensity: item.intensity, duration: item.duration, frequency: item.frequency, triggers: item.triggers, associatedSymptoms: item.associated_symptoms, status: item.status, notes: item.notes });
  }
  for (const item of arrayOf(data.facts, 500)) {
    await recordClinical(context, { kind: "clinical_fact", category: item.category, title: item.title, details: item.details, dose: item.dose, schedule: item.schedule, status: item.status, effectiveAt: item.effective_at, endAt: item.end_at });
  }
  const nutrition = objectOf(data.nutrition);
  const mealsByDay = new Map<string, Record<string, unknown>[]>();
  for (const meal of arrayOf(data.nutritionMeals, 2000)) {
    const dayId = String(meal.nutrition_day_id || "");
    if (dayId) mealsByDay.set(dayId, [...(mealsByDay.get(dayId) || []), meal]);
  }
  for (const day of arrayOf(nutrition?.days, 500)) {
    await recordClinical(context, {
      kind: "nutrition_day",
      date: day.date,
      hydration: day.hydration,
      sleepHours: day.sleep_hours,
      sleepQuality: day.sleep_quality,
      energy: day.energy,
      hungerAnxiety: day.hunger_anxiety,
      digestion: day.digestion,
      observations: day.observations,
      meals: (mealsByDay.get(String(day.id)) || []).map((meal) => ({ mealKey: meal.meal_key, timeLabel: meal.time_label, status: meal.status, structure: meal.structure, foods: parseJsonObject(meal.foods_json), notes: meal.notes })),
    });
  }
  const laboratory = objectOf(data.laboratory);
  const panels = new Map(arrayOf(laboratory?.panels, 500).map((panel) => [String(panel.id), panel]));
  for (const result of arrayOf(laboratory?.results, 2000)) {
    const panel = panels.get(String(result.panel_id));
    if (!panel) continue;
    await recordClinical(context, { kind: "lab_result", date: String(panel.effective_at || "").slice(0, 10), panelTitle: panel.title, institution: panel.institution, analyte: result.analyte, resultText: result.result_text, resultNumeric: result.result_numeric, unit: result.unit, referenceRange: result.reference_range, flag: result.flag, method: result.method });
  }
  for (const item of arrayOf(data.timeline, 1000).filter((event) => !event.source_id && event.type !== "measurement")) {
    await recordClinical(context, { kind: "timeline", effectiveAt: item.effective_at, eventType: item.type, title: item.title, description: item.description, relevance: item.relevance, tags: Array.isArray(item.tags) ? item.tags.join(",") : "" });
  }
  } catch {
    await env.DB.prepare("UPDATE sync_events SET status = 'failed' WHERE id = ? AND patient_id = ?")
      .bind(syncId, context.patientId).run();
    await writeAudit(context, "restore", "backup", null, { format: "json", status: "failed" }, "error");
    return jsonResponse({ error: "La restauración se detuvo. Revisá la historia antes de volver a importar para evitar duplicados." }, { status: 409 });
  }
  await env.DB.prepare("UPDATE sync_events SET status = 'completed' WHERE id = ? AND patient_id = ?")
    .bind(syncId, context.patientId).run();
  await writeAudit(context, "restore", "backup", null, { format: "json", count: Object.values(counts).reduce((a, b) => a + b, 0) });
  return jsonResponse({ ok: true, counts });
}

function arrayOf(value: unknown, limit: number): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")).slice(0, limit) : [];
}

function objectOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function parseJsonObject(value: unknown) {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return objectOf(parsed) || {};
  } catch {
    return {};
  }
}

function backupCounts(data: Record<string, unknown>) {
  return {
    weights: arrayOf(data.weights, 10000).length,
    pressures: arrayOf(data.pressures, 10000).length,
    activities: arrayOf(data.activities, 10000).length,
    sleeps: arrayOf(data.sleeps, 10000).length,
    symptoms: arrayOf(data.symptoms, 10000).length,
    clinicalFacts: arrayOf(data.facts, 10000).length,
    timeline: arrayOf(data.timeline, 10000).length,
    documents: arrayOf(data.documents, 10000).length,
    nutritionDays: Array.isArray((data.nutrition as Record<string, unknown> | undefined)?.days) ? ((data.nutrition as Record<string, unknown>).days as unknown[]).length : 0,
    laboratoryResults: Array.isArray((data.laboratory as Record<string, unknown> | undefined)?.results) ? ((data.laboratory as Record<string, unknown>).results as unknown[]).length : 0,
  };
}
