"use client";

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
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {xConnected ? (
          <form action={action}>
            <input type="hidden" name="kind" value="bookmarks" />
            <button className="btn" disabled={pending} title="Import posts you bookmarked on X (~$0.001 each)">
              📥 Import bookmarks
            </button>
          </form>
        ) : (
          <Link href="/settings#connections" className="btn" title="Connect your X account to import bookmarks">
            📥 Connect X for bookmarks
          </Link>
        )}
        <form action={action} className="flex items-center gap-2">
          <input type="hidden" name="kind" value="news" />
          <select name="topicId" className="input w-auto" disabled={pending}>
            <option value="">All topics</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" disabled={pending || topics.length === 0}>
            🔎 Find posts & news
          </button>
        </form>
      </div>
      {pending && <p className="text-xs text-zinc-500">Working… Claude reads, picks and writes in every language, ~1–3 min per topic.</p>}
      {state && !pending && (
        <ul className="max-w-xl text-right text-xs text-zinc-500">
          {state.results.length === 0 && <li>No enabled topics.</li>}
          {state.results.map((r) => (
            <li key={r.label} className={r.error ? "text-rose-600" : ""}>
              {r.label}: found {r.read}, checked {r.candidates}, <b>{r.saved} new drafts</b>
              {r.error && ` · ${r.error.slice(0, 200)}`}
              {r.warnings.map((w) => (
                <div key={w} className="text-amber-600">
                  ⚠ {w.slice(0, 200)}
                </div>
              ))}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
