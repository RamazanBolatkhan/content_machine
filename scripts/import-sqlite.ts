/**
 * One-time move of the old local SQLite text and source links (data/app.db) into Postgres.
 * Media is not imported; open the source links to view it.
 *   npm run db:import-sqlite
 * Refuses to run if Postgres already has drafts (use --force to import anyway).
 */
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { sql } from "drizzle-orm";
import { db, schema } from "../src/db";

const SQLITE = path.join(process.cwd(), "data", "app.db");

type Row = Record<string, unknown>;
const date = (v: unknown) => (v == null ? null : new Date(Number(v) * 1000));
const bool = (v: unknown) => Boolean(Number(v));
const json = <T>(v: unknown, fallback: T): T => {
  try {
    return v == null ? fallback : (JSON.parse(String(v)) as T);
  } catch {
    return fallback;
  }
};

async function main() {
  if (!fs.existsSync(SQLITE)) throw new Error(`No ${SQLITE} found`);
  const [{ count }] = (await db.execute<{ count: number }>(sql`select count(*)::int as count from drafts`)).rows;
  if (count > 0 && !process.argv.includes("--force")) {
    throw new Error(`Postgres already has ${count} drafts. Use --force to import anyway.`);
  }
  const lite = new Database(SQLITE, { readonly: true });
  const all = (table: string): Row[] => {
    try {
      return lite.prepare(`select * from ${table}`).all() as Row[];
    } catch {
      return [];
    }
  };

  const topics = all("topics");
  for (const t of topics) {
    await db
      .insert(schema.topics)
      .values({
        id: Number(t.id),
        name: String(t.name),
        description: String(t.description ?? ""),
        keywords: String(t.keywords ?? "").replace(/\r/g, ""),
        feeds: String(t.feeds ?? "").replace(/\r/g, ""),
        trustedAccounts: String(t.trusted_accounts ?? "").replace(/\r/g, ""),
        enabled: bool(t.enabled),
        createdAt: date(t.created_at) ?? new Date(),
      })
      .onConflictDoNothing();
  }

  const [s] = all("settings");
  if (s) {
    const values = {
      bookmarksPerSync: Number(s.bookmarks_per_sync),
      rssEnabled: bool(s.rss_enabled),
      webSearchEnabled: bool(s.web_search_enabled),
      xSearchEnabled: bool(s.x_search_enabled),
      newsFeeds: String(s.news_feeds ?? ""),
      maxAgeHours: Number(s.max_age_hours),
      candidatesPerTopic: Number(s.candidates_per_topic),
      minLikes: Number(s.min_likes),
      minViews: Number(s.min_views),
      fetchPerTopic: Number(s.fetch_per_topic),
      searchLang: String(s.search_lang ?? ""),
      languages: json<string[]>(s.languages, []),
      charLimit: Number(s.char_limit),
      blocklist: String(s.blocklist ?? ""),
      stylePrompt: String(s.style_prompt ?? ""),
      glossary: String(s.glossary ?? ""),
      referenceProfile: String(s.reference_profile ?? ""),
    };
    await db.insert(schema.settings).values({ id: 1, ...values }).onConflictDoUpdate({ target: schema.settings.id, set: values });
  }

  const drafts = all("drafts");
  let i = 0;
  for (const d of drafts) {
    await db
      .insert(schema.drafts)
      .values({
        id: Number(d.id),
        sourceId: String(d.source_id),
        source: d.source as never,
        sourceUrl: String(d.source_url),
        sourceName: String(d.source_name ?? ""),
        authorHandle: String(d.author_handle ?? ""),
        topicId: d.topic_id == null ? null : Number(d.topic_id),
        originalText: String(d.original_text),
        postedAt: date(d.posted_at),
        metrics: json(d.metrics, null),
        score: Number(d.score),
        aiReason: String(d.ai_reason ?? ""),
        storyKey: String(d.story_key ?? ""),
        matchesTop: bool(d.matches_top ?? 0),
        status: d.status as never,
        createdAt: date(d.created_at) ?? new Date(),
      })
      .onConflictDoNothing();
    if (++i % 20 === 0) console.log(`  drafts ${i}/${drafts.length}`);
  }

  const versions = all("draft_versions");
  for (let k = 0; k < versions.length; k += 200) {
    await db
      .insert(schema.draftVersions)
      .values(
        versions.slice(k, k + 200).map((v) => ({
          id: Number(v.id),
          draftId: Number(v.draft_id),
          lang: String(v.lang),
          text: String(v.text),
          source: v.source as never,
          instruction: v.instruction == null ? null : String(v.instruction),
          createdAt: date(v.created_at) ?? new Date(),
        })),
      )
      .onConflictDoNothing();
  }

  for (const r of all("scout_runs")) {
    await db
      .insert(schema.scoutRuns)
      .values({
        id: Number(r.id),
        kind: r.kind as never,
        topicId: r.topic_id == null ? null : Number(r.topic_id),
        startedAt: date(r.started_at) ?? new Date(),
        finishedAt: date(r.finished_at),
        itemsRead: Number(r.items_read),
        candidates: Number(r.candidates),
        saved: Number(r.saved),
        warnings: String(r.warnings ?? ""),
        error: r.error == null ? null : String(r.error),
      })
      .onConflictDoNothing();
  }

  const seen = all("seen_items");
  for (let k = 0; k < seen.length; k += 500) {
    await db
      .insert(schema.seenItems)
      .values(seen.slice(k, k + 500).map((x) => ({ sourceId: String(x.source_id), seenAt: date(x.seen_at) ?? new Date() })))
      .onConflictDoNothing();
  }

  const [x] = all("x_auth");
  if (x?.refresh_token) {
    const values = {
      userId: (x.user_id as string) ?? null,
      username: (x.username as string) ?? null,
      accessToken: (x.access_token as string) ?? null,
      refreshToken: (x.refresh_token as string) ?? null,
      expiresAt: date(x.expires_at),
    };
    await db.insert(schema.xAuth).values({ id: 1, ...values }).onConflictDoUpdate({ target: schema.xAuth.id, set: values });
  }

  for (const r of all("reference_posts")) {
    await db
      .insert(schema.referencePosts)
      .values({
        id: Number(r.id),
        url: String(r.url),
        authorHandle: String(r.author_handle ?? ""),
        text: String(r.text ?? ""),
        stats: String(r.stats ?? ""),
        note: String(r.note ?? ""),
        lang: String(r.lang ?? ""),
        gistEn: String(r.gist_en ?? ""),
        themes: String(r.themes ?? ""),
        status: r.status as never,
        error: r.error == null ? null : String(r.error),
        createdAt: date(r.created_at) ?? new Date(),
      })
      .onConflictDoNothing();
  }

  // Serial ids continue after the imported ones
  for (const table of ["topics", "drafts", "draft_versions", "scout_runs", "reference_posts"]) {
    await db.execute(
      sql.raw(`select setval(pg_get_serial_sequence('${table}', 'id'), coalesce((select max(id) from ${table}), 0) + 1, false)`),
    );
  }

  console.log(
    `Imported ${topics.length} topics, ${drafts.length} drafts, ${versions.length} versions, ${seen.length} seen items, ` +
      `${x?.refresh_token ? "including X login. " : ""}Source links retained; media not imported.`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
