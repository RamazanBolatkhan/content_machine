import { z } from "zod";
import { desc, eq, gte, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { RUN_KINDS, type Topic, type PostMetrics, type Settings, type SourceType } from "@/db/schema";
import { aiObject } from "@/lib/ai";
import { enabledLangs } from "@/lib/languages";
import { referenceBlock, similarSearchThemes } from "./reference";
import { writePosts } from "./writer";
import { fetchFeed } from "@/lib/sources/rss";
import type { NewsItem } from "@/lib/sources/types";
import { searchTopicNews, searchWebNews } from "@/lib/sources/web-search";
import { getSettings } from "@/lib/queries";
import { lines } from "@/lib/util";
import { fetchNewBookmarks } from "@/lib/x/bookmarks";
import { searchRecentPosts, searchXNews, xConfigured, type XPost } from "@/lib/x/client";

export type RunResult = {
  runId: number;
  label: string;
  read: number;
  candidates: number;
  saved: number;
  warnings: string[];
  error?: string;
};

/** Anything that may become a draft, whatever the source. */
type Candidate = {
  sourceId: string;
  source: SourceType;
  url: string;
  sourceName: string;
  authorHandle: string;
  text: string;
  postedAt: Date | null;
  metrics: PostMetrics | null;
  topicId: number | null;
};

// ---------- converting sources ----------

function fromXPost(post: XPost, source: SourceType, topicId: number | null): Candidate {
  return {
    sourceId: `x:${post.id}`,
    source,
    url: post.url,
    sourceName: post.authorName,
    authorHandle: post.authorHandle,
    text: post.text,
    postedAt: post.createdAt,
    metrics: post.metrics,
    topicId,
  };
}

/** Same article = same id, whatever tracking params are attached. */
export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = "";
    for (const key of [...u.searchParams.keys()]) {
      if (/^(utm_|ref$|ref_|fbclid|gclid|mc_)/i.test(key)) u.searchParams.delete(key);
    }
    u.hostname = u.hostname.replace(/^www\./, "");
    return u.toString().replace(/\/$/, "");
  } catch {
    return raw;
  }
}

function fromNews(item: NewsItem, source: SourceType, topicId: number | null): Candidate {
  return {
    sourceId: `url:${normalizeUrl(item.url)}`,
    source,
    url: item.url,
    sourceName: item.sourceName,
    authorHandle: "",
    text: [item.title, item.summary].filter(Boolean).join("\n\n"),
    postedAt: item.publishedAt,
    metrics: null,
    topicId,
  };
}

// ---------- filters ----------

async function knownIds(ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const [seen, drafted] = await Promise.all([
    db.select({ id: schema.seenItems.sourceId }).from(schema.seenItems).where(inArray(schema.seenItems.sourceId, ids)),
    db.select({ id: schema.drafts.sourceId }).from(schema.drafts).where(inArray(schema.drafts.sourceId, ids)),
  ]);
  return new Set([...seen, ...drafted].map((r) => r.id));
}

function isBlocked(c: Candidate, blocklist: string[]): boolean {
  const text = c.text.toLowerCase();
  return blocklist.some((entry) => {
    const e = entry.toLowerCase();
    return e.startsWith("@") ? c.authorHandle.toLowerCase() === e.slice(1) : text.includes(e);
  });
}

function matchesTopic(item: NewsItem, topic: Topic): boolean {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  return lines(topic.keywords).some((k) => text.includes(k.toLowerCase().replace(/^"|"$/g, "")));
}

// ---------- X search (paid, ~$0.005 per post read) ----------

/** Keyword search: finds everything, popular or not (most posts have few likes). */
export function buildQuery(topic: Topic, settings: Settings): string {
  const all = lines(topic.keywords).map((k) => (/\s/.test(k) && !k.startsWith('"') ? `"${k}"` : k));
  if (!all.length) throw new Error(`Topic "${topic.name}" has no keywords`);
  // X limits query length: use the first (most important) keywords that fit
  const terms: string[] = [];
  for (const t of all) if (terms.length === 0 || [...terms, t].join(" OR ").length < 400) terms.push(t);
  const parts = [`(${terms.join(" OR ")})`, "-is:retweet", "-is:reply"];
  if (settings.searchLang) parts.push(`lang:${settings.searchLang}`);
  return parts.join(" ");
}

