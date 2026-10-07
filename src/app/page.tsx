import Link from "next/link";
import { connection } from "next/server";
import { DRAFT_STATUSES, type DraftStatus } from "@/db/schema";
import { MediaGrid } from "@/components/MediaGrid";
import { CollectButtons } from "@/components/CollectButtons";
import { SourceBadge } from "@/components/SourceBadge";
import { StatusButtons } from "@/components/StatusButtons";
import { getGames, listDrafts } from "@/lib/queries";
import { formatCount, timeAgo } from "@/lib/util";
import { xAccount } from "@/lib/x/auth";

// Reads the local database on every request
export const instant = false;

const STATUS_LABEL: Record<DraftStatus, string> = {
  new: "New",
  approved: "Approved",
  rejected: "Rejected",
  posted: "Posted",
};

export default async function DraftsBoard({ searchParams }: PageProps<"/">) {
  await connection();
  const sp = await searchParams;
  const status = (DRAFT_STATUSES as readonly string[]).includes(String(sp.status))
    ? (sp.status as DraftStatus)
    : "new";
  const gameId = Number(sp.game) || undefined;

  const games = getGames();
  const drafts = listDrafts({ status, gameId });
  const href = (s: DraftStatus, g?: number) => `/?status=${s}${g ? `&game=${g}` : ""}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Drafts</h1>
          <p className="text-sm text-zinc-500">
            Your X bookmarks and fresh gaming news, translated to Russian. Review, edit, then post to Threads yourself.
          </p>
        </div>
        <CollectButtons
          games={games.filter((g) => g.enabled).map((g) => ({ id: g.id, name: g.name }))}
          xConnected={xAccount() !== null}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {DRAFT_STATUSES.map((s) => (
          <Link
            key={s}
            href={href(s, gameId)}
            className={`rounded-full px-3 py-1 ${s === status ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-zinc-200 dark:bg-zinc-800"}`}
          >
            {STATUS_LABEL[s]}
          </Link>
        ))}
        <span className="mx-2 text-zinc-300">|</span>
        <Link href={href(status)} className={!gameId ? "font-semibold" : "text-zinc-500"}>
          All games
        </Link>
        {games.map((g) => (
          <Link key={g.id} href={href(status, g.id)} className={gameId === g.id ? "font-semibold" : "text-zinc-500"}>
            {g.name}
          </Link>
        ))}
      </div>

      {games.length === 0 ? (
        <div className="card p-8 text-center text-zinc-500">
          No games yet. <Link href="/settings" className="underline">Add your first game in Settings</Link>.
        </div>
      ) : drafts.length === 0 ? (
        <div className="card p-8 text-center text-zinc-500">Nothing here. Bookmark posts on X and press “Import bookmarks”, or press “Find news”.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {drafts.map((d) => (
            <article key={d.id} className="card flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between gap-2 text-xs text-zinc-500">
                <span className="flex flex-wrap items-center gap-1.5">
                  {d.gameName && <span className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">🎮 {d.gameName}</span>}
                  <SourceBadge draft={d} />
                  {d.postedAt && <span>· {timeAgo(d.postedAt)}</span>}
                </span>
                <span className="shrink-0">
                  {d.metrics && (
                    <>
                      ❤️ {formatCount(d.metrics.likes)} · 👁 {formatCount(d.metrics.views)} ·{" "}
                    </>
                  )}
                  <b title="AI importance, 1–10">⭐ {d.score}</b>
                </span>
              </div>

              <p className="line-clamp-3 text-sm text-zinc-500">{d.originalText}</p>
              <p className="whitespace-pre-wrap">{d.textRu}</p>
              <MediaGrid media={d.media} small />
              {d.aiReason && <p className="text-xs text-zinc-500 italic">🤖 {d.aiReason}</p>}

              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
                <StatusButtons draftId={d.id} status={d.status} />
                <Link href={`/drafts/${d.id}`} className="btn btn-primary">
                  ✏️ Open editor
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
