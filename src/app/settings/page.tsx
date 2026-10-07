import { connection } from "next/server";
import { deleteGame, disconnectXAction, saveGame, saveSettings } from "@/app/actions";
import type { Game } from "@/db/schema";
import { AI_PROVIDER, aiConfigured, aiSetupHint, DEFAULT_STYLE } from "@/lib/ai";
import { getGames, getSettings, recentRuns } from "@/lib/queries";
import { redirectUri, xAccount, xLoginConfigured } from "@/lib/x/auth";
import { xConfigured } from "@/lib/x/client";

// Reads the local database on every request
export const instant = false;

const FEED_EXAMPLES = [
  "https://www.reddit.com/r/GTA6/top/.rss?t=day",
  "https://store.steampowered.com/feeds/news/app/APP_ID",
  "https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID",
].join("\n");

function GameForm({ game }: { game?: Game }) {
  return (
    <form action={saveGame} className="card grid gap-3 p-4 md:grid-cols-[1fr_1.2fr_1.6fr_auto]">
      {game && <input type="hidden" name="id" value={game.id} />}
      <div>
        <label className="label">Game</label>
        <input name="name" className="input" defaultValue={game?.name} placeholder="GTA 6" required />
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input type="checkbox" name="enabled" defaultChecked={game?.enabled ?? true} /> Enabled
        </label>
      </div>
      <div>
        <label className="label">Keywords (one per line)</label>
        <textarea
          name="keywords"
          className="input min-h-28 font-mono text-xs"
          defaultValue={game?.keywords}
          placeholder={"GTA 6\nGTA VI\nGrand Theft Auto VI"}
          required
        />
      </div>
      <div>
        <label className="label">Feeds only about this game (RSS / Atom)</label>
        <textarea name="feeds" className="input min-h-28 font-mono text-xs" defaultValue={game?.feeds} placeholder={FEED_EXAMPLES} />
        <input type="hidden" name="trustedAccounts" value={game?.trustedAccounts ?? ""} />
      </div>
      <div className="flex flex-col justify-end gap-2">
        <button className="btn btn-primary">{game ? "Save" : "Add game"}</button>
        {game && (
          <button formAction={deleteGame} className="btn btn-bad">
            Delete
          </button>
        )}
      </div>
    </form>
  );
}

