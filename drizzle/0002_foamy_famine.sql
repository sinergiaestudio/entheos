CREATE TABLE `access_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`granted_to_user_id` text,
	`role` text NOT NULL,
	`modules_json` text DEFAULT '[]' NOT NULL,
	`permission` text DEFAULT 'read' NOT NULL,
	`starts_at` text,
	`expires_at` text,
	`revoked_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `activity_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`effective_at` text NOT NULL,
	`activity_type` text NOT NULL,
	`duration_minutes` integer,
	`distance_km` real,
	`average_heart_rate` integer,
	`max_heart_rate` integer,
	`perceived_effort` integer,
	`recovery` text,
	`comments` text,
	`source_type` text DEFAULT 'patient' NOT NULL,
	`verification_status` text DEFAULT 'declared' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `activity_patient_time_idx` ON `activity_sessions` (`patient_id`,`effective_at`);--> statement-breakpoint
CREATE TABLE `ai_suggestions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`suggestion_type` text NOT NULL,
	`title` text NOT NULL,
	`payload_json` text NOT NULL,
	`source_type` text DEFAULT 'chatgpt' NOT NULL,
	`source_reference` text,
	`model_name` text,
	`confidence` real,
	`status` text DEFAULT 'pending' NOT NULL,
	`reviewed_at` text,
	`reviewed_by` text,
	`review_notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `ai_suggestions_patient_status_idx` ON `ai_suggestions` (`patient_id`,`status`);--> statement-breakpoint
CREATE TABLE `api_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`user_id` text NOT NULL,
	`label` text NOT NULL,
	`token_hash` text NOT NULL,
	`scopes_json` text DEFAULT '[]' NOT NULL,
	`expires_at` text,
	`last_used_at` text,
	`revoked_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_tokens_hash_idx` ON `api_tokens` (`token_hash`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`patient_id` text,
	`user_id` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`outcome` text DEFAULT 'success' NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`occurred_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_patient_time_idx` ON `audit_logs` (`patient_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `blood_pressure_readings` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`effective_at` text NOT NULL,
	`systolic` integer NOT NULL,
	`diastolic` integer NOT NULL,
	`pulse` integer,
	`arm` text,
	`position` text,
	`context` text,
	`series_id` text,
	`source_type` text DEFAULT 'patient' NOT NULL,
	`verification_status` text DEFAULT 'declared' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `blood_pressure_patient_time_idx` ON `blood_pressure_readings` (`patient_id`,`effective_at`);--> statement-breakpoint
CREATE TABLE `care_team` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`professional_user_id` text,
	`display_name` text NOT NULL,
	`specialty` text,
	`registration` text,
	`institution` text,
	`contact` text,
	`status` text DEFAULT 'inactive' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `clinical_facts` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`details` text,
	`status` text DEFAULT 'active' NOT NULL,
	`effective_at` text,
	`end_at` text,
	`source_type` text DEFAULT 'patient' NOT NULL,
	`source_id` text,
	`verification_status` text DEFAULT 'declared' NOT NULL,
	`confidence` real,
	`version` integer DEFAULT 1 NOT NULL,
	`supersedes_id` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `clinical_facts_patient_category_idx` ON `clinical_facts` (`patient_id`,`category`);--> statement-breakpoint
CREATE TABLE `consent_records` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`consent_type` text NOT NULL,
	`scope_json` text NOT NULL,
	`granted_at` text NOT NULL,
	`expires_at` text,
	`revoked_at` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `document_event_links` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`document_id` text NOT NULL,
	`timeline_event_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `document_references`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`timeline_event_id`) REFERENCES `timeline_events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `document_references` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`r2_key` text NOT NULL,
	`original_name` text NOT NULL,
	`display_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`sha256` text NOT NULL,
	`document_type` text NOT NULL,
	`study_date` text,
	`institution` text,
	`professional` text,
	`specialty` text,
	`description` text,
	`tags_json` text DEFAULT '[]' NOT NULL,
	`source_type` text DEFAULT 'patient' NOT NULL,
	`review_status` text DEFAULT 'pending' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `documents_patient_hash_idx` ON `document_references` (`patient_id`,`sha256`);--> statement-breakpoint
CREATE INDEX `documents_patient_study_idx` ON `document_references` (`patient_id`,`study_date`);--> statement-breakpoint
CREATE TABLE `document_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`r2_key` text NOT NULL,
	`sha256` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`version` integer NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `document_references`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `encounters` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`effective_at` text NOT NULL,
	`professional_name` text,
	`specialty` text,
	`institution` text,
	`reason` text,
	`summary` text,
	`diagnosis` text,
	`indications` text,
	`next_control_at` text,
	`source_type` text DEFAULT 'patient' NOT NULL,
	`verification_status` text DEFAULT 'declared' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `lab_panels` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`document_id` text,
	`title` text NOT NULL,
	`effective_at` text NOT NULL,
	`institution` text,
	`status` text DEFAULT 'final' NOT NULL,
	`verification_status` text DEFAULT 'declared' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `lab_results` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`panel_id` text NOT NULL,
	`analyte` text NOT NULL,
	`result_text` text NOT NULL,
	`result_numeric` real,
	`unit` text,
	`reference_range` text,
	`flag` text,
	`method` text,
	`source_page` integer,
	`source_fragment` text,
	`verification_status` text DEFAULT 'declared' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`panel_id`) REFERENCES `lab_panels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `measurement_types` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`label` text NOT NULL,
	`unit` text,
	`category` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `measurement_types_code_idx` ON `measurement_types` (`code`);--> statement-breakpoint
CREATE TABLE `memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'patient_admin' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `memberships_org_user_idx` ON `memberships` (`organization_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `memberships_user_idx` ON `memberships` (`user_id`);--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`effective_at` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`source_type` text DEFAULT 'patient' NOT NULL,
	`verification_status` text DEFAULT 'declared' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `nutrition_days` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`date` text NOT NULL,
	`hydration` integer,
	`sleep_hours` real,
	`sleep_quality` integer,
	`energy` integer,
	`hunger_anxiety` integer,
	`digestion` text,
	`observations` text,
	`adherence` real,
	`source_type` text DEFAULT 'patient' NOT NULL,
	`verification_status` text DEFAULT 'declared' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`plan_id`) REFERENCES `nutrition_plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nutrition_days_plan_date_idx` ON `nutrition_days` (`plan_id`,`date`);--> statement-breakpoint
