import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  deletedAt: text("deleted_at"),
};

// Legacy tables are intentionally retained for a lossless, user-confirmed migration.
export const familyUsers = sqliteTable(
  "family_users",
  {
    id: text("id").primaryKey(),
    displayName: text("display_name").notNull(),
    nameKey: text("name_key").notNull(),
    passwordHash: text("password_hash").notNull(),
    passwordSalt: text("password_salt").notNull(),
    passwordIterations: integer("password_iterations").notNull().default(100000),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("family_users_name_key_idx").on(table.nameKey)],
);

export const familySessions = sqliteTable(
  "family_sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id").notNull().references(() => familyUsers.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("family_sessions_user_idx").on(table.userId),
    index("family_sessions_expiry_idx").on(table.expiresAt),
  ],
);

export const nutritionData = sqliteTable("nutrition_data", {
  userId: text("user_id").primaryKey().references(() => familyUsers.id, { onDelete: "cascade" }),
  payload: text("payload").notNull().default("{}"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    status: text("status").notNull().default("active"),
    lastLoginAt: text("last_login_at"),
    ...timestamps,
  },
  (table) => [uniqueIndex("users_email_idx").on(table.email)],
);

export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  mode: text("mode").notNull().default("individual"),
  ...timestamps,
});

export const memberships = sqliteTable(
  "memberships",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organizations.id),
    userId: text("user_id").notNull().references(() => users.id),
    role: text("role").notNull().default("patient_admin"),
    status: text("status").notNull().default("active"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("memberships_org_user_idx").on(table.organizationId, table.userId),
    index("memberships_user_idx").on(table.userId),
  ],
);

export const patientProfiles = sqliteTable(
  "patient_profiles",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organizations.id),
    ownerUserId: text("owner_user_id").notNull().references(() => users.id),
    displayName: text("display_name").notNull(),
    birthDate: text("birth_date"),
    sex: text("sex"),
    gender: text("gender"),
    heightCm: real("height_cm"),
    bloodType: text("blood_type"),
    coverage: text("coverage"),
    emergencyContact: text("emergency_contact"),
    clinicalSummary: text("clinical_summary"),
    timezone: text("timezone").notNull().default("America/Argentina/Buenos_Aires"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("patient_profiles_owner_idx").on(table.ownerUserId),
    index("patient_profiles_org_idx").on(table.organizationId),
  ],
);

export const careTeam = sqliteTable("care_team", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  patientId: text("patient_id").notNull(),
  professionalUserId: text("professional_user_id"),
  displayName: text("display_name").notNull(),
  specialty: text("specialty"),
  registration: text("registration"),
  institution: text("institution"),
  contact: text("contact"),
  status: text("status").notNull().default("inactive"),
  ...timestamps,
});

export const accessGrants = sqliteTable("access_grants", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  patientId: text("patient_id").notNull(),
  grantedToUserId: text("granted_to_user_id"),
  role: text("role").notNull(),
  modulesJson: text("modules_json").notNull().default("[]"),
  permission: text("permission").notNull().default("read"),
  startsAt: text("starts_at"),
  expiresAt: text("expires_at"),
  revokedAt: text("revoked_at"),
  ...timestamps,
});

export const encounters = sqliteTable("encounters", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  patientId: text("patient_id").notNull(),
  effectiveAt: text("effective_at").notNull(),
  professionalName: text("professional_name"),
  specialty: text("specialty"),
  institution: text("institution"),
  reason: text("reason"),
  summary: text("summary"),
  diagnosis: text("diagnosis"),
  indications: text("indications"),
  nextControlAt: text("next_control_at"),
  sourceType: text("source_type").notNull().default("patient"),
  verificationStatus: text("verification_status").notNull().default("declared"),
  createdBy: text("created_by").notNull(),
  ...timestamps,
});

