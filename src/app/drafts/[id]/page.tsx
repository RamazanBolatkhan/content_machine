import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { DraftEditor } from "@/components/DraftEditor";
import { MediaGrid } from "@/components/MediaGrid";
import { SourceBadge } from "@/components/SourceBadge";
import { StatusButtons } from "@/components/StatusButtons";
import { enabledLangs } from "@/lib/languages";
import { getDraft, getSettings } from "@/lib/queries";
import { formatCount, timeAgo } from "@/lib/util";

// Reads the local database on every request
export const instant = false;

export default async function DraftPage({ params }: PageProps<"/drafts/[id]">) {
  await connection();
  const { id } = await params;
  const found = getDraft(Number(id));
  if (!found) notFound();
  const { draft, versions, topicName } = found;
  const settings = getSettings();
  const m = draft.metrics;
  const isX = draft.source === "x_bookmark" || draft.source === "x_search";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="text-sm text-zinc-500 hover:underline">
          ← Back to drafts
        </Link>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-zinc-200 px-3 py-1 text-xs capitalize dark:bg-zinc-800">{draft.status}</span>
          <StatusButtons draftId={draft.id} status={draft.status} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-3 p-4">
          <div className="flex items-center justify-between">
            <span className="label">Original {topicName && `· ${topicName}`}</span>
            <a href={draft.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-sky-600 hover:underline">
              Open source ↗
            </a>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-sm text-zinc-500">
            {isX && <b className="text-zinc-900 dark:text-zinc-100">{draft.sourceName}</b>}
            <SourceBadge draft={draft} />
            {draft.postedAt && <span>· {timeAgo(draft.postedAt)}</span>}
          </div>
          <p className="whitespace-pre-wrap">{draft.originalText}</p>
          <MediaGrid media={draft.media} />
          <div className="text-xs text-zinc-500">
            {m && (
              <>
                ❤️ {formatCount(m.likes)} · 🔁 {formatCount(m.reposts)} · 💬 {formatCount(m.replies)} · 👁 {formatCount(m.views)} ·{" "}
              </>
            )}
            AI importance <b>⭐ {draft.score}/10</b>
          </div>
          {draft.aiReason && <p className="text-sm text-zinc-500 italic">🤖 {draft.aiReason}</p>}
          <p className="text-xs text-zinc-500">
            Tip: credit the source when posting (e.g. “Source: {isX ? `@${draft.authorHandle}` : draft.sourceName}”).
          </p>
        </section>

        <section>
          <DraftEditor
            key={versions[0]?.id}
            draftId={draft.id}
            versions={versions}
            langs={enabledLangs(settings)}
            charLimit={settings.charLimit}
            hasMedia={draft.media.some((x) => x.file)}
          />
        </section>
      </div>
    </div>
  );
}
