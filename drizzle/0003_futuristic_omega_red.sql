ALTER TABLE `clinical_facts` ADD `dose` text;--> statement-breakpoint
ALTER TABLE `clinical_facts` ADD `schedule` text;--> statement-breakpoint
ALTER TABLE `sleep_entries` ADD `bedtime_at` text;--> statement-breakpoint
ALTER TABLE `sleep_entries` ADD `wake_at` text;--> statement-breakpoint
ALTER TABLE `sleep_entries` ADD `awakenings` integer;--> statement-breakpoint
ALTER TABLE `sleep_entries` ADD `verification_status` text DEFAULT 'declared' NOT NULL;