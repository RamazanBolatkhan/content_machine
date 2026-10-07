"use client";

import { Bookmark, CircleAlert, Info, LoaderCircle, Search, Star } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { collectAction, type CollectState } from "@/app/actions";

export function CollectButtons({
  topics,
  xConnected,
  hasTopPosts,
}: {
  topics: { id: number; name: string }[];
  xConnected: boolean;
  hasTopPosts: boolean;
}) {
  const [state, action, pending] = useActionState<CollectState, FormData>(collectAction, null);
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!pending) return;
    const started = Date.now();
    const timer = setInterval(() => setSeconds(Math.round((Date.now() - started) / 1000)), 1000);
    return () => {
      clearInterval(timer);
      setSeconds(0);
    };
  }, [pending]);

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
          <Link
            href="/settings#connections"
            className="btn btn-secondary"
            title="Connect your X account to import bookmarks"
          >
            <Bookmark size={16} aria-hidden /> Connect X
          </Link>
        )}
        {hasTopPosts ? (
          <form action={action}>
            <input type="hidden" name="kind" value="similar" />
            <button
              className="btn btn-secondary"
              disabled={pending}
              title="Search only for items like your top Threads posts"
            >
              <Star size={16} aria-hidden /> Find like my top posts
            </button>
          </form>
        ) : (
          <Link href="/settings#top-posts" className="btn btn-secondary" title="Add your best Threads posts first">
            <Star size={16} aria-hidden /> Add top posts
          </Link>
        )}
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="kind" value="news" />
          <label className="sr-only" htmlFor="collect-topic">
            Topic to search
          </label>
          <select
            id="collect-topic"
            name="topicId"
            className="input w-auto rounded-full"
            style={{ minHeight: 40 }}
            disabled={pending}
          >
            <option value="">Search all topics</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                Search: {t.name}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" disabled={pending || topics.length === 0}>
            {pending ? (
              <LoaderCircle size={16} className="animate-spin" aria-hidden />
            ) : (
              <Search size={16} aria-hidden />
            )}
            Find posts &amp; news
          </button>
        </form>
      </div>

      {pending && (
        <p className="t-small flex items-center gap-2 text-muted" role="status">
          <LoaderCircle size={16} className="animate-spin" aria-hidden />
          Searching and scoring… {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")} (usually 1–3 min per
          topic). Keep this tab open.
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
