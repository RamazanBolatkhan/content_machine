import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, ArrowUpRight, Eye, Heart, Inbox, Sparkles, Star } from "lucide-react";
import { DRAFT_STATUSES, type DraftStatus } from "@/db/schema";
import { CollectButtons } from "@/components/CollectButtons";
import { SourceBadge } from "@/components/SourceBadge";
import { StatusButtons } from "@/components/StatusButtons";
import { WriteButton } from "@/components/WriteButton";
import { enabledLangs, isLangCode, langInfo, type LangCode } from "@/lib/languages";
import { getSettings, getTopics, latestSearch, listDrafts } from "@/lib/queries";
import { formatCount, timeAgo } from "@/lib/util";
import { hasReferencePosts } from "@/lib/agents/reference";
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
  const status = (DRAFT_STATUSES as readonly string[]).includes(String(sp.status)) ? (sp.status as DraftStatus) : "new";
  const topicId: number | "none" | undefined = sp.topic === "none" ? "none" : Number(sp.topic) || undefined;
  const onlyLatest = sp.found === "latest";
  const sort: "score" | "newest" = sp.sort === "newest" ? "newest" : "score";

  const [topics, settings, allInTopic, noTopic, xConnected, hasTopPosts, latest] = await Promise.all([
    getTopics(),
    getSettings(),
    listDrafts({ topicId }),
    listDrafts({ topicId: "none" }),
    xAccount().then((a) => a !== null),
    hasReferencePosts(),
    latestSearch(),
  ]);
  const isLatest = (d: { runId: number | null }) => d.runId != null && latest.runIds.has(d.runId);
  const latestCount = allInTopic.filter((d) => isLatest(d) && d.status === "new").length;
  const inTopic = onlyLatest ? allInTopic.filter(isLatest) : allInTopic;
  const langs = enabledLangs(settings);
  const drafts = inTopic
    .filter((d) => d.status === status)
    .sort((a, b) => (sort === "newest" ? b.createdAt.getTime() - a.createdAt.getTime() || b.score - a.score : 0));
  const counts = Object.fromEntries(DRAFT_STATUSES.map((s) => [s, inTopic.filter((d) => d.status === s).length]));

  // Which text the cards show: the original post, or one of the languages
  const view: LangCode | "original" = isLangCode(sp.lang) && langs.includes(sp.lang) ? sp.lang : "original";
  const hasNoTopic = noTopic.length > 0;
  const href = (
    s: DraftStatus,
    t?: number | "none",
    v: LangCode | "original" = view,
    opts: { latest?: boolean; sort?: "score" | "newest" } = {},
  ) => {
    const q = new URLSearchParams({ status: s });
    if (t) q.set("topic", String(t));
    if (v !== "original") q.set("lang", v);
    if (opts.latest ?? onlyLatest) q.set("found", "latest");
    if ((opts.sort ?? sort) === "newest") q.set("sort", "newest");
    return `/?${q}`;
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <h1 className="t-h2">Drafts</h1>
          <p className="t-body max-w-xl text-muted">
            Popular X posts, your bookmarks and fresh news, scored by AI. Pick the good ones, write them in{" "}
            {langs.length === 1 ? langInfo(langs[0]).name : `${langs.length} languages`}, then post yourself.
          </p>
        </div>
        <CollectButtons
          topics={topics.filter((t) => t.enabled).map((t) => ({ id: t.id, name: t.name }))}
          xConnected={xConnected}
          hasTopPosts={hasTopPosts}
        />
      </div>

      <div className="card space-y-4 p-4 md:p-6">
        <FilterRow label="Status">
          {DRAFT_STATUSES.map((s) => (
            <Link key={s} href={href(s, topicId)} className={`chip ${s === status ? "chip-selected" : ""}`}>
              {STATUS_LABEL[s]}
              <span className="chip-count">{counts[s]}</span>
            </Link>
          ))}
        </FilterRow>
        {topics.length > 0 && (
          <FilterRow label="Topic">
            <Link href={href(status)} className={`chip ${!topicId ? "chip-selected" : ""}`}>
              All
            </Link>
            {topics.map((t) => (
              <Link key={t.id} href={href(status, t.id)} className={`chip ${topicId === t.id ? "chip-selected" : ""}`}>
                {t.name}
              </Link>
            ))}
            {hasNoTopic && (
              <Link href={href(status, "none")} className={`chip ${topicId === "none" ? "chip-selected" : ""}`}>
                No topic
              </Link>
            )}
          </FilterRow>
        )}
        <FilterRow label="Found">
          <Link
            href={href(status, topicId, view, { latest: false })}
            className={`chip ${!onlyLatest ? "chip-selected" : ""}`}
          >
            Any time
          </Link>
          <Link
            href={href("new", topicId, view, { latest: true })}
            className={`chip ${onlyLatest ? "chip-selected" : ""}`}
            title={latest.at ? `Search started ${latest.at.toLocaleString()}` : "No search yet"}
          >
            <Sparkles size={14} aria-hidden /> Latest search
            <span className="chip-count">{latestCount}</span>
          </Link>
          <span className="mx-1 h-6 w-px bg-line" aria-hidden />
          <Link
            href={href(status, topicId, view, { sort: "score" })}
            className={`chip ${sort === "score" ? "chip-selected" : ""}`}
          >
            Best first
          </Link>
          <Link
            href={href(status, topicId, view, { sort: "newest" })}
            className={`chip ${sort === "newest" ? "chip-selected" : ""}`}
          >
            Newest first
          </Link>
        </FilterRow>
        <FilterRow label="Show in">
          <Link
            href={href(status, topicId, "original")}
            className={`chip ${view === "original" ? "chip-selected" : ""}`}
          >
            Original
          </Link>
          {langs.map((c) => (
            <Link key={c} href={href(status, topicId, c)} className={`chip ${view === c ? "chip-selected" : ""}`}>
              <span className="font-bold">{c.toUpperCase()}</span> {langInfo(c).native}
            </Link>
          ))}
        </FilterRow>
      </div>

      {topics.length === 0 ? (
        <EmptyState
          title="No topics yet"
          text="Add a topic you post about, like OpenAI or AI agents, to start collecting posts."
          action={
            <Link href="/settings" className="btn btn-primary">
              Add a topic <ArrowRight size={16} aria-hidden />
            </Link>
          }
        />
      ) : drafts.length === 0 ? (
        onlyLatest ? (
          <EmptyState
            title={`No ${STATUS_LABEL[status].toLowerCase()} drafts from your latest search`}
            text="Run a new search, or switch “Found” to “Any time” to see everything."
            action={
              <Link href={href(status, topicId, view, { latest: false })} className="btn btn-secondary">
                Show all drafts
              </Link>
            }
          />
        ) : (
          <EmptyState
            title={`No ${STATUS_LABEL[status].toLowerCase()} drafts`}
            text={
              status === "new"
                ? "Press “Find posts & news” to collect fresh posts."
                : "Drafts you move here will show up in this list."
            }
          />
        )
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {drafts.map((d) => (
            <article key={d.id} className="card flex flex-col gap-4 p-6">
              <header className="flex items-start justify-between gap-4">
                <div className="t-caption flex min-w-0 flex-wrap items-center gap-2">
                  {d.topicName && <span className="badge">{d.topicName}</span>}
                  <SourceBadge draft={d} />
                  {d.postedAt && <span className="text-muted">{timeAgo(d.postedAt)}</span>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="badge badge-inverse" title="AI importance, 1–10">
                    {d.score}/10
                  </span>
                  {isLatest(d) && (
                    <span className="badge badge-inverse" title="Found by your latest search">
                      <Sparkles size={12} aria-hidden /> Just found
                    </span>
                  )}
                  {d.matchesTop && (
                    <span className="badge badge-outline" title="Similar to your best-performing Threads posts">
                      <Star size={12} aria-hidden /> Like your top posts
                    </span>
                  )}
                </div>
              </header>

              <CardText original={d.originalText} texts={d.texts} langs={langs} view={view} />

              {(d.aiReason || d.metrics) && (
                <div className="t-small space-y-1 text-muted">
                  {d.aiReason && (
                    <p className="flex gap-2">
                      <Sparkles size={16} className="mt-0.5 shrink-0" aria-hidden />
                      <span>{d.aiReason}</span>
                    </p>
                  )}
                  {d.metrics && (
                    <p className="flex items-center gap-4">
                      <span className="inline-flex items-center gap-1">
                        <Heart size={14} aria-hidden /> {formatCount(d.metrics.likes)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Eye size={14} aria-hidden /> {formatCount(d.metrics.views)}
                      </span>
                    </p>
                  )}
                </div>
              )}

              <footer className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                <a href={d.sourceUrl} target="_blank" rel="noreferrer" className="btn btn-tertiary btn-sm">
                  Open source <ArrowUpRight size={14} aria-hidden />
                </a>
                <StatusButtons draftId={d.id} status={d.status} />
                {Object.keys(d.texts).length === 0 ? (
                  <div className="flex items-start gap-2">
                    <Link href={`/drafts/${d.id}`} className="btn btn-ghost btn-sm">
                      Open
                    </Link>
                    <WriteButton draftId={d.id} />
                  </div>
                ) : (
                  <Link href={`/drafts/${d.id}`} className="btn btn-primary btn-sm">
                    Open editor <ArrowRight size={16} aria-hidden />
                  </Link>
                )}
              </footer>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
      <span className="t-h7 w-20 shrink-0 text-muted">{label}</span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function EmptyState({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-4 px-6 py-16 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-surface">
        <Inbox size={24} aria-hidden />
      </span>
      <div className="space-y-1">
        <h2 className="t-h5">{title}</h2>
        <p className="t-body max-w-md text-muted">{text}</p>
      </div>
      {action}
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
    <div className="space-y-3">
      {view === "original" ? (
        <p className="t-body line-clamp-8 whitespace-pre-wrap">{original}</p>
      ) : (
        <>
          {texts[view] ? (
            <p className="t-body line-clamp-8 whitespace-pre-wrap" lang={view}>
              {texts[view]}
            </p>
          ) : (
            <p className="t-small text-muted italic">Not written in {langInfo(view).name} yet. Press “Write it”.</p>
          )}
          <p className="t-small line-clamp-2 text-muted">
            <span className="font-semibold">Original:</span> {original}
          </p>
        </>
      )}
      {Object.keys(texts).length === 0 ? (
        <p className="t-caption text-muted">Scored only. Press “Write it” to write it in all languages.</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {langs.map((c) => (
            <span
              key={c}
              title={texts[c] ? `${langInfo(c).name}: written` : `${langInfo(c).name}: not written yet`}
              className={`badge ${texts[c] ? "badge-outline" : "badge-missing"}`}
            >
              {c.toUpperCase()}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