export const timelineEvents = sqliteTable(
  "timeline_events",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    patientId: text("patient_id").notNull(),
    effectiveAt: text("effective_at").notNull(),
    recordedAt: text("recorded_at").notNull(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    sourceType: text("source_type").notNull().default("patient"),
    sourceId: text("source_id"),
    status: text("status").notNull().default("active"),
    verificationStatus: text("verification_status").notNull().default("declared"),
    visibility: text("visibility").notNull().default("private"),
    relevance: integer("relevance").notNull().default(1),
    tagsJson: text("tags_json").notNull().default("[]"),
    version: integer("version").notNull().default(1),
    supersedesId: text("supersedes_id"),
    createdBy: text("created_by").notNull(),
    ...timestamps,
  },
  (table) => [
    index("timeline_patient_effective_idx").on(table.patientId, table.effectiveAt),
    index("timeline_patient_type_idx").on(table.patientId, table.type),
  ],
);

export const measurementTypes = sqliteTable("measurement_types", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  label: text("label").notNull(),
  unit: text("unit"),
  category: text("category").notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("measurement_types_code_idx").on(table.code)]);

export const observations = sqliteTable(
  "observations",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    patientId: text("patient_id").notNull(),
    measurementTypeId: text("measurement_type_id"),
    code: text("code").notNull(),
    valueNumeric: real("value_numeric"),
    valueText: text("value_text"),
    unit: text("unit"),
    effectiveAt: text("effective_at").notNull(),
    recordedAt: text("recorded_at").notNull(),
    contextJson: text("context_json").notNull().default("{}"),
    sourceType: text("source_type").notNull().default("patient"),
    sourceId: text("source_id"),
    status: text("status").notNull().default("final"),
    confidence: real("confidence"),
    verificationStatus: text("verification_status").notNull().default("declared"),
    version: integer("version").notNull().default(1),
    supersedesId: text("supersedes_id"),
    createdBy: text("created_by").notNull(),
    ...timestamps,
  },
  (table) => [index("observations_patient_code_time_idx").on(table.patientId, table.code, table.effectiveAt)],
);

export const weightEntries = sqliteTable(
  "weight_entries",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    patientId: text("patient_id").notNull(),
    effectiveAt: text("effective_at").notNull(),
    weightKg: real("weight_kg").notNull(),
    waistCm: real("waist_cm"),
    bmi: real("bmi"),
    scale: text("scale"),
    conditions: text("conditions"),
    sourceType: text("source_type").notNull().default("patient"),
    verificationStatus: text("verification_status").notNull().default("declared"),
    createdBy: text("created_by").notNull(),
    ...timestamps,
  },
  (table) => [index("weight_patient_time_idx").on(table.patientId, table.effectiveAt)],
);

export const bloodPressureReadings = sqliteTable(
  "blood_pressure_readings",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    patientId: text("patient_id").notNull(),
    effectiveAt: text("effective_at").notNull(),
    systolic: integer("systolic").notNull(),
    diastolic: integer("diastolic").notNull(),
    pulse: integer("pulse"),
    arm: text("arm"),
    position: text("position"),
    context: text("context"),
    seriesId: text("series_id"),
    sourceType: text("source_type").notNull().default("patient"),
    verificationStatus: text("verification_status").notNull().default("declared"),
    createdBy: text("created_by").notNull(),
    ...timestamps,
  },
  (table) => [index("blood_pressure_patient_time_idx").on(table.patientId, table.effectiveAt)],
);

export const activitySessions = sqliteTable(
  "activity_sessions",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    patientId: text("patient_id").notNull(),
    effectiveAt: text("effective_at").notNull(),
    activityType: text("activity_type").notNull(),
    durationMinutes: integer("duration_minutes"),
    distanceKm: real("distance_km"),
    averageHeartRate: integer("average_heart_rate"),
    maxHeartRate: integer("max_heart_rate"),
    perceivedEffort: integer("perceived_effort"),
    recovery: text("recovery"),
    comments: text("comments"),
    sourceType: text("source_type").notNull().default("patient"),
    verificationStatus: text("verification_status").notNull().default("declared"),
    createdBy: text("created_by").notNull(),
    ...timestamps,
  },
  (table) => [index("activity_patient_time_idx").on(table.patientId, table.effectiveAt)],
);

