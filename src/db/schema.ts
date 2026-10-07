import { boolean, integer, jsonb, pgTable, real, serial, text, timestamp } from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// What the owner posts about, e.g. "OpenAI", "Open-source models", "AI agents"
export const topics = pgTable("topics", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  // What kind of posts the owner wants about this topic (helps the AI judge and set up sources)
  description: text("description").notNull().default(""),
  // One search term per line, e.g. "ChatGPT", "GPT-5". Used for web search,
  // matching general news feeds and (paid) X search.
  keywords: text("keywords").notNull().default(""),
  // RSS/Atom feed URLs only about this topic, one per line
  // (company blog, subreddit .rss, YouTube channel…)
  feeds: text("feeds").notNull().default(""),
  // X handles (without @) to watch, one per line
  trustedAccounts: text("trusted_accounts").notNull().default(""),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: createdAt(),
});

// Single row (id = 1)
export const settings = pgTable("settings", {
  id: integer("id").primaryKey(),
  // --- Sources ---
  // Max bookmarks read per sync (each costs ~$0.001)
  bookmarksPerSync: integer("bookmarks_per_sync").notNull().default(20),
  rssEnabled: boolean("rss_enabled").notNull().default(true),
  webSearchEnabled: boolean("web_search_enabled").notNull().default(true),
  // Paid X search (~$0.005 per post read), off by default
  xSearchEnabled: boolean("x_search_enabled").notNull().default(false),
  // General news feeds, matched to topics by keywords, one per line
  newsFeeds: text("news_feeds").notNull().default(""),
  // Ignore news / posts older than this
  maxAgeHours: integer("max_age_hours").notNull().default(48),
  // Max news items per topic sent to the AI per run
  candidatesPerTopic: integer("candidates_per_topic").notNull().default(50),
  // --- Paid X search only ---
  minLikes: integer("min_likes").notNull().default(100),
  minViews: integer("min_views").notNull().default(0),
  fetchPerTopic: integer("fetch_per_topic").notNull().default(30),
  searchLang: text("search_lang").notNull().default("en"),
  // --- Filters & writing ---
  // Languages every post is written in (codes from src/lib/languages.ts)
  languages: jsonb("languages").$type<string[]>().notNull().default(["zh", "ko", "ja", "ru", "es", "pt"]),
  // Max characters per post (500 = Threads)
  charLimit: integer("char_limit").notNull().default(500),
  // Words / @handles to always skip, one per line
  blocklist: text("blocklist").notNull().default(""),
  stylePrompt: text("style_prompt").notNull().default(""),
  // Terms kept as-is in translation, one per line
  glossary: text("glossary").notNull().default(""),
  // English summary of what makes the owner's top Threads posts work (built by the AI)
  referenceProfile: text("reference_profile").notNull().default(""),
});

export type MediaItem = {
  type: "photo" | "video" | "animated_gif";
  /** Public Vercel Blob URL of our copy, null if it wasn't stored (failed or too big) */
  file: string | null;
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

export const drafts = pgTable("drafts", {
  id: serial("id").primaryKey(),
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
  postedAt: timestamp("posted_at", { withTimezone: true }),
  // Only for X posts
  metrics: jsonb("metrics").$type<PostMetrics | null>(),
  // AI importance 1–10
  score: real("score").notNull().default(0),
  aiReason: text("ai_reason").notNull().default(""),
  storyKey: text("story_key").notNull().default(""),
  // The AI thinks this would make a post like the owner's top Threads posts
  matchesTop: boolean("matches_top").notNull().default(false),
  media: jsonb("media").$type<MediaItem[]>().notNull().default([]),
  status: text("status", { enum: DRAFT_STATUSES }).notNull().default("new"),
  // The search run that found it (for "Latest search" on the board)
  runId: integer("run_id").references(() => scoutRuns.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

export const VERSION_SOURCES = ["ai_scout", "ai_edit", "manual"] as const;

export const draftVersions = pgTable("draft_versions", {
  id: serial("id").primaryKey(),
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

export const RUN_KINDS = ["bookmarks", "news", "similar"] as const;

export const scoutRuns = pgTable("scout_runs", {
  id: serial("id").primaryKey(),
  // The job that started it: one "Find posts & news" job runs once per topic
  jobId: integer("job_id"),
  kind: text("kind", { enum: RUN_KINDS }).notNull(),
  topicId: integer("topic_id").references(() => topics.id, { onDelete: "set null" }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
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
export const seenItems = pgTable("seen_items", {
  sourceId: text("source_id").primaryKey(),
  seenAt: createdAt(),
});

// The owner's X login (OAuth 2.0), single row (id = 1)
export const xAuth = pgTable("x_auth", {
  id: integer("id").primaryKey(),
  userId: text("user_id"),
  username: text("username"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  // Pending login (PKCE)
  oauthState: text("oauth_state"),
  codeVerifier: text("code_verifier"),
});

export const REFERENCE_STATUSES = ["ok", "needs_text", "error"] as const;

// The owner's best-performing Threads posts (any language), used to score similar items higher
export const referencePosts = pgTable("reference_posts", {
  id: serial("id").primaryKey(),
  url: text("url").notNull().unique(),
  authorHandle: text("author_handle").notNull().default(""),
  // Original text, in the post's own language
  text: text("text").notNull().default(""),
  // e.g. "12.8K likes" from the embed, or the owner's own note ("120k views")
  stats: text("stats").notNull().default(""),
  note: text("note").notNull().default(""),
  // Filled in by the AI
  lang: text("lang").notNull().default(""),
  gistEn: text("gist_en").notNull().default(""),
  themes: text("themes").notNull().default(""),
  status: text("status", { enum: REFERENCE_STATUSES }).notNull().default("ok"),
  error: text("error"),
  createdAt: createdAt(),
});

// ---------- Jobs: work the website asks the local worker (X + Claude) to do ----------

export const JOB_KINDS = [
  "find_news", // { topicId?: number }
  "bookmarks", // {}
  "similar", // {}
  "write", // { draftId }
  "edit", // { draftId, lang, currentText, instruction }
  "improve_topic", // { topicId }
  "add_top_posts", // { urls: string[], note: string }
  "set_top_text", // { id, text }
  "delete_top_post", // { id }
  "rebuild_profile", // {}
] as const;
export type JobKind = (typeof JOB_KINDS)[number];
export const JOB_STATUSES = ["queued", "running", "done", "error"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  kind: text("kind", { enum: JOB_KINDS }).notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  status: text("status", { enum: JOB_STATUSES }).notNull().default("queued"),
  result: jsonb("result").$type<unknown>(),
  error: text("error"),
  createdAt: createdAt(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export type WorkerInfo = {
  ai: boolean;
  aiProvider: string;
  aiHint?: string;
  xSearch: boolean;
  xLogin: boolean;
  host: string;
};

// Single row (id = 1): the local worker's heartbeat, so the website knows whether it's online
export const workerStatus = pgTable("worker_status", {
  id: integer("id").primaryKey(),
  lastSeen: timestamp("last_seen", { withTimezone: true }).notNull(),
  info: jsonb("info").$type<WorkerInfo>().notNull(),
});

export type Topic = typeof topics.$inferSelect;
export type ReferencePost = typeof referencePosts.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type Draft = typeof drafts.$inferSelect;
export type DraftVersion = typeof draftVersions.$inferSelect;
export type ScoutRun = typeof scoutRuns.$inferSelect;
export type Job = typeof jobs.$inferSelect;
