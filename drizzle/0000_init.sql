CREATE TABLE `draft_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`draft_id` integer NOT NULL,
	`text_ru` text NOT NULL,
	`source` text NOT NULL,
	`instruction` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`draft_id`) REFERENCES `drafts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `drafts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` text NOT NULL,
	`source` text NOT NULL,
	`source_url` text NOT NULL,
	`source_name` text DEFAULT '' NOT NULL,
	`author_handle` text DEFAULT '' NOT NULL,
	`game_id` integer,
	`original_text` text NOT NULL,
	`posted_at` integer,
	`metrics` text,
	`score` real DEFAULT 0 NOT NULL,
	`ai_reason` text DEFAULT '' NOT NULL,
	`story_key` text DEFAULT '' NOT NULL,
	`media` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `drafts_source_id_unique` ON `drafts` (`source_id`);--> statement-breakpoint
CREATE TABLE `games` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`keywords` text DEFAULT '' NOT NULL,
	`feeds` text DEFAULT '' NOT NULL,
	`trusted_accounts` text DEFAULT '' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scout_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`game_id` integer,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`items_read` integer DEFAULT 0 NOT NULL,
	`candidates` integer DEFAULT 0 NOT NULL,
	`saved` integer DEFAULT 0 NOT NULL,
	`warnings` text DEFAULT '' NOT NULL,
	`error` text,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `seen_items` (
	`source_id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`bookmarks_per_sync` integer DEFAULT 20 NOT NULL,
	`rss_enabled` integer DEFAULT true NOT NULL,
	`web_search_enabled` integer DEFAULT true NOT NULL,
	`x_search_enabled` integer DEFAULT false NOT NULL,
	`news_feeds` text DEFAULT '' NOT NULL,
	`max_age_hours` integer DEFAULT 48 NOT NULL,
	`candidates_per_game` integer DEFAULT 15 NOT NULL,
	`min_likes` integer DEFAULT 100 NOT NULL,
	`min_views` integer DEFAULT 0 NOT NULL,
	`fetch_per_game` integer DEFAULT 30 NOT NULL,
	`search_lang` text DEFAULT 'en' NOT NULL,
	`blocklist` text DEFAULT '' NOT NULL,
	`style_prompt` text DEFAULT '' NOT NULL,
	`glossary` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `x_auth` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` text,
	`username` text,
	`access_token` text,
	`refresh_token` text,
	`expires_at` integer,
	`oauth_state` text,
	`code_verifier` text
);
