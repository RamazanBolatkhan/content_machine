"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { DRAFT_STATUSES, JOB_KINDS, type DraftStatus, type JobKind } from "@/db/schema";
import { JOB_PAYLOADS } from "@/lib/jobs/payloads";
import { isLangCode, LANG_CODES } from "@/lib/languages";
import { enqueueJob } from "@/lib/queries";
import { disconnectX } from "@/lib/x/auth";

/**
 * Queue work for the local worker (X + Claude). The page then polls /api/jobs/<id>.
 * Everything else below writes to the database directly.
 */
export async function startJob(kind: JobKind, payload: Record<string, unknown> = {}): Promise<{ jobId?: number; error?: string }> {
  if (!JOB_KINDS.includes(kind)) return { error: "Unknown job" };
  const parsed = JOB_PAYLOADS[kind].safeParse(payload);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid request" };
  return { jobId: await enqueueJob(kind, parsed.data as Record<string, unknown>) };
}

export async function refreshAfterJob() {
  revalidatePath("/");
  revalidatePath("/settings");
}

export async function disconnectXAction() {
  await disconnectX();
  revalidatePath("/settings");
}

export async function setDraftStatus(draftId: number, status: DraftStatus) {
  if (!DRAFT_STATUSES.includes(status)) throw new Error("Bad status");
  await db.update(schema.drafts).set({ status }).where(eq(schema.drafts.id, draftId));
  revalidatePath("/");
  revalidatePath(`/drafts/${draftId}`);
}

export async function saveManualVersion(draftId: number, lang: string, value: string) {
  const text = value.trim();
  if (!text || !isLangCode(lang)) return;
  await db.insert(schema.draftVersions).values({ draftId, lang, text, source: "manual" });
  revalidatePath(`/drafts/${draftId}`);
  revalidatePath("/");
}

export async function deleteDraft(draftId: number) {
  await db.delete(schema.drafts).where(eq(schema.drafts.id, draftId));
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
  if (id) await db.update(schema.topics).set(values).where(eq(schema.topics.id, id));
  else await db.insert(schema.topics).values(values);
  revalidatePath("/settings");
  revalidatePath("/");
}

export async function deleteTopic(formData: FormData) {
  const id = Number(formData.get("id"));
  if (id) await db.delete(schema.topics).where(eq(schema.topics.id, id));
  revalidatePath("/settings");
  revalidatePath("/");
}

export async function saveSettings(formData: FormData) {
  await db
    .update(schema.settings)
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
    .where(eq(schema.settings.id, 1));
  revalidatePath("/settings");
}
