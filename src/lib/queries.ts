import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Draft, DraftStatus, DraftVersion, Job, JobKind, Settings, WorkerInfo } from "@/db/schema";

/** Latest text per language, e.g. { ja: "…", es: "…" }. */
export type LatestTexts = Record<string, string>;

export type DraftWithTexts = Draft & { texts: LatestTexts; topicName: string | null };

const first = <T>(rows: T[]): T | undefined => rows[0];

export async function getSettings(): Promise<Settings> {
  const row = first(await db.select().from(schema.settings).where(eq(schema.settings.id, 1)));
  if (row) return row;
  await db.insert(schema.settings).values({ id: 1 }).onConflictDoNothing();
  return first(await db.select().from(schema.settings).where(eq(schema.settings.id, 1)))!;
}

export async function getReferencePosts() {
  return db.select().from(schema.referencePosts).orderBy(desc(schema.referencePosts.id));
}

export async function getTopics() {
  return db.select().from(schema.topics).orderBy(schema.topics.name);
}

export async function getTopic(id: number) {
  return first(await db.select().from(schema.topics).where(eq(schema.topics.id, id)));
}

export function latestTexts(versions: Pick<DraftVersion, "id" | "lang" | "text">[]): LatestTexts {
  const out: LatestTexts = {};
  // Later versions overwrite earlier ones
  for (const v of [...versions].sort((a, b) => a.id - b.id)) out[v.lang] = v.text;
  return out;
}

/** topicId: a topic id, "none" for drafts without a topic, or undefined for all. */
export async function listDrafts(filter: { status?: DraftStatus; topicId?: number | "none" }): Promise<DraftWithTexts[]> {
  const [topicRows, versionRows, draftRows] = await Promise.all([
    getTopics(),
    db
      .select({
        id: schema.draftVersions.id,
        draftId: schema.draftVersions.draftId,
        lang: schema.draftVersions.lang,
        text: schema.draftVersions.text,
      })
      .from(schema.draftVersions),
    db.select().from(schema.drafts).orderBy(desc(schema.drafts.score), desc(schema.drafts.id)),
  ]);
  const topics = new Map(topicRows.map((t) => [t.id, t.name]));
  const byDraft = new Map<number, Pick<DraftVersion, "id" | "lang" | "text">[]>();
  for (const v of versionRows) {
    if (!byDraft.has(v.draftId)) byDraft.set(v.draftId, []);
    byDraft.get(v.draftId)!.push(v);
  }
  return draftRows
    .filter((d) => !filter.status || d.status === filter.status)
    .filter((d) => (filter.topicId === "none" ? d.topicId == null : !filter.topicId || d.topicId === filter.topicId))
    .map((d) => ({
      ...d,
      texts: latestTexts(byDraft.get(d.id) ?? []),
      topicName: d.topicId ? (topics.get(d.topicId) ?? null) : null,
    }));
}

export async function getDraft(
  id: number,
): Promise<{ draft: Draft; versions: DraftVersion[]; topicName: string | null } | null> {
  const draft = first(await db.select().from(schema.drafts).where(eq(schema.drafts.id, id)));
  if (!draft) return null;
  const [versions, topic] = await Promise.all([
    db
      .select()
      .from(schema.draftVersions)
      .where(eq(schema.draftVersions.draftId, id))
      .orderBy(desc(schema.draftVersions.id)),
    draft.topicId ? getTopic(draft.topicId) : Promise.resolve(undefined),
  ]);
  return { draft, versions, topicName: topic?.name ?? null };
}

export async function recentRuns(limit = 15) {
  const [topicRows, runs] = await Promise.all([
    getTopics(),
    db.select().from(schema.scoutRuns).orderBy(desc(schema.scoutRuns.id)).limit(limit),
  ]);
  const topics = new Map(topicRows.map((t) => [t.id, t.name]));
  return runs.map((r) => ({ ...r, topicName: r.topicId ? (topics.get(r.topicId) ?? "deleted") : "–" }));
}

/**
 * The most recent search: every run started by the same job (one per topic),
 * or the single latest run when it wasn't started by a job (e.g. scout:loop).
 */
export async function latestSearch(): Promise<{ runIds: Set<number>; at: Date | null }> {
  const [last] = await db.select().from(schema.scoutRuns).orderBy(desc(schema.scoutRuns.id)).limit(1);
  if (!last) return { runIds: new Set(), at: null };
  const runs = last.jobId
    ? await db.select({ id: schema.scoutRuns.id }).from(schema.scoutRuns).where(eq(schema.scoutRuns.jobId, last.jobId))
    : [{ id: last.id }];
  return { runIds: new Set(runs.map((r) => r.id)), at: last.startedAt };
}

// ---------- Jobs + worker ----------

export async function enqueueJob(kind: JobKind, payload: Record<string, unknown> = {}): Promise<number> {
  const [row] = await db.insert(schema.jobs).values({ kind, payload }).returning({ id: schema.jobs.id });
  return row.id;
}

export async function getJob(id: number): Promise<Job | undefined> {
  return first(await db.select().from(schema.jobs).where(eq(schema.jobs.id, id)));
}

/** Worker is "online" if it checked in within the last 90 seconds. */
export async function getWorker(): Promise<{ online: boolean; lastSeen: Date | null; info: WorkerInfo | null }> {
  const row = first(await db.select().from(schema.workerStatus).where(eq(schema.workerStatus.id, 1)));
  if (!row) return { online: false, lastSeen: null, info: null };
  return { online: Date.now() - row.lastSeen.getTime() < 90_000, lastSeen: row.lastSeen, info: row.info };
}
