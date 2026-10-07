import { connection } from "next/server";
import { Check, CircleAlert, Info, Plus, Trash2 } from "lucide-react";
import { deleteTopic, disconnectXAction, saveSettings, saveTopic } from "@/app/actions";
import type { Topic } from "@/db/schema";
import { ImproveTopicButton } from "@/components/ImproveTopicButton";
import { TopPostsSection } from "@/components/TopPostsSection";
import { AI_PROVIDER, aiConfigured, aiSetupHint, DEFAULT_STYLE } from "@/lib/ai";
import { LANGUAGES } from "@/lib/languages";
import { getReferencePosts, getSettings, getTopics, recentRuns } from "@/lib/queries";
import { redirectUri, xAccount, xLoginConfigured } from "@/lib/x/auth";
import { xConfigured } from "@/lib/x/client";

// Reads the local database on every request
export const instant = false;

const FEED_EXAMPLES = [
  "https://openai.com/news/rss.xml",
  "https://www.reddit.com/r/OpenAI/top/.rss?t=day",
  "https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID",
].join("\n");

const SECTIONS = [
  { id: "connections", label: "Connections" },
  { id: "topics", label: "Topics" },
  { id: "top-posts", label: "Top Threads posts" },
  { id: "sources", label: "Sources" },
  { id: "languages", label: "Languages" },
  { id: "writing", label: "Writing & filters" },
  { id: "runs", label: "Recent runs" },
];

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  await connection();
  const sp = await searchParams;
  const topics = getTopics();
  const s = getSettings();
  const runs = recentRuns();
  const account = xAccount();

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="t-h2">Settings</h1>
        <p className="t-body text-muted">Connections, what to track, where to look and how posts are written.</p>
      </div>

      <nav aria-label="Settings sections" className="flex flex-wrap gap-2">
        {SECTIONS.map((x) => (
          <a key={x.id} href={`#${x.id}`} className="chip">
            {x.label}
          </a>
        ))}
      </nav>

      {/* ---------- Connections ---------- */}
      <Section id="connections" title="Connections">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="card space-y-3 p-6">
            <h3 className="t-h6">AI</h3>
            {aiConfigured() ? (
              <Status ok>
                {AI_PROVIDER === "claude-code"
                  ? "Claude Code on your subscription (no API cost)"
                  : "Vercel AI Gateway (paid per token)"}
              </Status>
            ) : (
              <Status>{aiSetupHint()}</Status>
            )}
          </div>

          <div className="card space-y-3 p-6">
            <h3 className="t-h6">X account (for bookmarks)</h3>
            {sp.x === "connected" && <Status ok>Connected</Status>}
            {sp.x_error && <Status>{String(sp.x_error)}</Status>}
            {account ? (
              <form action={disconnectXAction} className="flex flex-wrap items-center justify-between gap-3">
                <Status ok>
                  Connected as <span className="font-semibold">@{account.username}</span>
                </Status>
                <button className="btn btn-secondary btn-sm">Disconnect</button>
              </form>
            ) : xLoginConfigured() ? (
              <a href="/api/x/login" className="btn btn-primary">
                Connect X account
              </a>
            ) : (
              <p className="t-small text-muted">
                Set <code>X_CLIENT_ID</code> in <code>.env.local</code>, and add the callback URL{" "}
                <code>{redirectUri()}</code> in the X console.
              </p>
            )}
            <div className="divider" />
            <h3 className="t-h6">X search</h3>
            {xConfigured() ? (
              <Status ok>Bearer Token set</Status>
            ) : (
              <p className="t-small text-muted">
                Set <code>X_BEARER_TOKEN</code> in <code>.env.local</code> to search X posts.
              </p>
            )}
          </div>
        </div>
      </Section>

      {/* ---------- Topics ---------- */}
      <Section
        id="topics"
        title="Topics"
        text="A company, product or theme you post about, e.g. “OpenAI”, “Anthropic & Claude”, “Open-source models”."
      >
        <div className="space-y-6">
          {topics.map((t) => (
            <TopicForm key={t.id} topic={t} />
          ))}
          <TopicForm />
        </div>
      </Section>

      {/* ---------- Top Threads posts ---------- */}
      <Section
        id="top-posts"
        title="Top Threads posts"
        text="Links to your best-performing posts, in any language. Claude learns what works for your audience and scores similar items higher."
      >
        <TopPostsSection posts={getReferencePosts()} profile={s.referenceProfile} />
      </Section>

      <form action={saveSettings} className="space-y-8">
        {/* ---------- Sources ---------- */}
        <Section id="sources" title="Sources">
          <div className="card space-y-6 p-6">
            <div className="grid gap-6 md:grid-cols-3">
              <Toggle
                name="xSearchEnabled"
                checked={s.xSearchEnabled}
                label="X post search"
                hint={`Posts from your accounts to watch, keyword posts above min likes, and X News. About $0.005 per post read.${xConfigured() ? "" : " Needs X_BEARER_TOKEN."}`}
              />
              <Toggle
                name="rssEnabled"
                checked={s.rssEnabled}
                label="RSS feeds"
                hint="Free. Topic feeds and general news feeds below."
              />
              <Toggle
                name="webSearchEnabled"
                checked={s.webSearchEnabled}
                label="Claude web search"
                hint="Uses your Claude subscription. About 30 s per topic."
              />
            </div>
            <div className="divider" />
            <div className="grid gap-6 md:grid-cols-3">
              <Field label="Ignore news older than (hours)" name="maxAgeHours" type="number" value={s.maxAgeHours} />
              <Field
                label="Max items per topic per run"
                name="candidatesPerTopic"
                type="number"
                value={s.candidatesPerTopic}
                hint="Up to 100. The AI scores them all; you pick which to write."
              />
              <Field
                label="Bookmarks per import (max)"
                name="bookmarksPerSync"
                type="number"
                value={s.bookmarksPerSync}
                hint="About $0.001 each. Stops at the first bookmark already imported."
              />
            </div>
            <Field
              label="General AI news feeds"
              name="newsFeeds"
              textarea
              mono
              value={s.newsFeeds}
              placeholder={
                "https://techcrunch.com/category/artificial-intelligence/feed/\nhttps://www.theverge.com/rss/ai-artificial-intelligence/index.xml\nhttps://hnrss.org/newest?q=AI+OR+LLM&points=100"
              }
              hint="One per line. Articles are matched to your topics by keyword."
            />
            <details className="group">
              <summary className="t-h7 cursor-pointer list-none text-muted hover:text-fg">
                <span className="underline underline-offset-4">X search settings</span>
              </summary>
              <div className="mt-4 grid gap-6 md:grid-cols-4">
                <Field label="Min likes" name="minLikes" type="number" value={s.minLikes} />
                <Field label="Min views (0 = off)" name="minViews" type="number" value={s.minViews} />
                <Field
                  label="Posts read per query (10–100)"
                  name="fetchPerTopic"
                  type="number"
                  value={s.fetchPerTopic}
                />
                <Field label="Post language" name="searchLang" value={s.searchLang} hint="en, ja… Empty = any" />
              </div>
            </details>
          </div>
        </Section>

        {/* ---------- Languages ---------- */}
        <Section
          id="languages"
          title="Languages"
          text="Every post is written in each checked language. Unchecking all means all."
        >
          <div className="card space-y-6 p-6">
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {LANGUAGES.map((l) => (
                <label
                  key={l.code}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-line p-4 transition-colors hover:border-fg has-[:checked]:border-fg"
                >
                  <input type="checkbox" name={`lang_${l.code}`} defaultChecked={s.languages.includes(l.code)} />
                  <span className="badge badge-outline">{l.code.toUpperCase()}</span>
                  <span className="t-small">
                    <span className="font-semibold">{l.name}</span> <span className="text-muted">{l.native}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="max-w-xs">
              <Field
                label="Max characters per post"
                name="charLimit"
                type="number"
                value={s.charLimit}
                hint="500 for Threads. 280 for X without Premium."
              />
            </div>
          </div>
        </Section>

        {/* ---------- Writing ---------- */}
        <Section id="writing" title="Writing & filters">
          <div className="card grid gap-6 p-6 md:grid-cols-3">
            <Field
              label="Style"
              name="stylePrompt"
              textarea
              value={s.stylePrompt}
              placeholder={DEFAULT_STYLE}
              hint="In any language. Applies to all languages."
            />
            <Field
              label="Glossary"
              name="glossary"
              textarea
              mono
              value={s.glossary}
              placeholder={"open-source\nfine-tuning\nAGI"}
              hint="Terms never translated. One per line."
            />
            <Field
              label="Blocklist"
              name="blocklist"
              textarea
              mono
              value={s.blocklist}
              placeholder={"crypto\ngiveaway\n@spamaccount"}
              hint="Words or @handles to always skip."
            />
          </div>
        </Section>

        <div className="sticky bottom-0 -mx-4 border-t border-line bg-bg px-4 py-4 md:-mx-6 md:px-6">
          <button className="btn btn-primary btn-lg">
            <Check size={18} aria-hidden /> Save settings
          </button>
        </div>
      </form>

      {/* ---------- Runs ---------- */}
      <Section id="runs" title="Recent runs">
        <div className="card overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th>When</th>
                <th>What</th>
                <th>Found</th>
                <th>To AI</th>
                <th>New drafts</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 && (
                <tr>
                  <td className="text-muted" colSpan={6}>
                    No runs yet.
                  </td>
                </tr>
              )}
              {runs.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap text-muted">{r.startedAt.toLocaleString()}</td>
                  <td className="font-semibold whitespace-nowrap">
                    {r.kind === "bookmarks" ? "Bookmarks" : r.topicName}
                  </td>
                  <td>{r.itemsRead}</td>
                  <td>{r.candidates}</td>
                  <td className="font-semibold">{r.saved}</td>
                  <td className="max-w-md space-y-1">
                    {r.error && (
                      <p className="flex items-start gap-1.5 font-semibold">
                        <CircleAlert size={14} className="mt-0.5 shrink-0" aria-hidden /> {r.error}
                      </p>
                    )}
                    {r.warnings && (
                      <p className="t-caption flex items-start gap-1.5 whitespace-pre-wrap text-muted">
                        <Info size={14} className="mt-0.5 shrink-0" aria-hidden /> {r.warnings}
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

function Section({
  id,
  title,
  text,
  children,
}: {
  id: string;
  title: string;
  text?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4">
      <div className="space-y-1">
        <h2 className="t-h3">{title}</h2>
        {text && <p className="t-small text-muted">{text}</p>}
      </div>
      {children}
    </section>
  );
}

function Status({ ok = false, children }: { ok?: boolean; children: React.ReactNode }) {
  const Icon = ok ? Check : CircleAlert;
  return (
    <p className={`t-small flex items-start gap-2 ${ok ? "" : "font-semibold"}`}>
      <span
        className={`grid size-5 shrink-0 place-items-center rounded-full ${ok ? "bg-inverse text-on-inverse" : "border border-fg"}`}
      >
        <Icon size={12} aria-hidden />
      </span>
      <span>{children}</span>
    </p>
  );
}

function Toggle({ name, label, hint, checked }: { name: string; label: string; hint: string; checked: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-4 transition-colors hover:border-fg has-[:checked]:border-fg">
      <input type="checkbox" name={name} defaultChecked={checked} className="mt-0.5" />
      <span className="space-y-1">
        <span className="t-h7 block">{label}</span>
        <span className="t-caption block text-muted">{hint}</span>
      </span>
    </label>
  );
}

function Field({
  label,
  name,
  value,
  type = "text",
  textarea = false,
  mono = false,
  placeholder,
  hint,
  required = false,
}: {
  label: string;
  name: string;
  value?: string | number | null;
  type?: string;
  textarea?: boolean;
  mono?: boolean;
  placeholder?: string;
  hint?: string;
  required?: boolean;
}) {
  const id = `field-${name}`;
  const cls = `input ${mono ? "font-mono t-small" : ""}`;
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      {textarea ? (
        <textarea
          id={id}
          name={name}
          className={`${cls} min-h-36`}
          defaultValue={value ?? ""}
          placeholder={placeholder}
          required={required}
        />
      ) : (
        <input
          id={id}
          name={name}
          type={type}
          className={cls}
          defaultValue={value ?? ""}
          placeholder={placeholder}
          required={required}
        />
      )}
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

function TopicForm({ topic }: { topic?: Topic }) {
  const suffix = topic ? `-${topic.id}` : "-new";
  return (
    <form action={saveTopic} className={`card space-y-6 p-6 ${topic ? "" : "border-dashed shadow-none"}`}>
      {topic && <input type="hidden" name="id" value={topic.id} />}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h3 className="t-h5">{topic ? topic.name : "New topic"}</h3>
        <label className="t-small flex cursor-pointer items-center gap-2">
          <input type="checkbox" name="enabled" defaultChecked={topic?.enabled ?? true} /> Enabled
        </label>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <TopicField id={`name${suffix}`} label="Name">
          <input
            key={topic?.name}
            id={`name${suffix}`}
            name="name"
            className="input"
            defaultValue={topic?.name}
            placeholder="OpenAI"
            required
          />
        </TopicField>
        <TopicField
          id={`description${suffix}`}
          label="What you want to post about"
          hint="Helps the AI judge items and find sources, e.g. “evidence-based psychology and mental health research, practical tips from experts”."
        >
          <textarea
            key={topic?.description}
            id={`description${suffix}`}
            name="description"
            className="input t-small min-h-28"
            defaultValue={topic?.description}
            placeholder="e.g. new research, product launches and expert takes; no memes or drama"
          />
        </TopicField>
        <TopicField
          id={`keywords${suffix}`}
          label="Keywords"
          hint="One per line, most important first. Used for search and to match news."
        >
          <textarea
            key={topic?.keywords}
            id={`keywords${suffix}`}
            name="keywords"
            className="input t-small min-h-28 font-mono"
            defaultValue={topic?.keywords}
            placeholder={"OpenAI\nChatGPT\nSam Altman"}
            required
          />
        </TopicField>
        <TopicField
          id={`accounts${suffix}`}
          label="X accounts to watch"
          hint="One handle per line. Their posts are almost always popular; keyword search alone mostly finds posts with few likes."
        >
          <textarea
            key={topic?.trustedAccounts}
            id={`accounts${suffix}`}
            name="trustedAccounts"
            className="input t-small min-h-28 font-mono"
            defaultValue={topic?.trustedAccounts}
            placeholder={"OpenAI\nsama\nOpenAIDevs"}
          />
        </TopicField>
        <TopicField id={`feeds${suffix}`} label="Feeds only about this topic" hint="RSS or Atom URLs, one per line.">
          <textarea
            key={topic?.feeds}
            id={`feeds${suffix}`}
            name="feeds"
            className="input t-small min-h-28 font-mono"
            defaultValue={topic?.feeds}
            placeholder={FEED_EXAMPLES}
          />
        </TopicField>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary">
          {topic ? <Check size={16} aria-hidden /> : <Plus size={16} aria-hidden />}
          {topic ? "Save topic" : "Add topic"}
        </button>
        {topic && (
          <button formAction={deleteTopic} className="btn btn-ghost">
            <Trash2 size={16} aria-hidden /> Delete
          </button>
        )}
      </div>
      {topic ? (
        <div className="divider pt-6">
          <ImproveTopicButton topicId={topic.id} />
          <p className="field-hint">
            Claude searches the web for keywords, popular X accounts and RSS feeds. The app checks every feed works and
            every account exists (about $0.01 per account), then adds the good ones. Save your own edits first.
          </p>
        </div>
      ) : (
        <p className="field-hint">
          Add the topic, then press “Improve with AI” to fill in keywords, accounts and feeds.
        </p>
      )}
    </form>
  );
}

function TopicField({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      {children}
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}