const handlesOf = (topic: Topic) => lines(topic.trustedAccounts).map((h) => h.replace(/^@/, ""));

/** Posts from the topic's accounts to watch: the reliable way to get popular posts. */
export function buildAccountsQuery(handles: string[]): string {
  return `(${handles.map((h) => `from:${h}`).join(" OR ")}) -is:retweet -is:reply`;
}

/** Minimum likes (and views, when set) for X search results. */
function passesEngagement(p: XPost, settings: Settings): boolean {
  return p.metrics.likes >= settings.minLikes && (!settings.minViews || (p.metrics.views ?? 0) >= settings.minViews);
}

/**
 * How well the post performed: engagement per hour, so fast-rising posts beat old viral ones.
 * Account size plays no part.
 */
export function scorePost(post: XPost): number {
  const m = post.metrics;
  const engagement = m.likes + 2 * m.reposts + 3 * m.quotes + 0.5 * m.replies + m.bookmarks + (m.views ?? 0) / 1000;
  const ageHours = post.createdAt ? Math.max(0, (Date.now() - post.createdAt.getTime()) / 3600_000) : 24;
  return Math.round((engagement / Math.pow(ageHours + 2, 1.2)) * 10) / 10;
}

async function xSearchCandidates(topic: Topic, settings: Settings, warn: (m: string) => void): Promise<Candidate[]> {
  const queries: string[] = [];
  const handles = handlesOf(topic);
  // X limits query length: ~20 accounts per query
  for (let i = 0; i < handles.length; i += 20) queries.push(buildAccountsQuery(handles.slice(i, i + 20)));
  if (lines(topic.keywords).length) queries.push(buildQuery(topic, settings));

  const posts: XPost[] = [];
  for (const query of queries) {
    try {
      posts.push(
        ...(await searchRecentPosts({ query, maxResults: settings.fetchPerTopic, sinceHours: settings.maxAgeHours })),
      );
    } catch (e) {
      warn(`X search "${query.slice(0, 60)}…": ${e instanceof Error ? e.message : e}`);
    }
  }
  return (
    posts
      .filter((p) => !p.isReply)
      // Same bar for every post, whoever posted it
      .filter((p) => passesEngagement(p, settings))
      .map((p) => ({ post: p, score: scorePost(p) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, settings.candidatesPerTopic)
      .map(({ post }) => fromXPost(post, "x_search", topic.id))
  );
}

// ---------- AI: judge + translate ----------

const judgementSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().describe("The item id, exactly as given (c1, c2…)"),
      keep: z.boolean().describe("true if worth publishing as a post"),
      topicId: z.number().int().nullable().describe("Id of the topic from the list this item is about, or null"),
      importance: z.number().int().min(1).max(10).describe("How interesting for the audience, 1–10"),
      matchesTop: z
        .boolean()
        .describe("true if it would make a post like the owner's best-performing posts (false when none are given)"),
      reason: z.string().describe("One short sentence in English: why it is (or isn't) worth posting"),
      storyKey: z
        .string()
        .describe(
          "Short kebab-case id of the news story, e.g. openai-gpt6-launch. Reuse an existing key for the same story.",
        ),
    }),
  ),
});
type Judgement = z.infer<typeof judgementSchema>["items"][number];

// Judging only (no writing), so bigger batches stay reliable
const BATCH_SIZE = 20;

function recentStories() {
  return db
    .select({ storyKey: schema.drafts.storyKey, text: schema.drafts.originalText })
    .from(schema.drafts)
    .where(gte(schema.drafts.createdAt, new Date(Date.now() - 72 * 3600_000)))
    .orderBy(desc(schema.drafts.createdAt))
    .limit(60);
}

/**
 * curated = the owner picked these (bookmarks): always keep, AI only finds the topic.
 * otherwise the AI decides what is worth posting.
 */
