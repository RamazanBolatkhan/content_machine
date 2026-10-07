"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { DRAFT_STATUSES, type DraftStatus } from "@/db/schema";
import { findNews, syncBookmarks, type RunResult } from "@/lib/agents/scout";
import { disconnectX } from "@/lib/x/auth";

export type CollectState = { results: RunResult[]; at: number } | null;

export async function collectAction(_prev: CollectState, formData: FormData): Promise<CollectState> {
  const results =
    formData.get("kind") === "bookmarks"
      ? [await syncBookmarks()]
      : await findNews(Number(formData.get("gameId")) || undefined);
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

export async function saveManualVersion(draftId: number, textRu: string) {
  const text = textRu.trim();
  if (!text) return;
  db.insert(schema.draftVersions).values({ draftId, textRu: text, source: "manual" }).run();
  revalidatePath(`/drafts/${draftId}`);
  revalidatePath("/");
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

export async function saveGame(formData: FormData) {
  const id = Number(formData.get("id")) || undefined;
  const values = {
    name: text(formData, "name"),
    keywords: text(formData, "keywords"),
    feeds: text(formData, "feeds"),
    trustedAccounts: text(formData, "trustedAccounts"),
    enabled: formData.get("enabled") === "on",
  };
  if (!values.name) return;
  if (id) db.update(schema.games).set(values).where(eq(schema.games.id, id)).run();
  else db.insert(schema.games).values(values).run();
  revalidatePath("/settings");
  revalidatePath("/");
}

export async function deleteGame(formData: FormData) {
  const id = Number(formData.get("id"));
  if (id) db.delete(schema.games).where(eq(schema.games.id, id)).run();
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
      candidatesPerGame: clamp(int(formData, "candidatesPerGame", 15), 1, 40),
      minLikes: int(formData, "minLikes", 100),
      minViews: int(formData, "minViews", 0),
      fetchPerGame: clamp(int(formData, "fetchPerGame", 30), 10, 100),
      searchLang: text(formData, "searchLang"),
      blocklist: text(formData, "blocklist"),
      stylePrompt: text(formData, "stylePrompt"),
      glossary: text(formData, "glossary"),
    })
    .where(eq(schema.settings.id, 1))
    .run();
  revalidatePath("/settings");
}
