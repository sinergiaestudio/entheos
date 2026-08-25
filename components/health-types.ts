export type WeightEntry = {
  id: string;
  effective_at: string;
  weight_kg: number;
  waist_cm: number | null;
  bmi: number | null;
  source_type: string;
  verification_status: string;
};

export type PressureEntry = {
  id: string;
  effective_at: string;
  systolic: number;
  diastolic: number;
  pulse: number | null;
  series_id: string | null;
  source_type: string;
  verification_status: string;
};

export type ActivityEntry = {
  id: string;
  effective_at: string;
  activity_type: string;
  duration_minutes: number | null;
  perceived_effort: number | null;
  comments: string | null;
  source_type: string;
  verification_status: string;
};

export type SleepEntry = {
  id: string;
  effective_at: string;
  bedtime_at: string | null;
  wake_at: string | null;
  hours: number | null;
  quality: number | null;
  awakenings: number | null;
  notes: string | null;
  source_type: string;
  verification_status: string;
};

export type ClinicalFact = {
  id: string;
  category: string;
  title: string;
  details: string | null;
  dose: string | null;
  schedule: string | null;
  status: string;
  effective_at: string | null;
  end_at: string | null;
  source_type: string;
  verification_status: string;
  version: number;
};

export type SymptomEntry = {
  id: string;
  effective_at: string;
  title: string;
  body_area: string | null;
  intensity: number | null;
  status: string;
  notes: string | null;
  source_type: string;
  verification_status: string;
};

export type TimelineEvent = {
  id: string;
  effective_at: string;
  recorded_at: string;
  type: string;
  title: string;
  description: string | null;
  source_type: string;
  verification_status: string;
  relevance: number;
  tags: string[];
};

export type ClinicalHistoryItem = TimelineEvent & {
  category: string;
  source_id: string;
  details: Record<string, string | number | null>;
};

export type ClinicalDocument = {
  id: string;
  display_name: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  document_type: string;
  study_date: string | null;
  institution: string | null;
  description: string | null;
  source_type: string;
  review_status: string;
  created_at: string;
};

export type NutritionDay = {
  id: string;
  date: string;
  hydration: number | null;
  sleep_hours: number | null;
  sleep_quality: number | null;
  energy: number | null;
  hunger_anxiety: number | null;
  adherence: number | null;
};

export type AiSuggestion = {
  id: string;
  suggestion_type: string;
  title: string;
  payload: Record<string, unknown>;
  source_type: string;
  source_reference: string | null;
  model_name: string | null;
  confidence: number | null;
  status: string;
  review_notes: string | null;
  created_at: string;
};

export type AuditEntry = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  outcome: string;
  occurred_at: string;
};

export type LabPanel = {
  id: string;
  title: string;
  effective_at: string;
  institution: string | null;
  verification_status: string;
};

export type LabResult = {
  id: string;
  panel_id: string;
  analyte: string;
  result_text: string;
  result_numeric: number | null;
  unit: string | null;
  reference_range: string | null;
  flag: string | null;
  verification_status: string;
};

export type DeviceObservation = {
  id: string;
  code: string;
  value_numeric: number | null;
  value_text: string | null;
  unit: string | null;
  effective_at: string;
  recorded_at: string;
  source_type: string;
  verification_status: string;
  context: { label?: string; sourceFile?: string; importer?: string; dataOrigin?: string; device?: string; connector?: string };
};

export type Overview = {
  user: { displayName: string; email: string; isGlobalAdmin: boolean };
  profile: {
    id: string;
    display_name: string;
    birth_date: string | null;
    sex: string | null;
    gender: string | null;
    height_cm: number | null;
    blood_type: string | null;
    coverage: string | null;
    emergency_contact: string | null;
    clinical_summary: string | null;
    timezone: string;
    updated_at: string;
  } | null;
  weights: WeightEntry[];
  pressures: PressureEntry[];
  activities: ActivityEntry[];
  sleeps: SleepEntry[];
  symptoms: SymptomEntry[];
  facts: ClinicalFact[];
  timeline: TimelineEvent[];
  history: ClinicalHistoryItem[];
  documents: ClinicalDocument[];
  nutrition: {
    plan: { id: string; title: string; start_date: string; end_date: string | null; status: string; goals: string | null } | null;
    days: NutritionDay[];
  };
  suggestions: AiSuggestion[];
  audits: AuditEntry[];
  laboratory: { panels: LabPanel[]; results: LabResult[] };
  devices: {
    observations: DeviceObservation[];
    connection: { id: string; client_id: string; entity_type: string; status: "processing" | "completed" | "failed"; entity_id: string | null; created_at: string } | null;
  };
  generatedAt: string;
};

export type SaveRecord = (payload: Record<string, unknown>) => Promise<boolean>;

export function formatDate(value?: string | null, withTime = false) {
  if (!value) return "—";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-AR", withTime
    ? { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }
    : { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export function localDate() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function localDateTime() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function sourceLabel(source?: string | null, verification?: string | null) {
  if (source === "ai") return verification === "patient_confirmed" ? "Confirmado por el paciente" : "Fuente importada pendiente";
  if (source === "zepp") return "Registrado por Zepp";
  if (source === "intervals_icu") return "Importado desde Intervals.icu";
  if (source === "health_connect") return "Importado desde Health Connect";
  if (source === "device") return "Registrado por dispositivo";
  if (verification === "professional_confirmed") return "Confirmado por profesional";
  if (source === "document") return "Documento verificado";
  if (verification === "pending") return "Pendiente de revisión";
  return "Declarado por el paciente";
}
