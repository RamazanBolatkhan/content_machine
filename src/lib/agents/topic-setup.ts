import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Topic } from "@/db/schema";
import { aiObject } from "@/lib/ai";
import { fetchFeed } from "@/lib/sources/rss";
import { lines } from "@/lib/util";
import { xConfigured } from "@/lib/x/client";

const suggestionSchema = z.object({
  description: z.string().describe("1–2 sentences: what kind of posts about this topic are worth sharing"),
  keywords: z.array(z.string()).describe("8–15 search terms people actually use for this topic, most important first"),
  accounts: z
    .array(z.object({ handle: z.string().describe("X handle without @"), why: z.string() }))
    .describe("10–15 active X accounts (any size) whose posts on this topic regularly get high engagement"),
  feeds: z
    .array(z.object({ url: z.string().describe("Direct RSS or Atom feed URL"), name: z.string() }))
    .describe("8–12 RSS/Atom feeds of reputable sources that publish often on this topic"),
});

export type TopicSetupResult = {
  addedKeywords: string[];
  addedAccounts: { handle: string; followers: number | null }[];
  addedFeeds: { url: string; name: string; items: number }[];
  skippedAccounts: string[];
  skippedFeeds: string[];
  descriptionSet: boolean;
};

// Feeds that haven't published for this long are skipped
const MAX_FEED_SILENCE_DAYS = 60;

async function checkFeed(url: string): Promise<{ ok: boolean; items: number; reason?: string }> {
  try {
    const items = await fetchFeed(url);
    if (!items.length) return { ok: false, items: 0, reason: "empty" };
    const newest = Math.max(...items.map((i) => i.publishedAt?.getTime() ?? 0));
    if (newest && Date.now() - newest > MAX_FEED_SILENCE_DAYS * 86_400_000) {
      return { ok: false, items: items.length, reason: "not updated recently" };
    }
    return { ok: true, items: items.length };
  } catch (e) {
    return { ok: false, items: 0, reason: e instanceof Error ? e.message : String(e) };
  }
}

/** Look up handles on X (app Bearer Token, ~$0.01 per account). null = lookup not available. */
async function lookupAccounts(handles: string[]): Promise<Map<string, number> | null> {
  if (!xConfigured() || !handles.length) return null;
  const found = new Map<string, number>();
  for (let i = 0; i < handles.length; i += 100) {
    const url = new URL("https://api.x.com/2/users/by");
    url.searchParams.set("usernames", handles.slice(i, i + 100).join(","));
    url.searchParams.set("user.fields", "public_metrics");
    const res = await fetch(url, { headers: { Authorization: `Bearer ${process.env.X_BEARER_TOKEN}` } });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: { username: string; public_metrics?: { followers_count?: number } }[] };
    for (const u of body.data ?? []) found.set(u.username.toLowerCase(), u.public_metrics?.followers_count ?? 0);
  }
  return found;
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Ask Claude (with web search) for keywords, X accounts and feeds for a topic,
 * verify them, and merge the good ones into the topic.
 */
export async function improveTopic(topicId: number): Promise<TopicSetupResult> {
  const [topic]: (Topic | undefined)[] = await db.select().from(schema.topics).where(eq(schema.topics.id, topicId));
  if (!topic) throw new Error("Topic not found");

  const s = await aiObject(suggestionSchema, {
    web: "search",
    instructions: [
      "You help set up a news-monitoring tool for a social media creator.",
      "Use web search to find REAL, currently active sources. Never invent handles or feed URLs.",
      "Feeds must be direct RSS/Atom URLs (e.g. https://site.com/feed, a subreddit's /top/.rss?t=day, a YouTube channel's feeds/videos.xml?channel_id=…), not normal web pages.",
      "Accounts: active X accounts whose posts about this topic regularly get strong engagement (many likes, reposts, replies), of ANY size. Account size doesn't matter; how well their posts perform does. Prefer creators with original content over brand accounts that post many low-engagement links.",
      "Keywords: the terms people really use in posts and headlines, including common synonyms and abbreviations. Avoid words so generic they match unrelated posts.",
    ].join("\n"),
    prompt: [
      `Topic: "${topic.name}"`,
      topic.description.trim() ? `What the owner wants: ${topic.description.trim()}` : "",
      lines(topic.keywords).length ? `Current keywords: ${lines(topic.keywords).join(", ")}` : "",
      lines(topic.trustedAccounts).length ? `Current accounts: ${lines(topic.trustedAccounts).join(", ")}` : "",
      lines(topic.feeds).length ? `Current feeds: ${lines(topic.feeds).join(", ")}` : "",
      "Suggest additions (you may repeat the best current ones).",
    ]
      .filter(Boolean)
      .join("\n"),
  });

  // Keywords: new ones only
  const haveKeywords = new Set(lines(topic.keywords).map(norm));
  const addedKeywords = [...new Set(s.keywords.map((k) => k.trim()).filter(Boolean))].filter(
    (k) => !haveKeywords.has(norm(k)),
  );

  // Feeds: must load, have items and be updated recently
  const haveFeeds = new Set(lines(topic.feeds).map(norm));
  const newFeeds = s.feeds.filter((f) => /^https?:\/\//.test(f.url) && !haveFeeds.has(norm(f.url)));
  const checks = await Promise.all(newFeeds.map((f) => checkFeed(f.url)));
  const addedFeeds = newFeeds.flatMap((f, i) =>
    checks[i].ok ? [{ url: f.url, name: f.name, items: checks[i].items }] : [],
  );
  const skippedFeeds = newFeeds.flatMap((f, i) => (checks[i].ok ? [] : [`${f.url} (${checks[i].reason})`]));

  // Accounts: must exist on X and be big enough (when lookup is possible)
  const haveAccounts = new Set(lines(topic.trustedAccounts).map((h) => norm(h.replace(/^@/, ""))));
  const handles = [...new Set(s.accounts.map((a) => a.handle.replace(/^@/, "").trim()))].filter(
    (h) => /^\w{1,15}$/.test(h) && !haveAccounts.has(norm(h)),
  );
  const followers = await lookupAccounts(handles);
  const addedAccounts: TopicSetupResult["addedAccounts"] = [];
  const skippedAccounts: string[] = [];
  for (const h of handles) {
    if (!followers) addedAccounts.push({ handle: h, followers: null });
    else if (!followers.has(norm(h))) skippedAccounts.push(`${h} (not found)`);
    else addedAccounts.push({ handle: h, followers: followers.get(norm(h))! });
  }

  const join = (current: string, extra: string[]) => [...lines(current), ...extra].join("\n");
  const descriptionSet = !topic.description.trim() && Boolean(s.description.trim());
  await db
    .update(schema.topics)
    .set({
      keywords: join(topic.keywords, addedKeywords),
      trustedAccounts: join(
        topic.trustedAccounts,
        addedAccounts.map((a) => a.handle),
      ),
      feeds: join(
        topic.feeds,
        addedFeeds.map((f) => f.url),
      ),
      ...(descriptionSet ? { description: s.description.trim() } : {}),
    })
    .where(eq(schema.topics.id, topicId));

  return { addedKeywords, addedAccounts, addedFeeds, skippedAccounts, skippedFeeds, descriptionSet };
}
