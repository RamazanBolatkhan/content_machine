import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Draft, DraftStatus, DraftVersion } from "@/db/schema";

export type DraftWithText = Draft & { textRu: string; gameName: string | null };

export function getSettings() {
  return db.select().from(schema.settings).where(eq(schema.settings.id, 1)).get()!;
}

export function getGames() {
  return db.select().from(schema.games).orderBy(schema.games.name).all();
}

function latestTextByDraft(): Map<number, string> {
  const rows = db
    .select({ draftId: schema.draftVersions.draftId, textRu: schema.draftVersions.textRu })
    .from(schema.draftVersions)
    .orderBy(schema.draftVersions.id)
    .all();
  // Later versions overwrite earlier ones
  return new Map(rows.map((r) => [r.draftId, r.textRu]));
}

export function listDrafts(filter: { status?: DraftStatus; gameId?: number }): DraftWithText[] {
  const games = new Map(getGames().map((g) => [g.id, g.name]));
  const texts = latestTextByDraft();
  return db
    .select()
    .from(schema.drafts)
    .orderBy(desc(schema.drafts.score))
    .all()
    .filter((d) => (!filter.status || d.status === filter.status) && (!filter.gameId || d.gameId === filter.gameId))
    .map((d) => ({ ...d, textRu: texts.get(d.id) ?? "", gameName: d.gameId ? (games.get(d.gameId) ?? null) : null }));
}

export function getDraft(id: number): { draft: Draft; versions: DraftVersion[]; gameName: string | null } | null {
  const draft = db.select().from(schema.drafts).where(eq(schema.drafts.id, id)).get();
  if (!draft) return null;
  const versions = db
    .select()
    .from(schema.draftVersions)
    .where(eq(schema.draftVersions.draftId, id))
    .orderBy(desc(schema.draftVersions.id))
    .all();
  const game = draft.gameId ? db.select().from(schema.games).where(eq(schema.games.id, draft.gameId)).get() : null;
  return { draft, versions, gameName: game?.name ?? null };
}

export function recentRuns(limit = 15) {
  const games = new Map(getGames().map((g) => [g.id, g.name]));
  return db
    .select()
    .from(schema.scoutRuns)
    .orderBy(desc(schema.scoutRuns.id))
    .limit(limit)
    .all()
    .map((r) => ({ ...r, gameName: r.gameId ? (games.get(r.gameId) ?? "deleted") : "–" }));
}
