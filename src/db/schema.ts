import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

const createdAt = () =>
  integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`);

// What the owner posts about, e.g. "OpenAI", "Open-source models", "AI agents"
export const topics = sqliteTable("topics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  // One search term per line, e.g. "ChatGPT", "GPT-5". Used for web search,
  // matching general news feeds and (paid) X search.
  keywords: text("keywords").notNull().default(""),
  // RSS/Atom feed URLs only about this topic, one per line
  // (company blog, subreddit .rss, YouTube channel…)
  feeds: text("feeds").notNull().default(""),
  // X handles (without @) that get a bonus in paid X search, one per line
  trustedAccounts: text("trusted_accounts").notNull().default(""),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
});

// Single row (id = 1)
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  // --- Sources ---
  // Max bookmarks read per sync (each costs ~$0.001)
  bookmarksPerSync: integer("bookmarks_per_sync").notNull().default(20),
  rssEnabled: integer("rss_enabled", { mode: "boolean" }).notNull().default(true),
  webSearchEnabled: integer("web_search_enabled", { mode: "boolean" }).notNull().default(true),
  // Paid X search (~$0.005 per post read), off by default
  xSearchEnabled: integer("x_search_enabled", { mode: "boolean" }).notNull().default(false),
  // General AI news feeds, matched to topics by keywords, one per line
  newsFeeds: text("news_feeds").notNull().default(""),
  // Ignore news / posts older than this
  maxAgeHours: integer("max_age_hours").notNull().default(48),
  // Max news items per topic sent to the AI per run
  candidatesPerTopic: integer("candidates_per_topic").notNull().default(15),
  // --- Paid X search only ---
  minLikes: integer("min_likes").notNull().default(100),
  minViews: integer("min_views").notNull().default(0),
  fetchPerTopic: integer("fetch_per_topic").notNull().default(30),
  searchLang: text("search_lang").notNull().default("en"),
  // --- Filters & writing ---
  // Languages every post is written in (codes from src/lib/languages.ts)
  languages: text("languages", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default(["zh", "ko", "ja", "ru", "es", "pt"]),
  // Max characters per post (500 = Threads)
  charLimit: integer("char_limit").notNull().default(500),
  // Words / @handles to always skip, one per line
  blocklist: text("blocklist").notNull().default(""),
  stylePrompt: text("style_prompt").notNull().default(""),
  // Terms kept as-is in translation, one per line
  glossary: text("glossary").notNull().default(""),
});

export type MediaItem = {
  type: "photo" | "video" | "animated_gif";
  file: string | null; // file name in data/media, null if download failed
  remoteUrl: string;
  previewUrl?: string;
};

export type PostMetrics = {
  likes: number;
  reposts: number;
  replies: number;
  quotes: number;
  views: number | null;
  bookmarks: number;
};

export const DRAFT_STATUSES = ["new", "approved", "rejected", "posted"] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];

export const SOURCE_TYPES = ["x_bookmark", "x_search", "x_news", "rss", "web"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const drafts = sqliteTable("drafts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // "x:<post id>" for X posts, "url:<link>" for news
  sourceId: text("source_id").notNull().unique(),
  source: text("source", { enum: SOURCE_TYPES }).notNull(),
  sourceUrl: text("source_url").notNull(),
  // X: display name; news: site / feed name
  sourceName: text("source_name").notNull().default(""),
  // X handle without @ ("" for news)
  authorHandle: text("author_handle").notNull().default(""),
  topicId: integer("topic_id").references(() => topics.id, { onDelete: "set null" }),
  originalText: text("original_text").notNull(),
  postedAt: integer("posted_at", { mode: "timestamp" }),
  // Only for X posts
  metrics: text("metrics", { mode: "json" }).$type<PostMetrics | null>(),
  // AI importance 1–10
  score: real("score").notNull().default(0),
  aiReason: text("ai_reason").notNull().default(""),
  storyKey: text("story_key").notNull().default(""),
  media: text("media", { mode: "json" }).$type<MediaItem[]>().notNull().default([]),
  status: text("status", { enum: DRAFT_STATUSES }).notNull().default("new"),
  createdAt: createdAt(),
});

export const VERSION_SOURCES = ["ai_scout", "ai_edit", "manual"] as const;

export const draftVersions = sqliteTable("draft_versions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  draftId: integer("draft_id")
    .notNull()
    .references(() => drafts.id, { onDelete: "cascade" }),
  // Language code, e.g. "ja" (see src/lib/languages.ts)
  lang: text("lang").notNull(),
  text: text("text").notNull(),
  source: text("source", { enum: VERSION_SOURCES }).notNull(),
  instruction: text("instruction"),
  createdAt: createdAt(),
});

export const RUN_KINDS = ["bookmarks", "news"] as const;

export const scoutRuns = sqliteTable("scout_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kind: text("kind", { enum: RUN_KINDS }).notNull(),
  topicId: integer("topic_id").references(() => topics.id, { onDelete: "set null" }),
  startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
  finishedAt: integer("finished_at", { mode: "timestamp" }),
  // Items read from all sources
  itemsRead: integer("items_read").notNull().default(0),
  // Items sent to the AI
  candidates: integer("candidates").notNull().default(0),
  saved: integer("saved").notNull().default(0),
  // Non-fatal problems (a broken feed, web search failed…)
  warnings: text("warnings").notNull().default(""),
  error: text("error"),
});

// Every item the AI has already judged, so it is never re-evaluated
export const seenItems = sqliteTable("seen_items", {
  sourceId: text("source_id").primaryKey(),
  seenAt: createdAt(),
});

// The owner's X login (OAuth 2.0), single row (id = 1)
export const xAuth = sqliteTable("x_auth", {
  id: integer("id").primaryKey(),
  userId: text("user_id"),
  username: text("username"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  // Pending login (PKCE)
  oauthState: text("oauth_state"),
  codeVerifier: text("code_verifier"),
});

export type Topic = typeof topics.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type Draft = typeof drafts.$inferSelect;
export type DraftVersion = typeof draftVersions.$inferSelect;
export type ScoutRun = typeof scoutRuns.$inferSelect;
