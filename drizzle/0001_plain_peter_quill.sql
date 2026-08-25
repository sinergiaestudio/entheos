CREATE INDEX `family_sessions_user_idx` ON `family_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `family_sessions_expiry_idx` ON `family_sessions` (`expires_at`);