export const sleepEntries = sqliteTable("sleep_entries", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  patientId: text("patient_id").notNull(),
  effectiveAt: text("effective_at").notNull(),
  bedtimeAt: text("bedtime_at"),
  wakeAt: text("wake_at"),
  hours: real("hours"),
  quality: integer("quality"),
  awakenings: integer("awakenings"),
  notes: text("notes"),
  sourceType: text("source_type").notNull().default("patient"),
  verificationStatus: text("verification_status").notNull().default("declared"),
  createdBy: text("created_by").notNull(),
  ...timestamps,
});

export const symptomEntries = sqliteTable(
  "symptom_entries",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    patientId: text("patient_id").notNull(),
    effectiveAt: text("effective_at").notNull(),
    title: text("title").notNull(),
    bodyArea: text("body_area"),
    intensity: integer("intensity"),
    duration: text("duration"),
    frequency: text("frequency"),
    triggers: text("triggers"),
    associatedSymptoms: text("associated_symptoms"),
    status: text("status").notNull().default("active"),
    notes: text("notes"),
    sourceType: text("source_type").notNull().default("patient"),
    verificationStatus: text("verification_status").notNull().default("declared"),
    createdBy: text("created_by").notNull(),
    ...timestamps,
  },
  (table) => [index("symptoms_patient_time_idx").on(table.patientId, table.effectiveAt)],
);

export const clinicalFacts = sqliteTable(
  "clinical_facts",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    patientId: text("patient_id").notNull(),
    category: text("category").notNull(),
    title: text("title").notNull(),
    details: text("details"),
    dose: text("dose"),
    schedule: text("schedule"),
    status: text("status").notNull().default("active"),
    effectiveAt: text("effective_at"),
    endAt: text("end_at"),
    sourceType: text("source_type").notNull().default("patient"),
    sourceId: text("source_id"),
    verificationStatus: text("verification_status").notNull().default("declared"),
    confidence: real("confidence"),
    version: integer("version").notNull().default(1),
    supersedesId: text("supersedes_id"),
    createdBy: text("created_by").notNull(),
    ...timestamps,
  },
  (table) => [index("clinical_facts_patient_category_idx").on(table.patientId, table.category)],
);

export const documentReferences = sqliteTable(
  "document_references",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    patientId: text("patient_id").notNull(),
    r2Key: text("r2_key").notNull(),
    originalName: text("original_name").notNull(),
    displayName: text("display_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    documentType: text("document_type").notNull(),
    studyDate: text("study_date"),
    institution: text("institution"),
    professional: text("professional"),
    specialty: text("specialty"),
    description: text("description"),
    tagsJson: text("tags_json").notNull().default("[]"),
    sourceType: text("source_type").notNull().default("patient"),
    reviewStatus: text("review_status").notNull().default("pending"),
    version: integer("version").notNull().default(1),
    createdBy: text("created_by").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("documents_patient_hash_idx").on(table.patientId, table.sha256),
    index("documents_patient_study_idx").on(table.patientId, table.studyDate),
  ],
);

export const documentVersions = sqliteTable("document_versions", {
  id: text("id").primaryKey(),
  documentId: text("document_id").notNull().references(() => documentReferences.id),
  r2Key: text("r2_key").notNull(),
  sha256: text("sha256").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  version: integer("version").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const documentEventLinks = sqliteTable("document_event_links", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  patientId: text("patient_id").notNull(),
  documentId: text("document_id").notNull().references(() => documentReferences.id),
  timelineEventId: text("timeline_event_id").notNull().references(() => timelineEvents.id),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const labPanels = sqliteTable("lab_panels", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  patientId: text("patient_id").notNull(),
  documentId: text("document_id"),
  title: text("title").notNull(),
  effectiveAt: text("effective_at").notNull(),
  institution: text("institution"),
  status: text("status").notNull().default("final"),
  verificationStatus: text("verification_status").notNull().default("declared"),
  createdBy: text("created_by").notNull(),
  ...timestamps,
});

export const labResults = sqliteTable("lab_results", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  patientId: text("patient_id").notNull(),
  panelId: text("panel_id").notNull().references(() => labPanels.id),
  analyte: text("analyte").notNull(),
  resultText: text("result_text").notNull(),
  resultNumeric: real("result_numeric"),
  unit: text("unit"),
  referenceRange: text("reference_range"),
  flag: text("flag"),
  method: text("method"),
  sourcePage: integer("source_page"),
  sourceFragment: text("source_fragment"),
  verificationStatus: text("verification_status").notNull().default("declared"),
  createdBy: text("created_by").notNull(),
  ...timestamps,
});

export const nutritionPlans = sqliteTable(
  "nutrition_plans",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    patientId: text("patient_id").notNull(),
    title: text("title").notNull(),
    startDate: text("start_date").notNull(),
    endDate: text("end_date"),
    status: text("status").notNull().default("active"),
    professional: text("professional"),
    documentId: text("document_id"),
    goals: text("goals"),
    version: integer("version").notNull().default(1),
    createdBy: text("created_by").notNull(),
    ...timestamps,
  },
  (table) => [index("nutrition_plans_patient_start_idx").on(table.patientId, table.startDate)],
);

