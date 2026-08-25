CREATE TABLE `integration_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`display_name` text NOT NULL,
	`status` text DEFAULT 'pending_pairing' NOT NULL,
	`pairing_code_hash` text,
	`pairing_expires_at` text,
	`connector_token_hash` text,
	`token_expires_at` text,
	`device_label` text,
	`device_model` text,
	`capabilities_json` text DEFAULT '[]' NOT NULL,
	`config_json` text DEFAULT '{}' NOT NULL,
	`paired_at` text,
	`last_seen_at` text,
	`last_sync_at` text,
	`last_success_at` text,
	`last_error_code` text,
	`last_error_message` text,
	`last_error_at` text,
	`revoked_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `integration_connections_pairing_hash_idx` ON `integration_connections` (`pairing_code_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `integration_connections_token_hash_idx` ON `integration_connections` (`connector_token_hash`);--> statement-breakpoint
CREATE INDEX `integration_connections_patient_provider_idx` ON `integration_connections` (`patient_id`,`provider`,`status`);