async function judge(
  candidates: Candidate[],
  opts: { curated: boolean; topics: Topic[]; settings: Settings; similarOnly?: boolean },
) {
  const [recent, topPosts] = await Promise.all([recentStories(), referenceBlock()]);
  const results: { candidate: Candidate; j: Judgement }[] = [];

  for (let start = 0; start < candidates.length; start += BATCH_SIZE) {
    const batch = candidates.slice(start, start + BATCH_SIZE);
    const ids = new Map(batch.map((c, i) => [`c${start + i + 1}`, c]));

    const { items } = await aiObject(judgementSchema, {
      instructions: [
        "You are the editor of a multilingual social media account about the owner's topics (listed below with their keywords).",
        "Pick the matching topic id for each item (or null if none fits) and rate how interesting it is for people who follow that topic.",
        opts.similarOnly
          ? "This search is ONLY for items like the owner's best-performing posts (below). Set keep=true only for real, fresh items that would make a similar post (same kind of topic, angle or hook); keep=false for everything else, however good. Reuse an existing storyKey and set keep=false for stories already covered."
          : opts.curated
            ? "The owner hand-picked these X posts (bookmarks). Set keep=true for all of them."
            : [
                "Decide for each item if it is worth posting for followers of its topic: real news, launches and announcements, new research or data, notable updates, expert insights, practical advice from credible people, or genuinely useful/surprising content.",
                "Reject: spam, ads, giveaways, SEO listicles, empty engagement bait, minor drama, items that match a keyword by accident but are not really about the topic, old news.",
                "For X posts, use the engagement numbers: the owner wants content that already proved popular. Posts with few likes/reposts for their age and views deserve a LOW importance (≤4) and usually keep=false, even from well-known accounts.",
                "If an item covers a story in the 'already have' list, reuse that storyKey and set keep=false.",
                "If several items cover the same new story, give them the same storyKey; the app keeps the best.",
              ].join("\n"),
        topPosts ? `\n${topPosts}` : "Set matchesTop=false (no top posts given).",
      ].join("\n"),
      prompt: [
        "Topics:",
        ...(opts.topics.length
          ? opts.topics.map(
              (t) =>
                `- id ${t.id}: ${t.name} [keywords: ${lines(t.keywords).join(", ")}]${t.description.trim() ? ` — the owner wants: ${t.description.trim()}` : ""}`,
            )
          : ["- none"]),
        "",
        recent.length
          ? `Already have (storyKey: text):\n${recent.map((r) => `- ${r.storyKey}: ${r.text.slice(0, 140).replace(/\s+/g, " ")}`).join("\n")}`
          : "Already have: nothing yet.",
        "",
        "Items:",
        JSON.stringify(
          [...ids].map(([id, c]) => ({
            id,
            source:
              c.source === "x_bookmark" || c.source === "x_search" ? `X post by @${c.authorHandle}` : c.sourceName,
            topicId: c.topicId,
            date: c.postedAt?.toISOString().slice(0, 10) ?? null,
            ...(c.metrics && {
              engagement: {
                likes: c.metrics.likes,
                reposts: c.metrics.reposts,
                replies: c.metrics.replies,
                views: c.metrics.views,
                hoursOld: c.postedAt ? Math.round((Date.now() - c.postedAt.getTime()) / 3600_000) : null,
              },
            }),
            text: c.text.slice(0, 2000),
          })),
          null,
          1,
        ),
      ].join("\n"),
    });

    for (const j of items) {
      const candidate = ids.get(j.id);
      if (candidate) results.push({ candidate, j });
    }
  }
  return results;
}

// ---------- saving ----------

/** Run `fn` over items with at most `limit` running at once. */
async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/**
 * Save judged items as drafts.
 * - curated (bookmarks): every item, written right away in all languages.
 * - otherwise: one item per new story, NOT written yet (the owner presses "Write it").
 *   Items the AI recommends go to "new", the others to "rejected" so they stay visible.
 */
