CREATE TABLE `reference_posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`url` text NOT NULL,
	`author_handle` text DEFAULT '' NOT NULL,
	`text` text DEFAULT '' NOT NULL,
	`stats` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`lang` text DEFAULT '' NOT NULL,
	`gist_en` text DEFAULT '' NOT NULL,
	`themes` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'ok' NOT NULL,
	`error` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reference_posts_url_unique` ON `reference_posts` (`url`);--> statement-breakpoint
ALTER TABLE `drafts` ADD `matches_top` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `reference_profile` text DEFAULT '' NOT NULL;