export const nutritionDays = sqliteTable(
  "nutrition_days",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    patientId: text("patient_id").notNull(),
    planId: text("plan_id").notNull().references(() => nutritionPlans.id),
    date: text("date").notNull(),
    hydration: integer("hydration"),
    sleepHours: real("sleep_hours"),
    sleepQuality: integer("sleep_quality"),
    energy: integer("energy"),
    hungerAnxiety: integer("hunger_anxiety"),
    digestion: text("digestion"),
    observations: text("observations"),
    adherence: real("adherence"),
    sourceType: text("source_type").notNull().default("patient"),
    verificationStatus: text("verification_status").notNull().default("declared"),
    createdBy: text("created_by").notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("nutrition_days_plan_date_idx").on(table.planId, table.date)],
);

export const nutritionMeals = sqliteTable("nutrition_meals", {
  id: text("id").primaryKey(),
  nutritionDayId: text("nutrition_day_id").notNull().references(() => nutritionDays.id, { onDelete: "cascade" }),
  mealKey: text("meal_key").notNull(),
  timeLabel: text("time_label"),
  status: text("status"),
  structure: text("structure"),
  foodsJson: text("foods_json").notNull().default("{}"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const aiSuggestions = sqliteTable(
  "ai_suggestions",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    patientId: text("patient_id").notNull(),
    suggestionType: text("suggestion_type").notNull(),
    title: text("title").notNull(),
    payloadJson: text("payload_json").notNull(),
    sourceType: text("source_type").notNull().default("chatgpt"),
    sourceReference: text("source_reference"),
    modelName: text("model_name"),
    confidence: real("confidence"),
    status: text("status").notNull().default("pending"),
    reviewedAt: text("reviewed_at"),
    reviewedBy: text("reviewed_by"),
    reviewNotes: text("review_notes"),
    ...timestamps,
  },
  (table) => [index("ai_suggestions_patient_status_idx").on(table.patientId, table.status)],
);

export const notes = sqliteTable("notes", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  patientId: text("patient_id").notNull(),
  effectiveAt: text("effective_at").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  sourceType: text("source_type").notNull().default("patient"),
  verificationStatus: text("verification_status").notNull().default("declared"),
  createdBy: text("created_by").notNull(),
  ...timestamps,
});

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  patientId: text("patient_id").notNull(),
  title: text("title").notNull(),
  dueAt: text("due_at"),
  status: text("status").notNull().default("pending"),
  sensitive: integer("sensitive", { mode: "boolean" }).notNull().default(false),
  createdBy: text("created_by").notNull(),
  ...timestamps,
});

export const reminders = sqliteTable("reminders", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  patientId: text("patient_id").notNull(),
  reminderType: text("reminder_type").notNull(),
  scheduleJson: text("schedule_json").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  safeNotificationText: text("safe_notification_text").notNull(),
  createdBy: text("created_by").notNull(),
  ...timestamps,
});

export const consentRecords = sqliteTable("consent_records", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  patientId: text("patient_id").notNull(),
  consentType: text("consent_type").notNull(),
  scopeJson: text("scope_json").notNull(),
  grantedAt: text("granted_at").notNull(),
  expiresAt: text("expires_at"),
  revokedAt: text("revoked_at"),
  createdBy: text("created_by").notNull(),
  ...timestamps,
});

