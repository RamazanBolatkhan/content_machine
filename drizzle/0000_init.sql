CREATE TABLE "draft_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"draft_id" integer NOT NULL,
	"lang" text NOT NULL,
	"text" text NOT NULL,
	"source" text NOT NULL,
	"instruction" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drafts" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"source" text NOT NULL,
	"source_url" text NOT NULL,
	"source_name" text DEFAULT '' NOT NULL,
	"author_handle" text DEFAULT '' NOT NULL,
	"topic_id" integer,
	"original_text" text NOT NULL,
	"posted_at" timestamp with time zone,
	"metrics" jsonb,
	"score" real DEFAULT 0 NOT NULL,
	"ai_reason" text DEFAULT '' NOT NULL,
	"story_key" text DEFAULT '' NOT NULL,
	"matches_top" boolean DEFAULT false NOT NULL,
	"media" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drafts_source_id_unique" UNIQUE("source_id")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"result" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "reference_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"author_handle" text DEFAULT '' NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"stats" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"lang" text DEFAULT '' NOT NULL,
	"gist_en" text DEFAULT '' NOT NULL,
	"themes" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'ok' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reference_posts_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "scout_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"topic_id" integer,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"items_read" integer DEFAULT 0 NOT NULL,
	"candidates" integer DEFAULT 0 NOT NULL,
	"saved" integer DEFAULT 0 NOT NULL,
	"warnings" text DEFAULT '' NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "seen_items" (
	"source_id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY NOT NULL,
	"bookmarks_per_sync" integer DEFAULT 20 NOT NULL,
	"rss_enabled" boolean DEFAULT true NOT NULL,
	"web_search_enabled" boolean DEFAULT true NOT NULL,
	"x_search_enabled" boolean DEFAULT false NOT NULL,
	"news_feeds" text DEFAULT '' NOT NULL,
	"max_age_hours" integer DEFAULT 48 NOT NULL,
	"candidates_per_topic" integer DEFAULT 50 NOT NULL,
	"min_likes" integer DEFAULT 100 NOT NULL,
	"min_views" integer DEFAULT 0 NOT NULL,
	"fetch_per_topic" integer DEFAULT 30 NOT NULL,
	"search_lang" text DEFAULT 'en' NOT NULL,
	"languages" jsonb DEFAULT '["zh","ko","ja","ru","es","pt"]'::jsonb NOT NULL,
	"char_limit" integer DEFAULT 500 NOT NULL,
	"blocklist" text DEFAULT '' NOT NULL,
	"style_prompt" text DEFAULT '' NOT NULL,
	"glossary" text DEFAULT '' NOT NULL,
	"reference_profile" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"keywords" text DEFAULT '' NOT NULL,
	"feeds" text DEFAULT '' NOT NULL,
	"trusted_accounts" text DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "worker_status" (
	"id" integer PRIMARY KEY NOT NULL,
	"last_seen" timestamp with time zone NOT NULL,
	"info" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "x_auth" (
	"id" integer PRIMARY KEY NOT NULL,
	"user_id" text,
	"username" text,
	"access_token" text,
	"refresh_token" text,
	"expires_at" timestamp with time zone,
	"oauth_state" text,
	"code_verifier" text
);
--> statement-breakpoint
ALTER TABLE "draft_versions" ADD CONSTRAINT "draft_versions_draft_id_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scout_runs" ADD CONSTRAINT "scout_runs_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;