function Check({ name, label, hint, checked }: { name: string; label: string; hint: string; checked: boolean }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={checked} className="mt-1" />
      <span>
        {label}
        <span className="block text-xs text-zinc-500">{hint}</span>
      </span>
    </label>
  );
}

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  await connection();
  const sp = await searchParams;
  const games = getGames();
  const s = getSettings();
  const runs = recentRuns();
  const account = xAccount();

  return (
    <div className="space-y-10">
      <section id="connections" className="space-y-3">
        <h2 className="text-xl font-semibold">Connections</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card space-y-2 p-4">
            <span className="label">AI</span>
            {aiConfigured() ? (
              <p className="text-sm">
                ✅ {AI_PROVIDER === "claude-code" ? "Claude Code on your subscription (no API cost)" : "Vercel AI Gateway (paid per token)"}
              </p>
            ) : (
              <p className="text-sm text-rose-600">⚠ {aiSetupHint()}</p>
            )}
          </div>
          <div className="card space-y-2 p-4">
            <span className="label">X account (for bookmarks)</span>
            {sp.x === "connected" && <p className="text-sm text-emerald-600">Connected!</p>}
            {sp.x_error && <p className="text-sm text-rose-600">⚠ {String(sp.x_error)}</p>}
            {account ? (
              <form action={disconnectXAction} className="flex items-center justify-between gap-2">
                <p className="text-sm">✅ Connected as <b>@{account.username}</b></p>
                <button className="btn btn-bad text-xs">Disconnect</button>
              </form>
            ) : xLoginConfigured() ? (
              <a href="/api/x/login" className="btn btn-primary">
                Connect X account
              </a>
            ) : (
              <p className="text-sm text-zinc-500">
                Set <code>X_CLIENT_ID</code> (and <code>X_CLIENT_SECRET</code> for a “Web App”) in <code>.env.local</code>. In the X
                console, add the callback URL <code>{redirectUri()}</code>.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Games to track</h2>
        {games.map((g) => (
          <GameForm key={g.id} game={g} />
        ))}
        <GameForm />
      </section>

      <form action={saveSettings} className="space-y-10">
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Sources</h2>
          <div className="card grid gap-4 p-4 md:grid-cols-3">
            <div className="space-y-3">
              <Check name="rssEnabled" checked={s.rssEnabled} label="📰 RSS feeds" hint="Free. Game feeds + general news feeds below." />
              <Check
                name="webSearchEnabled"
                checked={s.webSearchEnabled}
                label="🌐 Claude web search"
                hint="Uses your Claude subscription. ~30 s per game."
              />
              <Check
                name="xSearchEnabled"
                checked={s.xSearchEnabled}
                label="🔎 Paid X search"
                hint={`~$0.005 per post read. Needs X_BEARER_TOKEN${xConfigured() ? "" : " (not set)"}.`}
              />
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Bookmarks per import (max)</label>
                <input name="bookmarksPerSync" type="number" className="input" defaultValue={s.bookmarksPerSync} />
                <p className="mt-1 text-xs text-zinc-500">~$0.001 each. Stops at the first bookmark already imported.</p>
              </div>
              <div>
                <label className="label">Ignore news older than (hours)</label>
                <input name="maxAgeHours" type="number" className="input" defaultValue={s.maxAgeHours} />
              </div>
              <div>
                <label className="label">Max news items per game sent to AI</label>
                <input name="candidatesPerGame" type="number" className="input" defaultValue={s.candidatesPerGame} />
              </div>
            </div>
            <div>
              <label className="label">General news feeds (matched to games by keywords)</label>
              <textarea
                name="newsFeeds"
                className="input min-h-40 font-mono text-xs"
                defaultValue={s.newsFeeds}
                placeholder={"https://www.gematsu.com/feed\nhttps://www.eurogamer.net/feed\nhttps://www.pcgamer.com/rss/"}
              />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Writing & filters</h2>
          <div className="card grid gap-4 p-4 md:grid-cols-3">
            <div>
              <label className="label">Style for Russian posts</label>
              <textarea name="stylePrompt" className="input min-h-36 text-xs" defaultValue={s.stylePrompt} placeholder={DEFAULT_STYLE} />
            </div>
            <div>
              <label className="label">Glossary (never translate)</label>
              <textarea name="glossary" className="input min-h-36 font-mono text-xs" defaultValue={s.glossary} placeholder={"Rockstar Games\nPS5\nearly access"} />
            </div>
            <div>
              <label className="label">Blocklist (words or @handles)</label>
              <textarea name="blocklist" className="input min-h-36 font-mono text-xs" defaultValue={s.blocklist} placeholder={"giveaway\n@spamaccount"} />
            </div>
          </div>
        </section>

        <details className="space-y-3">
          <summary className="cursor-pointer text-sm text-zinc-500">Paid X search settings</summary>
          <div className="card mt-3 grid gap-4 p-4 md:grid-cols-4">
            <div>
              <label className="label">Min likes</label>
              <input name="minLikes" type="number" className="input" defaultValue={s.minLikes} />
            </div>
            <div>
              <label className="label">Min views (0 = off)</label>
              <input name="minViews" type="number" className="input" defaultValue={s.minViews} />
            </div>
            <div>
              <label className="label">Posts read per game (10–100)</label>
              <input name="fetchPerGame" type="number" className="input" defaultValue={s.fetchPerGame} />
            </div>
            <div>
              <label className="label">Post language (en, ja… empty = any)</label>
              <input name="searchLang" className="input" defaultValue={s.searchLang} />
            </div>
          </div>
        </details>

        <button className="btn btn-primary">Save settings</button>
      </form>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Recent runs</h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-zinc-500 uppercase">
              <tr>
                <th className="p-3">When</th>
                <th className="p-3">What</th>
                <th className="p-3">Found</th>
                <th className="p-3">To AI</th>
                <th className="p-3">New drafts</th>
                <th className="p-3">Problems</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {runs.length === 0 && (
                <tr>
                  <td className="p-3 text-zinc-500" colSpan={6}>
                    No runs yet.
                  </td>
                </tr>
              )}
              {runs.map((r) => (
                <tr key={r.id}>
                  <td className="p-3 whitespace-nowrap">{r.startedAt.toLocaleString()}</td>
                  <td className="p-3">{r.kind === "bookmarks" ? "🔖 Bookmarks" : `📰 ${r.gameName}`}</td>
                  <td className="p-3">{r.itemsRead}</td>
                  <td className="p-3">{r.candidates}</td>
                  <td className="p-3">{r.saved}</td>
                  <td className="max-w-md p-3 text-xs">
                    {r.error && <div className="text-rose-600">{r.error}</div>}
                    {r.warnings && <div className="whitespace-pre-wrap text-amber-600">{r.warnings}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