async function saveDrafts(
  judged: { candidate: Candidate; j: Judgement }[],
  opts: { curated: boolean; topics: Topic[]; settings: Settings; runId: number },
): Promise<number> {
  const topicIds = new Set(opts.topics.map((g) => g.id));
  const existingStories = new Set((await recentStories()).map((r) => r.storyKey));

  // Pick what to save: everything (curated) or the best item per story we don't have yet
  const chosen = new Map<string, { candidate: Candidate; j: Judgement }>();
  for (const item of judged) {
    const { j } = item;
    if (!opts.curated && existingStories.has(j.storyKey)) continue;
    const key = opts.curated ? item.candidate.sourceId : j.storyKey;
    const current = chosen.get(key);
    const better =
      !current || (j.keep && !current.j.keep) || (j.keep === current.j.keep && j.importance > current.j.importance);
    if (better) chosen.set(key, item);
  }
  const items = [...chosen.values()];

  // Bookmarks are written right away; news waits for "Write it"
  const posts = opts.curated
    ? await writePosts(
        items.map(({ candidate: c }) => ({ id: c.sourceId, source: `X post by @${c.authorHandle}`, text: c.text })),
        enabledLangs(opts.settings),
        opts.settings,
      )
    : new Map<string, Partial<Record<string, string>>>();

  const unwritten = new Set<string>();
  const results = await pool(items, 6, async ({ candidate: c, j }) => {
    const texts = Object.entries(posts.get(c.sourceId) ?? {}) as [string, string][];
    if (opts.curated && !texts.length) {
      unwritten.add(c.sourceId); // not marked seen below, so it is retried next run
      return false;
    }
    const recommended = opts.curated || j.keep;

    const topicId = c.topicId ?? (j.topicId != null && topicIds.has(j.topicId) ? j.topicId : null);

    return db.transaction(async (tx) => {
      const [draft] = await tx
        .insert(schema.drafts)
        .values({
          sourceId: c.sourceId,
          source: c.source,
          sourceUrl: c.url,
          sourceName: c.sourceName,
          authorHandle: c.authorHandle,
          topicId,
          originalText: c.text,
          postedAt: c.postedAt,
          metrics: c.metrics,
          score: j.importance,
          matchesTop: j.matchesTop,
          aiReason: j.reason,
          storyKey: j.storyKey,
          status: recommended ? "new" : "rejected",
          runId: opts.runId,
        })
        .onConflictDoNothing()
        .returning({ id: schema.drafts.id });
      if (!draft) return false;
      if (texts.length) {
        await tx
          .insert(schema.draftVersions)
          .values(texts.map(([lang, text]) => ({ draftId: draft.id, lang, text, source: "ai_scout" as const })));
      }
      return recommended;
    });
  });

  // Remember every judged item so the AI never sees it twice
  const seen = judged.filter(({ candidate }) => !unwritten.has(candidate.sourceId));
  if (seen.length) {
    await db
      .insert(schema.seenItems)
      .values(seen.map(({ candidate }) => ({ sourceId: candidate.sourceId })))
      .onConflictDoNothing();
  }
  return results.filter(Boolean).length;
}

// ---------- run logging ----------

async function logged(
  kind: (typeof RUN_KINDS)[number],
  topicId: number | null,
  label: string,
  jobId: number | undefined,
  fn: (r: RunResult) => Promise<void>,
): Promise<RunResult> {
  const [run] = await db
    .insert(schema.scoutRuns)
    .values({ kind, topicId, jobId: jobId ?? null, startedAt: new Date() })
    .returning({ id: schema.scoutRuns.id });
  const result: RunResult = { runId: run.id, label, read: 0, candidates: 0, saved: 0, warnings: [] };
  try {
    await fn(result);
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  }
  await db
    .update(schema.scoutRuns)
    .set({
      finishedAt: new Date(),
      itemsRead: result.read,
      candidates: result.candidates,
      saved: result.saved,
      warnings: result.warnings.join("\n"),
      error: result.error ?? null,
    })
    .where(eq(schema.scoutRuns.id, run.id));
  return result;
}

function enabledTopics(): Promise<Topic[]> {
  return db.select().from(schema.topics).where(eq(schema.topics.enabled, true));
}

// ---------- public entry points ----------

