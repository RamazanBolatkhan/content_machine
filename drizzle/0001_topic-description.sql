PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`bookmarks_per_sync` integer DEFAULT 20 NOT NULL,
	`rss_enabled` integer DEFAULT true NOT NULL,
	`web_search_enabled` integer DEFAULT true NOT NULL,
	`x_search_enabled` integer DEFAULT false NOT NULL,
	`news_feeds` text DEFAULT '' NOT NULL,
	`max_age_hours` integer DEFAULT 48 NOT NULL,
	`candidates_per_topic` integer DEFAULT 50 NOT NULL,
	`min_likes` integer DEFAULT 100 NOT NULL,
	`min_views` integer DEFAULT 0 NOT NULL,
	`fetch_per_topic` integer DEFAULT 30 NOT NULL,
	`search_lang` text DEFAULT 'en' NOT NULL,
	`languages` text DEFAULT '["zh","ko","ja","ru","es","pt"]' NOT NULL,
	`char_limit` integer DEFAULT 500 NOT NULL,
	`blocklist` text DEFAULT '' NOT NULL,
	`style_prompt` text DEFAULT '' NOT NULL,
	`glossary` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_settings`("id", "bookmarks_per_sync", "rss_enabled", "web_search_enabled", "x_search_enabled", "news_feeds", "max_age_hours", "candidates_per_topic", "min_likes", "min_views", "fetch_per_topic", "search_lang", "languages", "char_limit", "blocklist", "style_prompt", "glossary") SELECT "id", "bookmarks_per_sync", "rss_enabled", "web_search_enabled", "x_search_enabled", "news_feeds", "max_age_hours", "candidates_per_topic", "min_likes", "min_views", "fetch_per_topic", "search_lang", "languages", "char_limit", "blocklist", "style_prompt", "glossary" FROM `settings`;--> statement-breakpoint
DROP TABLE `settings`;--> statement-breakpoint
ALTER TABLE `__new_settings` RENAME TO `settings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `topics` ADD `description` text DEFAULT '' NOT NULL;