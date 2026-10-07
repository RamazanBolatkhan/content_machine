import Link from "next/link";
import { connection } from "next/server";
import { DRAFT_STATUSES, type DraftStatus } from "@/db/schema";
import { MediaGrid } from "@/components/MediaGrid";
import { CollectButtons } from "@/components/CollectButtons";
import { SourceBadge } from "@/components/SourceBadge";
import { StatusButtons } from "@/components/StatusButtons";
import { enabledLangs, isLangCode, langInfo, type LangCode } from "@/lib/languages";
import { getSettings, getTopics, listDrafts } from "@/lib/queries";
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
  const topicId = Number(sp.topic) || undefined;

  const topics = getTopics();
  const langs = enabledLangs(getSettings());
  const drafts = listDrafts({ status, topicId });
  // Which text the cards show: the original post, or one of the languages
  const view: LangCode | "original" = isLangCode(sp.lang) && langs.includes(sp.lang) ? sp.lang : "original";
  const href = (s: DraftStatus, t?: number, v: LangCode | "original" = view) => {
    const q = new URLSearchParams({ status: s });
    if (t) q.set("topic", String(t));
    if (v !== "original") q.set("lang", v);
    return `/?${q}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Drafts</h1>
          <p className="text-sm text-zinc-500">
            Popular X posts and fresh AI news, written in {langs.map((c) => langInfo(c).flag).join(" ")}. Review, edit, then post
            yourself.
          </p>
        </div>
        <CollectButtons
          topics={topics.filter((t) => t.enabled).map((t) => ({ id: t.id, name: t.name }))}
          xConnected={xAccount() !== null}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {DRAFT_STATUSES.map((s) => (
          <Link
            key={s}
            href={href(s, topicId)}
            className={`rounded-full px-3 py-1 ${s === status ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-zinc-200 dark:bg-zinc-800"}`}
          >
            {STATUS_LABEL[s]}
          </Link>
        ))}
        <span className="mx-2 text-zinc-300">|</span>
        <Link href={href(status)} className={!topicId ? "font-semibold" : "text-zinc-500"}>
          All topics
        </Link>
        {topics.map((t) => (
          <Link key={t.id} href={href(status, t.id)} className={topicId === t.id ? "font-semibold" : "text-zinc-500"}>
            {t.name}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <span className="mr-1 text-zinc-500">Show cards in:</span>
        <Link
          href={href(status, topicId, "original")}
          className={`rounded-full px-3 py-1 ${view === "original" ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-zinc-200 dark:bg-zinc-800"}`}
        >
          📄 Original
        </Link>
        {langs.map((c) => (
          <Link
            key={c}
            href={href(status, topicId, c)}
            className={`rounded-full px-3 py-1 ${view === c ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-zinc-200 dark:bg-zinc-800"}`}
          >
            {langInfo(c).flag} {langInfo(c).native}
          </Link>
        ))}
      </div>

      {topics.length === 0 ? (
        <div className="card p-8 text-center text-zinc-500">
          No topics yet. <Link href="/settings" className="underline">Add your first topic in Settings</Link>.
        </div>
      ) : drafts.length === 0 ? (
        <div className="card p-8 text-center text-zinc-500">Nothing here yet. Press “Find posts &amp; news”.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {drafts.map((d) => (
            <article key={d.id} className="card flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between gap-2 text-xs text-zinc-500">
                <span className="flex flex-wrap items-center gap-1.5">
                  {d.topicName && <span className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">🤖 {d.topicName}</span>}
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

              <CardText original={d.originalText} texts={d.texts} langs={langs} view={view} />
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

function CardText({
  original,
  texts,
  langs,
  view,
}: {
  original: string;
  texts: Record<string, string>;
  langs: LangCode[];
  view: LangCode | "original";
}) {
  return (
    <div className="space-y-2">
      {view === "original" ? (
        <p className="line-clamp-8 whitespace-pre-wrap">{original}</p>
      ) : (
        <>
          {texts[view] ? (
            <p className="line-clamp-8 whitespace-pre-wrap" lang={view}>
              {texts[view]}
            </p>
          ) : (
            <p className="text-sm text-zinc-500 italic">Not written in {langInfo(view).name} yet. Open the editor to write it.</p>
          )}
          <p className="line-clamp-2 text-sm text-zinc-500">📄 {original}</p>
        </>
      )}
      <div className="flex flex-wrap gap-1 text-xs">
        {langs.map((c) => (
          <span
            key={c}
            title={texts[c] ? `${langInfo(c).name}: written` : `${langInfo(c).name}: missing`}
            className={`rounded px-1.5 py-0.5 ${texts[c] ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-zinc-100 text-zinc-400 line-through dark:bg-zinc-800"}`}
          >
            {langInfo(c).flag} {c.toUpperCase()}
          </span>
        ))}
      </div>
    </div>
  );
}
