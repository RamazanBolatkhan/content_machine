import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Draft, DraftStatus, DraftVersion } from "@/db/schema";

/** Latest text per language, e.g. { ja: "…", es: "…" }. */
export type LatestTexts = Record<string, string>;

export type DraftWithTexts = Draft & { texts: LatestTexts; topicName: string | null };

export function getSettings() {
  return db.select().from(schema.settings).where(eq(schema.settings.id, 1)).get()!;
}

export function getTopics() {
  return db.select().from(schema.topics).orderBy(schema.topics.name).all();
}

export function latestTexts(versions: Pick<DraftVersion, "id" | "lang" | "text">[]): LatestTexts {
  const out: LatestTexts = {};
  // Later versions overwrite earlier ones
  for (const v of [...versions].sort((a, b) => a.id - b.id)) out[v.lang] = v.text;
  return out;
}

export function listDrafts(filter: { status?: DraftStatus; topicId?: number }): DraftWithTexts[] {
  const topics = new Map(getTopics().map((t) => [t.id, t.name]));
  const byDraft = new Map<number, Pick<DraftVersion, "id" | "lang" | "text">[]>();
  for (const v of db
    .select({ id: schema.draftVersions.id, draftId: schema.draftVersions.draftId, lang: schema.draftVersions.lang, text: schema.draftVersions.text })
    .from(schema.draftVersions)
    .all()) {
    if (!byDraft.has(v.draftId)) byDraft.set(v.draftId, []);
    byDraft.get(v.draftId)!.push(v);
  }
  return db
    .select()
    .from(schema.drafts)
    .orderBy(desc(schema.drafts.score), desc(schema.drafts.id))
    .all()
    .filter((d) => (!filter.status || d.status === filter.status) && (!filter.topicId || d.topicId === filter.topicId))
    .map((d) => ({
      ...d,
      texts: latestTexts(byDraft.get(d.id) ?? []),
      topicName: d.topicId ? (topics.get(d.topicId) ?? null) : null,
    }));
}

export function getDraft(id: number): { draft: Draft; versions: DraftVersion[]; topicName: string | null } | null {
  const draft = db.select().from(schema.drafts).where(eq(schema.drafts.id, id)).get();
  if (!draft) return null;
  const versions = db
    .select()
    .from(schema.draftVersions)
    .where(eq(schema.draftVersions.draftId, id))
    .orderBy(desc(schema.draftVersions.id))
    .all();
  const topic = draft.topicId ? db.select().from(schema.topics).where(eq(schema.topics.id, draft.topicId)).get() : null;
  return { draft, versions, topicName: topic?.name ?? null };
}

export function recentRuns(limit = 15) {
  const topics = new Map(getTopics().map((t) => [t.id, t.name]));
  return db
    .select()
    .from(schema.scoutRuns)
    .orderBy(desc(schema.scoutRuns.id))
    .limit(limit)
    .all()
    .map((r) => ({ ...r, topicName: r.topicId ? (topics.get(r.topicId) ?? "deleted") : "–" }));
}
