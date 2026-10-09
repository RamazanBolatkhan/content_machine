"use client";

import { ArrowRight, Bookmark, CircleAlert, Info, LoaderCircle, Search, Star } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { RunResult } from "@/lib/agents/scout";
import { jobLabel, useJob } from "./useJob";

export function CollectButtons({
  topics,
  xConnected,
  hasTopPosts,
}: {
  topics: { id: number; name: string }[];
  xConnected: boolean;
  hasTopPosts: boolean;
}) {
  const { state, run, busy } = useJob<RunResult[]>();
  const [topicId, setTopicId] = useState("");

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {xConnected ? (
          <button
            className="btn btn-ghost"
            disabled={busy}
            onClick={() => run("bookmarks")}
            title="Import posts you bookmarked on X"
          >
            <Bookmark size={16} aria-hidden /> Import bookmarks
          </button>
        ) : (
          <Link
            href="/settings#connections"
            className="btn btn-ghost"
            title="Connect your X account to import bookmarks"
          >
            <Bookmark size={16} aria-hidden /> Connect X
          </Link>
        )}
        {hasTopPosts ? (
          <button
            className="btn btn-ghost"
            disabled={busy}
            onClick={() => run("similar")}
            title="Search only for items like your top Threads posts"
          >
            <Star size={16} aria-hidden /> Find like my top posts
          </button>
        ) : (
          <Link
            href="/settings#top-posts"
            className="btn btn-secondary flex-col !gap-0 leading-tight"
            style={{ height: "auto", minHeight: 40, paddingBlock: 6 }}
            title="Add your best Threads posts first"
          >
            <span className="flex items-center gap-2">
              <Star size={16} aria-hidden /> Find like my top posts
            </span>
            <span className="t-caption font-normal text-muted">Add your top Threads posts first →</span>
          </Link>
        )}
        <div className="flex w-full flex-wrap items-center gap-2 border-t border-line pt-3 lg:ml-auto lg:w-auto lg:border-0 lg:pt-0">
          <label className="sr-only" htmlFor="collect-topic">
            Topic to search
          </label>
          <select
            id="collect-topic"
            className="input !w-auto max-w-full !rounded-xl !text-sm"
            style={{ minHeight: 40 }}
            value={topicId}
            onChange={(e) => setTopicId(e.target.value)}
            disabled={busy}
          >
            <option value="">Search all topics</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                Search: {t.name}
              </option>
            ))}
          </select>
          <button
            className="btn btn-primary"
            disabled={busy || topics.length === 0}
            onClick={() => run("find_news", topicId ? { topicId: Number(topicId) } : {})}
          >
            {busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden /> : <Search size={16} aria-hidden />}
            Find posts &amp; news
          </button>
        </div>
      </div>

      {busy && (
        <p className="feedback t-small flex flex-wrap items-center gap-2 rounded-xl bg-surface px-4 py-3 text-muted" role="status">
          <LoaderCircle size={16} className="animate-spin" aria-hidden />
          {jobLabel(state, "Searching and scoring…")}
          {state.workerOnline && " (usually 1–3 min per topic)"}
        </p>
      )}

      {state.status === "error" && (
        <p className="t-small flex items-start gap-1.5 font-semibold" role="alert">
          <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden /> {state.error}
        </p>
      )}

      {state.status === "done" && state.result && state.result.some((r) => r.saved > 0) && (
        <Link href="/?status=new&found=latest&sort=newest" className="btn btn-primary btn-sm">
          Show the {state.result.reduce((n, r) => n + r.saved, 0)} new drafts <ArrowRight size={14} aria-hidden />
        </Link>
      )}

      {state.status === "done" && state.result && (
        <ul className="t-small w-full max-w-xl space-y-2 md:text-right" role="status">
          {state.result.length === 0 && <li className="text-muted">No enabled topics.</li>}
          {state.result.map((r) => (
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