export const apiTokens = sqliteTable(
  "api_tokens",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    patientId: text("patient_id").notNull(),
    userId: text("user_id").notNull(),
    label: text("label").notNull(),
    tokenHash: text("token_hash").notNull(),
    scopesJson: text("scopes_json").notNull().default("[]"),
    expiresAt: text("expires_at"),
    lastUsedAt: text("last_used_at"),
    revokedAt: text("revoked_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("api_tokens_hash_idx").on(table.tokenHash)],
);

export const integrationConnections = sqliteTable(
  "integration_connections",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    patientId: text("patient_id").notNull(),
    userId: text("user_id").notNull(),
    provider: text("provider").notNull(),
    displayName: text("display_name").notNull(),
    status: text("status").notNull().default("pending_pairing"),
    pairingCodeHash: text("pairing_code_hash"),
    pairingExpiresAt: text("pairing_expires_at"),
    connectorTokenHash: text("connector_token_hash"),
    tokenExpiresAt: text("token_expires_at"),
    deviceLabel: text("device_label"),
    deviceModel: text("device_model"),
    capabilitiesJson: text("capabilities_json").notNull().default("[]"),
    configJson: text("config_json").notNull().default("{}"),
    pairedAt: text("paired_at"),
    lastSeenAt: text("last_seen_at"),
    lastSyncAt: text("last_sync_at"),
    lastSuccessAt: text("last_success_at"),
    lastErrorCode: text("last_error_code"),
    lastErrorMessage: text("last_error_message"),
    lastErrorAt: text("last_error_at"),
    revokedAt: text("revoked_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("integration_connections_pairing_hash_idx").on(table.pairingCodeHash),
    uniqueIndex("integration_connections_token_hash_idx").on(table.connectorTokenHash),
    index("integration_connections_patient_provider_idx").on(table.patientId, table.provider, table.status),
  ],
);

export const providerConfigurations = sqliteTable("provider_configurations", {
  provider: text("provider").primaryKey(),
  clientId: text("client_id").notNull(),
  clientSecretCipher: text("client_secret_cipher").notNull(),
  status: text("status").notNull().default("active"),
  configuredBy: text("configured_by").notNull(),
  configuredAt: text("configured_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const oauthClients = sqliteTable("oauth_clients", {
  id: text("id").primaryKey(),
  clientName: text("client_name").notNull(),
  redirectUrisJson: text("redirect_uris_json").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const oauthAuthorizationCodes = sqliteTable("oauth_authorization_codes", {
  codeHash: text("code_hash").primaryKey(),
  clientId: text("client_id").notNull().references(() => oauthClients.id),
  userId: text("user_id").notNull(),
  organizationId: text("organization_id").notNull(),
  patientId: text("patient_id").notNull(),
  redirectUri: text("redirect_uri").notNull(),
  codeChallenge: text("code_challenge").notNull(),
  scopesJson: text("scopes_json").notNull(),
  expiresAt: text("expires_at").notNull(),
  usedAt: text("used_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("oauth_codes_client_idx").on(table.clientId)]);

export const oauthRefreshTokens = sqliteTable("oauth_refresh_tokens", {
  tokenHash: text("token_hash").primaryKey(),
  clientId: text("client_id").notNull().references(() => oauthClients.id),
  userId: text("user_id").notNull(),
  organizationId: text("organization_id").notNull(),
  patientId: text("patient_id").notNull(),
  scopesJson: text("scopes_json").notNull(),
  expiresAt: text("expires_at").notNull(),
  revokedAt: text("revoked_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("oauth_refresh_client_idx").on(table.clientId)]);

export const syncEvents = sqliteTable("sync_events", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  patientId: text("patient_id").notNull(),
  clientId: text("client_id").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  status: text("status").notNull(),
  payloadHash: text("payload_hash"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("sync_events_patient_key_idx").on(table.patientId, table.idempotencyKey)]);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    patientId: text("patient_id"),
    userId: text("user_id").notNull(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    outcome: text("outcome").notNull().default("success"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    occurredAt: text("occurred_at").notNull(),
  },
  (table) => [index("audit_patient_time_idx").on(table.patientId, table.occurredAt)],
);
