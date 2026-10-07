"use client";

import { Bookmark, CircleAlert, Info, LoaderCircle, Search } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { collectAction, type CollectState } from "@/app/actions";

export function CollectButtons({
  topics,
  xConnected,
}: {
  topics: { id: number; name: string }[];
  xConnected: boolean;
}) {
  const [state, action, pending] = useActionState<CollectState, FormData>(collectAction, null);

  return (
    <div className="flex w-full flex-col gap-4 md:w-auto md:items-end">
      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        {xConnected ? (
          <form action={action}>
            <input type="hidden" name="kind" value="bookmarks" />
            <button className="btn btn-secondary" disabled={pending} title="Import posts you bookmarked on X">
              <Bookmark size={16} aria-hidden /> Import bookmarks
            </button>
          </form>
        ) : (
          <Link href="/settings#connections" className="btn btn-secondary" title="Connect your X account to import bookmarks">
            <Bookmark size={16} aria-hidden /> Connect X
          </Link>
        )}
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="kind" value="news" />
          <label className="sr-only" htmlFor="collect-topic">
            Topic
          </label>
          <select id="collect-topic" name="topicId" className="input w-auto rounded-full" style={{ minHeight: 40 }} disabled={pending}>
            <option value="">All topics</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" disabled={pending || topics.length === 0}>
            {pending ? <LoaderCircle size={16} className="animate-spin" aria-hidden /> : <Search size={16} aria-hidden />}
            Find posts &amp; news
          </button>
        </form>
      </div>

      {pending && (
        <p className="t-small flex items-center gap-2 text-muted" role="status">
          <LoaderCircle size={16} className="animate-spin" aria-hidden />
          Searching, picking and writing in every language. About 1–3 min per topic.
        </p>
      )}

      {state && !pending && (
        <ul className="t-small w-full max-w-xl space-y-2 md:text-right" role="status">
          {state.results.length === 0 && <li className="text-muted">No enabled topics.</li>}
          {state.results.map((r) => (
            <li key={r.label} className="space-y-1">
              <div>
                <span className="font-semibold">{r.label}</span>
                <span className="text-muted">
                  {" "}
                  · found {r.read} · checked {r.candidates} ·{" "}
                </span>
                <span className="font-semibold">{r.saved} new drafts</span>
              </div>
              {r.error && (
                <div className="flex items-start gap-1.5 font-semibold md:justify-end">
                  <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden /> {r.error.slice(0, 200)}
                </div>
              )}
              {r.warnings.map((w) => (
                <div key={w} className="t-caption flex items-start gap-1.5 text-muted md:justify-end">
                  <Info size={14} className="mt-0.5 shrink-0" aria-hidden /> {w.slice(0, 200)}
                </div>
              ))}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
