CREATE TABLE `oauth_authorization_codes` (
	`code_hash` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`user_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`redirect_uri` text NOT NULL,
	`code_challenge` text NOT NULL,
	`scopes_json` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `oauth_clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `oauth_codes_client_idx` ON `oauth_authorization_codes` (`client_id`);--> statement-breakpoint
CREATE TABLE `oauth_clients` (
	`id` text PRIMARY KEY NOT NULL,
	`client_name` text NOT NULL,
	`redirect_uris_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `oauth_refresh_tokens` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`user_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`scopes_json` text NOT NULL,
	`expires_at` text NOT NULL,
	`revoked_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `oauth_clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `oauth_refresh_client_idx` ON `oauth_refresh_tokens` (`client_id`);
--> statement-breakpoint
DELETE FROM `memberships` WHERE `user_id` = 'use_3387e6a40b7af565547331296d5c';
--> statement-breakpoint
DELETE FROM `patient_profiles` WHERE `id` = 'pat_a6af22efc402d3c60adb1cfdf4f1';
--> statement-breakpoint
DELETE FROM `organizations` WHERE `id` = 'org_a154d704d1ebe74fd8b58da15e45';
--> statement-breakpoint
DELETE FROM `users` WHERE `id` = 'use_3387e6a40b7af565547331296d5c';
