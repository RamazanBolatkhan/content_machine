import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import type { ReferencePost } from "@/db/schema";
import { aiObject, aiText } from "@/lib/ai";
import { normalizeThreadsUrl, readThreadsPost } from "@/lib/threads";

export type AddResult = { added: number; needsText: number; duplicates: number; invalid: string[] };

const analysisSchema = z.object({
  items: z.array(
    z.object({
      id: z.number().int(),
      lang: z.string().describe("ISO 639-1 code of the post's language, e.g. ru"),
      gistEn: z.string().describe("One or two English sentences: what the post says"),
      themes: z.string().describe("Short English list of the topic, angle, hook and format that made it work"),
    }),
  ),
});

/** English gist + themes for posts that have text but no analysis yet. */
async function analyze(ids: number[]) {
  const posts = ids.length
    ? db.select().from(schema.referencePosts).where(inArray(schema.referencePosts.id, ids)).all()
    : [];
  const todo = posts.filter((p) => p.text.trim());
  if (!todo.length) return;
  const { items } = await aiObject(analysisSchema, {
    instructions: [
      "These are a social media creator's best-performing Threads posts, in various languages.",
      "For each, detect the language, summarise it in English, and name what likely made it perform: topic, angle, emotional hook, format (list, question, story, hot take…).",
    ].join("\n"),
    prompt: JSON.stringify(
      todo.map((p) => ({ id: p.id, stats: [p.stats, p.note].filter(Boolean).join(", "), text: p.text.slice(0, 2500) })),
      null,
      1,
    ),
  });
  for (const it of items) {
    db.update(schema.referencePosts)
      .set({ lang: it.lang.toLowerCase().slice(0, 5), gistEn: it.gistEn, themes: it.themes })
      .where(eq(schema.referencePosts.id, it.id))
      .run();
  }
}

/** One short English profile of what works, used by the scout's judge. */
export async function rebuildReferenceProfile(): Promise<string> {
  const posts = db
    .select()
    .from(schema.referencePosts)
    .all()
    .filter((p) => p.gistEn);
  let profile = "";
  if (posts.length) {
    profile = await aiText({
      instructions:
        "Write a compact English profile (max 120 words, bullet points) of what this creator's audience responds to, based on their best posts: recurring themes, angles, hooks and formats. No preface.",
      prompt: posts
        .map((p) => `- ${p.gistEn} | why it worked: ${p.themes}${p.stats ? ` | ${p.stats}` : ""}`)
        .join("\n"),
    });
  }
  db.update(schema.settings).set({ referenceProfile: profile.trim() }).where(eq(schema.settings.id, 1)).run();
  return profile;
}

/** Add Threads links: read each post, analyse the new ones, rebuild the profile. */
export async function addReferencePosts(rawUrls: string[], note: string): Promise<AddResult> {
  const result: AddResult = { added: 0, needsText: 0, duplicates: 0, invalid: [] };
  const newIds: number[] = [];
  for (const raw of rawUrls) {
    let post;
    let error: string | null = null;
    try {
      post = await readThreadsPost(raw);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    const url = post?.url ?? normalizeThreadsUrl(raw);
    if (!url) {
      result.invalid.push(raw);
      continue;
    }
    const row = db
      .insert(schema.referencePosts)
      .values({
        url,
        authorHandle: post?.authorHandle ?? "",
        text: post?.text ?? "",
        stats: post?.stats ?? "",
        note,
        status: post ? "ok" : "needs_text",
        error,
      })
      .onConflictDoNothing()
      .returning({ id: schema.referencePosts.id })
      .get();
    if (!row) result.duplicates++;
    else {
      newIds.push(row.id);
      if (post) result.added++;
      else result.needsText++;
    }
  }
  await analyze(newIds);
  if (result.added) await rebuildReferenceProfile();
  return result;
}

/** The owner pasted the text of a post the app couldn't read. */
export async function setReferenceText(id: number, text: string) {
  db.update(schema.referencePosts)
    .set({ text: text.trim(), status: "ok", error: null })
    .where(eq(schema.referencePosts.id, id))
    .run();
  await analyze([id]);
  await rebuildReferenceProfile();
}

export async function deleteReferencePost(id: number) {
  db.delete(schema.referencePosts).where(eq(schema.referencePosts.id, id)).run();
  await rebuildReferenceProfile();
}

export function hasReferencePosts(): boolean {
  return db
    .select()
    .from(schema.referencePosts)
    .all()
    .some((p) => p.gistEn);
}

const themesSchema = z.object({
  themes: z.array(
    z.object({
      label: z.string().describe("Short English name of the theme"),
      xKeywords: z
        .array(z.string())
        .describe("3–6 short English search terms people use in X posts about this theme (no hashtags, no quotes)"),
      webSubject: z.string().describe("One English sentence describing stories to look for"),
    }),
  ),
});

/** English search themes that would surface items like the owner's top posts. */
export async function similarSearchThemes(max: number) {
  const settings = db.select().from(schema.settings).where(eq(schema.settings.id, 1)).get();
  const posts = db
    .select()
    .from(schema.referencePosts)
    .all()
    .filter((p) => p.gistEn)
    .slice(0, 30);
  if (!posts.length) throw new Error("Add your top Threads posts in Settings first");
  const { themes } = await aiObject(themesSchema, {
    instructions: `From a creator's best-performing posts, derive up to ${max} distinct English search themes that would find fresh news or posts they could turn into similar content. Prefer the themes that appear most often.`,
    prompt: [
      settings?.referenceProfile ? `Profile:\n${settings.referenceProfile}\n` : "",
      "Top posts:",
      ...posts.map((p) => `- ${p.gistEn} (${p.themes})`),
    ].join("\n"),
  });
  return themes.slice(0, max);
}

/** Block added to the judge's instructions; empty when there are no top posts. */
export function referenceBlock(): string {
  const settings = db.select().from(schema.settings).where(eq(schema.settings.id, 1)).get();
  const posts: ReferencePost[] = db
    .select()
    .from(schema.referencePosts)
    .all()
    .filter((p) => p.gistEn)
    .slice(0, 20);
  if (!posts.length) return "";
  return [
    "The owner's best-performing posts (translated to English). Items that would make a similar post (same kind of topic, angle or hook) deserve a HIGHER importance; set matchesTop=true for them and mention the similarity in the reason.",
    settings?.referenceProfile ? `What works for this audience:\n${settings.referenceProfile}` : "",
    ...posts.map((p) => `- ${p.gistEn.slice(0, 200)} (${p.themes.slice(0, 120)})`),
  ]
    .filter(Boolean)
    .join("\n");
}
