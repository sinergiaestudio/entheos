CREATE TABLE `provider_configurations` (
	`provider` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`client_secret_cipher` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`configured_by` text NOT NULL,
	`configured_at` text NOT NULL,
	`updated_at` text NOT NULL
);