CREATE TABLE `nutrition_meals` (
	`id` text PRIMARY KEY NOT NULL,
	`nutrition_day_id` text NOT NULL,
	`meal_key` text NOT NULL,
	`time_label` text,
	`status` text,
	`structure` text,
	`foods_json` text DEFAULT '{}' NOT NULL,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`nutrition_day_id`) REFERENCES `nutrition_days`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `nutrition_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`title` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`status` text DEFAULT 'active' NOT NULL,
	`professional` text,
	`document_id` text,
	`goals` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `nutrition_plans_patient_start_idx` ON `nutrition_plans` (`patient_id`,`start_date`);--> statement-breakpoint
CREATE TABLE `observations` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`measurement_type_id` text,
	`code` text NOT NULL,
	`value_numeric` real,
	`value_text` text,
	`unit` text,
	`effective_at` text NOT NULL,
	`recorded_at` text NOT NULL,
	`context_json` text DEFAULT '{}' NOT NULL,
	`source_type` text DEFAULT 'patient' NOT NULL,
	`source_id` text,
	`status` text DEFAULT 'final' NOT NULL,
	`confidence` real,
	`verification_status` text DEFAULT 'declared' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`supersedes_id` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `observations_patient_code_time_idx` ON `observations` (`patient_id`,`code`,`effective_at`);--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`mode` text DEFAULT 'individual' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `patient_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`display_name` text NOT NULL,
	`birth_date` text,
	`sex` text,
	`gender` text,
	`height_cm` real,
	`blood_type` text,
	`coverage` text,
	`emergency_contact` text,
	`clinical_summary` text,
	`timezone` text DEFAULT 'America/Argentina/Buenos_Aires' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `patient_profiles_owner_idx` ON `patient_profiles` (`owner_user_id`);--> statement-breakpoint
CREATE INDEX `patient_profiles_org_idx` ON `patient_profiles` (`organization_id`);--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`reminder_type` text NOT NULL,
	`schedule_json` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`safe_notification_text` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `sleep_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`effective_at` text NOT NULL,
	`hours` real,
	`quality` integer,
	`notes` text,
	`source_type` text DEFAULT 'patient' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `symptom_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`effective_at` text NOT NULL,
	`title` text NOT NULL,
	`body_area` text,
	`intensity` integer,
	`duration` text,
	`frequency` text,
	`triggers` text,
	`associated_symptoms` text,
	`status` text DEFAULT 'active' NOT NULL,
	`notes` text,
	`source_type` text DEFAULT 'patient' NOT NULL,
	`verification_status` text DEFAULT 'declared' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `symptoms_patient_time_idx` ON `symptom_entries` (`patient_id`,`effective_at`);--> statement-breakpoint
CREATE TABLE `sync_events` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`client_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`status` text NOT NULL,
	`payload_hash` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sync_events_patient_key_idx` ON `sync_events` (`patient_id`,`idempotency_key`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`title` text NOT NULL,
	`due_at` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`sensitive` integer DEFAULT false NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `timeline_events` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`effective_at` text NOT NULL,
	`recorded_at` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`source_type` text DEFAULT 'patient' NOT NULL,
	`source_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`verification_status` text DEFAULT 'declared' NOT NULL,
	`visibility` text DEFAULT 'private' NOT NULL,
	`relevance` integer DEFAULT 1 NOT NULL,
	`tags_json` text DEFAULT '[]' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`supersedes_id` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `timeline_patient_effective_idx` ON `timeline_events` (`patient_id`,`effective_at`);--> statement-breakpoint
CREATE INDEX `timeline_patient_type_idx` ON `timeline_events` (`patient_id`,`type`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`last_login_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `weight_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`effective_at` text NOT NULL,
	`weight_kg` real NOT NULL,
	`waist_cm` real,
	`bmi` real,
	`scale` text,
	`conditions` text,
	`source_type` text DEFAULT 'patient' NOT NULL,
	`verification_status` text DEFAULT 'declared' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `weight_patient_time_idx` ON `weight_entries` (`patient_id`,`effective_at`);