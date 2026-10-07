"use client";

import Link from "next/link";
import { useActionState } from "react";
import { collectAction, type CollectState } from "@/app/actions";

export function CollectButtons({
  games,
  xConnected,
}: {
  games: { id: number; name: string }[];
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
          <select name="gameId" className="input w-auto" disabled={pending}>
            <option value="">All games</option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" disabled={pending || games.length === 0}>
            📰 Find news
          </button>
        </form>
      </div>
      {pending && <p className="text-xs text-zinc-500">Working… Claude reads and translates, ~1–2 min per game.</p>}
      {state && !pending && (
        <ul className="max-w-xl text-right text-xs text-zinc-500">
          {state.results.length === 0 && <li>No enabled games.</li>}
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
