import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, ArrowUpRight, Eye, Heart, Info, MessageCircle, Repeat2, Sparkles } from "lucide-react";
import { DraftEditor } from "@/components/DraftEditor";
import { MediaGrid } from "@/components/MediaGrid";
import { SourceBadge } from "@/components/SourceBadge";
import { StatusButtons } from "@/components/StatusButtons";
import { enabledLangs } from "@/lib/languages";
import { getDraft, getSettings } from "@/lib/queries";
import { formatCount, timeAgo } from "@/lib/util";

// Reads the local database on every request
export const instant = false;

const STATUS_LABEL = { new: "New", approved: "Approved", rejected: "Rejected", posted: "Posted" } as const;

export default async function DraftPage({ params }: PageProps<"/drafts/[id]">) {
  await connection();
  const { id } = await params;
  const found = getDraft(Number(id));
  if (!found) notFound();
  const { draft, versions, topicName } = found;
  const settings = getSettings();
  const m = draft.metrics;
  const isX = draft.source === "x_bookmark" || draft.source === "x_search";
  const credit = isX ? `@${draft.authorHandle}` : draft.sourceName;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <Link href="/" className="btn btn-tertiary -ml-2 h-auto">
            <ArrowLeft size={16} aria-hidden /> Back to drafts
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="t-h2">Edit draft</h1>
            <span className="badge badge-outline">{STATUS_LABEL[draft.status]}</span>
          </div>
        </div>
        <StatusButtons draftId={draft.id} status={draft.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section className="card h-fit space-y-4 p-6" aria-labelledby="original-heading">
          <div className="flex items-center justify-between gap-4">
            <h2 id="original-heading" className="t-h5">
              Original
            </h2>
            <a href={draft.sourceUrl} target="_blank" rel="noreferrer" className="btn btn-tertiary btn-sm">
              Open source <ArrowUpRight size={16} aria-hidden />
            </a>
          </div>

          <div className="t-caption flex flex-wrap items-center gap-2">
            {topicName && <span className="badge">{topicName}</span>}
            <SourceBadge draft={draft} />
            {draft.postedAt && <span className="text-muted">{timeAgo(draft.postedAt)}</span>}
          </div>

          {isX && draft.sourceName && <p className="t-h6">{draft.sourceName}</p>}
          <p className="t-body whitespace-pre-wrap">{draft.originalText}</p>
          <MediaGrid media={draft.media} />

          <div className="divider" />

          <dl className="t-small flex flex-wrap gap-x-6 gap-y-2">
            <Stat label="AI importance" value={`${draft.score}/10`} />
            {m && (
              <>
                <Stat label="Likes" icon={<Heart size={14} aria-hidden />} value={formatCount(m.likes)} />
                <Stat label="Reposts" icon={<Repeat2 size={14} aria-hidden />} value={formatCount(m.reposts)} />
                <Stat label="Replies" icon={<MessageCircle size={14} aria-hidden />} value={formatCount(m.replies)} />
                <Stat label="Views" icon={<Eye size={14} aria-hidden />} value={formatCount(m.views)} />
              </>
            )}
          </dl>

          {draft.aiReason && (
            <p className="t-small flex gap-2 text-muted">
              <Sparkles size={16} className="mt-0.5 shrink-0" aria-hidden />
              {draft.aiReason}
            </p>
          )}

          <div className="infobox">
            <Info size={18} className="shrink-0" aria-hidden />
            <p>
              Credit the source when posting, e.g. <span className="font-semibold">“Source: {credit}”</span>.
            </p>
          </div>
        </section>

        <DraftEditor
          key={versions[0]?.id}
          draftId={draft.id}
          versions={versions}
          langs={enabledLangs(settings)}
          charLimit={settings.charLimit}
          hasMedia={draft.media.some((x) => x.file)}
        />
      </div>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <dt className="flex items-center gap-1 text-muted">
        {icon}
        <span className={icon ? "sr-only" : ""}>{label}</span>
      </dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