/** Import new X bookmarks: every one becomes a draft. */
export async function syncBookmarks(jobId?: number): Promise<RunResult> {
  return logged("bookmarks", null, "X bookmarks", jobId, async (r) => {
    const settings = await getSettings();
    const topics = await enabledTopics();
    const posts = await fetchNewBookmarks(
      settings.bookmarksPerSync,
      async (id) => (await knownIds([`x:${id}`])).size > 0,
      (message) => r.warnings.push(message),
    );
    if (!posts.length && !r.warnings.length) r.warnings.push("No new bookmarks since the last import");
    r.read = posts.length;
    r.candidates = posts.length;
    r.saved = await importCuratedPosts(posts, topics, settings, r.runId);
  });
}

/** X posts the owner picked: every one becomes a draft (AI finds the topic and translates). */
export async function importCuratedPosts(
  posts: XPost[],
  topics: Topic[],
  settings: Settings,
  runId: number,
): Promise<number> {
  if (!posts.length) return 0;
  const candidates = posts.map((p) => fromXPost(p, "x_bookmark", null));
  const judged = await judge(candidates, { curated: true, topics, settings });
  return saveDrafts(judged, { curated: true, topics, settings, runId });
}

/** Find news for each enabled topic (or one topic) from RSS, Claude web search and, if enabled, paid X search. */
export async function findNews(topicId?: number, jobId?: number): Promise<RunResult[]> {
  const settings = await getSettings();
  const topics = (await enabledTopics()).filter((g) => !topicId || g.id === topicId);
  const allTopics = await enabledTopics();

  // Fetch each feed once per run, even if several topics use it
  const feedCache = new Map<string, Promise<NewsItem[]>>();
  const getFeed = (url: string) => {
    if (!feedCache.has(url)) feedCache.set(url, fetchFeed(url));
    return feedCache.get(url)!;
  };

  const results: RunResult[] = [];
  for (const topic of topics) {
    results.push(
      await logged("news", topic.id, topic.name, jobId, async (r) => {
        const candidates: Candidate[] = [];

        if (settings.rssEnabled) {
          const feeds = [
            ...lines(topic.feeds).map((url) => ({ url, topicOnly: true })),
            ...lines(settings.newsFeeds).map((url) => ({ url, topicOnly: false })),
          ];
          for (const feed of feeds) {
            try {
              const items = (await getFeed(feed.url)).filter(
                (i) => i.url && (feed.topicOnly || matchesTopic(i, topic)),
              );
              candidates.push(...items.map((i) => fromNews(i, "rss", topic.id)));
            } catch (e) {
              r.warnings.push(`Feed ${feed.url}: ${e instanceof Error ? e.message : e}`);
            }
          }
        }

        if (settings.webSearchEnabled) {
          try {
            const items = await searchTopicNews(
              topic,
              settings.maxAgeHours,
              Math.min(20, Math.max(8, Math.ceil(settings.candidatesPerTopic / 4))),
            );
            candidates.push(...items.map((i) => fromNews(i, "web", topic.id)));
          } catch (e) {
            r.warnings.push(`Web search: ${e instanceof Error ? e.message : e}`);
          }
        }

        if (settings.xSearchEnabled && !xConfigured()) {
          r.warnings.push("X search is on, but X_BEARER_TOKEN is not set");
        } else if (settings.xSearchEnabled) {
          candidates.push(...(await xSearchCandidates(topic, settings, (m) => r.warnings.push(m))));
          try {
            const stories = await searchXNews(topic.name, 5, settings.maxAgeHours);
            candidates.push(...stories.map((s) => fromNews(s, "x_news", topic.id)));
          } catch (e) {
            r.warnings.push(`X News: ${e instanceof Error ? e.message : e}`);
          }
        }
        r.read = candidates.length;

        // De-duplicate, drop known / old / blocked
        const unique = [...new Map(candidates.map((c) => [c.sourceId, c])).values()];
        const known = await knownIds(unique.map((c) => c.sourceId));
        const minDate = Date.now() - settings.maxAgeHours * 3600_000;
        const blocklist = lines(settings.blocklist);
        const usable = unique
          .filter((c) => !known.has(c.sourceId))
          .filter((c) => !c.postedAt || c.postedAt.getTime() >= minDate)
          .filter((c) => !isBlocked(c, blocklist));
        // X posts arrive sorted by popularity, news newest first: alternate so both get a share
        const xPosts = usable.filter((c) => c.source === "x_search");
        const news = usable
          .filter((c) => c.source !== "x_search")
          .sort((a, b) => (b.postedAt?.getTime() ?? 0) - (a.postedAt?.getTime() ?? 0));
        const fresh: Candidate[] = [];
        while (fresh.length < settings.candidatesPerTopic && (xPosts.length || news.length)) {
          if (xPosts.length) fresh.push(xPosts.shift()!);
          if (news.length && fresh.length < settings.candidatesPerTopic) fresh.push(news.shift()!);
        }
        r.candidates = fresh.length;
        if (!fresh.length) return;

        const judged = await judge(fresh, { curated: false, topics: allTopics, settings });
        r.saved = await saveDrafts(judged, { curated: false, topics: allTopics, settings, runId: r.runId });
      }),
    );
  }
  return results;
}

