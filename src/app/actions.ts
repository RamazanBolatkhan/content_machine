"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { DRAFT_STATUSES, type DraftStatus } from "@/db/schema";
import { findNews, syncBookmarks, type RunResult } from "@/lib/agents/scout";
import { writeMissingLanguages } from "@/lib/agents/editor";
import {
  addReferencePosts,
  deleteReferencePost,
  rebuildReferenceProfile,
  setReferenceText,
  type AddResult,
} from "@/lib/agents/reference";
import { improveTopic, type TopicSetupResult } from "@/lib/agents/topic-setup";
import { isLangCode, LANG_CODES } from "@/lib/languages";
import { disconnectX } from "@/lib/x/auth";

export type CollectState = { results: RunResult[]; at: number } | null;

export async function collectAction(_prev: CollectState, formData: FormData): Promise<CollectState> {
  const results =
    formData.get("kind") === "bookmarks"
      ? [await syncBookmarks()]
      : await findNews(Number(formData.get("topicId")) || undefined);
  revalidatePath("/");
  revalidatePath("/settings");
  return { results, at: Date.now() };
}

export async function disconnectXAction() {
  disconnectX();
  revalidatePath("/settings");
}

export async function setDraftStatus(draftId: number, status: DraftStatus) {
  if (!DRAFT_STATUSES.includes(status)) throw new Error("Bad status");
  db.update(schema.drafts).set({ status }).where(eq(schema.drafts.id, draftId)).run();
  revalidatePath("/");
  revalidatePath(`/drafts/${draftId}`);
}

export async function saveManualVersion(draftId: number, lang: string, value: string) {
  const text = value.trim();
  if (!text || !isLangCode(lang)) return;
  db.insert(schema.draftVersions).values({ draftId, lang, text, source: "manual" }).run();
  revalidatePath(`/drafts/${draftId}`);
  revalidatePath("/");
}

export async function writeMissingLanguagesAction(draftId: number): Promise<{ written: number; error?: string }> {
  try {
    const written = await writeMissingLanguages(draftId);
    revalidatePath(`/drafts/${draftId}`);
    revalidatePath("/");
    return { written };
  } catch (e) {
    return { written: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function improveTopicAction(topicId: number): Promise<{ result?: TopicSetupResult; error?: string }> {
  try {
    const result = await improveTopic(topicId);
    revalidatePath("/settings");
    return { result };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

// ---- Top Threads posts ----

export type TopPostsState = { result?: AddResult; error?: string } | null;

export async function addTopPostsAction(_prev: TopPostsState, formData: FormData): Promise<TopPostsState> {
  const urls = String(formData.get("urls") ?? "")
    .split(/\s+/)
    .map((u) => u.trim())
    .filter(Boolean);
  if (!urls.length) return { error: "Paste at least one Threads link" };
  try {
    const result = await addReferencePosts(urls.slice(0, 30), String(formData.get("note") ?? "").trim());
    revalidatePath("/settings");
    return { result };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function setTopPostTextAction(id: number, text: string): Promise<{ error?: string }> {
  if (!text.trim()) return { error: "Paste the post text" };
  try {
    await setReferenceText(id, text);
    revalidatePath("/settings");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteTopPostAction(id: number) {
  await deleteReferencePost(id);
  revalidatePath("/settings");
}

export async function rebuildProfileAction(): Promise<{ error?: string }> {
  try {
    await rebuildReferenceProfile();
    revalidatePath("/settings");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteDraft(draftId: number) {
  db.delete(schema.drafts).where(eq(schema.drafts.id, draftId)).run();
  revalidatePath("/");
}

// ---- Settings ----

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const int = (f: FormData, k: string, fallback: number) => {
  const n = Number(f.get(k));
  return f.get(k) != null && Number.isFinite(n) && n >= 0 ? Math.round(n) : fallback;
};
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const bool = (f: FormData, k: string) => f.get(k) === "on";

export async function saveTopic(formData: FormData) {
  const id = Number(formData.get("id")) || undefined;
  const values = {
    name: text(formData, "name"),
    description: text(formData, "description"),
    keywords: text(formData, "keywords"),
    feeds: text(formData, "feeds"),
    trustedAccounts: text(formData, "trustedAccounts"),
    enabled: formData.get("enabled") === "on",
  };
  if (!values.name) return;
  if (id) db.update(schema.topics).set(values).where(eq(schema.topics.id, id)).run();
  else db.insert(schema.topics).values(values).run();
  revalidatePath("/settings");
  revalidatePath("/");
}

export async function deleteTopic(formData: FormData) {
  const id = Number(formData.get("id"));
  if (id) db.delete(schema.topics).where(eq(schema.topics.id, id)).run();
  revalidatePath("/settings");
  revalidatePath("/");
}

export async function saveSettings(formData: FormData) {
  db.update(schema.settings)
    .set({
      bookmarksPerSync: clamp(int(formData, "bookmarksPerSync", 20), 1, 200),
      rssEnabled: bool(formData, "rssEnabled"),
      webSearchEnabled: bool(formData, "webSearchEnabled"),
      xSearchEnabled: bool(formData, "xSearchEnabled"),
      newsFeeds: text(formData, "newsFeeds"),
      maxAgeHours: clamp(int(formData, "maxAgeHours", 48), 1, 167),
      candidatesPerTopic: clamp(int(formData, "candidatesPerTopic", 50), 1, 100),
      minLikes: int(formData, "minLikes", 100),
      minViews: int(formData, "minViews", 0),
      fetchPerTopic: clamp(int(formData, "fetchPerTopic", 30), 10, 100),
      searchLang: text(formData, "searchLang"),
      languages: LANG_CODES.filter((code) => formData.get(`lang_${code}`) === "on"),
      charLimit: clamp(int(formData, "charLimit", 500), 50, 10_000),
      blocklist: text(formData, "blocklist"),
      stylePrompt: text(formData, "stylePrompt"),
      glossary: text(formData, "glossary"),
    })
    .where(eq(schema.settings.id, 1))
    .run();
  revalidatePath("/settings");
}