/**
 * "Find like my top posts": search only with themes derived from the owner's top Threads posts
 * (X search when enabled + Claude web search), and keep only items that would make a similar post.
 */
export async function findLikeTopPosts(jobId?: number): Promise<RunResult> {
  return logged("similar", null, "Like my top posts", jobId, async (r) => {
    const settings = await getSettings();
    const topics = await enabledTopics();
    const themes = await similarSearchThemes(4);
    const candidates: Candidate[] = [];
    const useX = settings.xSearchEnabled && xConfigured();

    // Similar stories don't have to be breaking news: look back two weeks
    const sinceHours = Math.max(settings.maxAgeHours, 336);

    // Web searches run in parallel (Claude); X searches one after another (X allows ~1/s)
    const web = Promise.all(
      themes.map((theme) =>
        searchWebNews(`matching this description: "${theme.webSubject.replace(/\.$/, "")}"`, [], sinceHours, 10).catch(
          (e) => {
            r.warnings.push(`Web search "${theme.label}": ${e instanceof Error ? e.message : e}`);
            return [];
          },
        ),
      ),
    );
    if (useX) {
      for (const theme of themes) {
        if (!theme.xKeywords.length) continue;
        const terms = theme.xKeywords.slice(0, 6).map((k) => (/\s/.test(k) ? `"${k.replace(/"/g, "")}"` : k));
        const query = [
          `(${terms.join(" OR ")})`,
          "-is:retweet",
          "-is:reply",
          settings.searchLang ? `lang:${settings.searchLang}` : "",
        ]
          .filter(Boolean)
          .join(" ");
        try {
          const posts = await searchRecentPosts({ query, maxResults: 20, sinceHours });
          candidates.push(
            ...posts
              .filter((p) => !p.isReply && passesEngagement(p, settings))
              .map((p) => fromXPost(p, "x_search", null)),
          );
        } catch (e) {
          r.warnings.push(`X search "${theme.label}": ${e instanceof Error ? e.message : e}`);
        }
      }
    }
    for (const items of await web) candidates.push(...items.map((i) => fromNews(i, "web", null)));
    if (!useX) r.warnings.push("X search is off or has no token: searched the web only");
    r.read = candidates.length;

    const unique = [...new Map(candidates.map((c) => [c.sourceId, c])).values()];
    const known = await knownIds(unique.map((c) => c.sourceId));
    const minDate = Date.now() - sinceHours * 3600_000;
    const blocklist = lines(settings.blocklist);
    const fresh = unique
      .filter((c) => !known.has(c.sourceId))
      .filter((c) => !c.postedAt || c.postedAt.getTime() >= minDate)
      .filter((c) => !isBlocked(c, blocklist))
      .slice(0, settings.candidatesPerTopic);
    r.candidates = fresh.length;
    if (!fresh.length) return;

    const judged = await judge(fresh, { curated: false, topics, settings, similarOnly: true });
    // Everything kept by this search is, by definition, like the top posts
    for (const item of judged) if (item.j.keep) item.j.matchesTop = true;
    r.saved = await saveDrafts(judged, { curated: false, topics, settings, runId: r.runId });
  });
}
