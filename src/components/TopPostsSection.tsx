"use client";

import { ArrowUpRight, CircleAlert, LoaderCircle, Plus, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import type { ReferencePost } from "@/db/schema";
import type { AddResult } from "@/lib/agents/reference";
import { jobLabel, useJob } from "./useJob";

export function TopPostsSection({ posts, profile }: { posts: ReferencePost[]; profile: string }) {
  const add = useJob<AddResult>();
  const [urls, setUrls] = useState("");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const list = urls.split(/\s+/).map((u) => u.trim()).filter(Boolean);
    if (!list.length) return setFormError("Paste at least one Threads link");
    setFormError(null);
    const res = await add.run("add_top_posts", { urls: list.slice(0, 30), note: note.trim() });
    if (res.status === "done") {
      setUrls("");
      setNote("");
    }
  }

  const result = add.state.status === "done" ? add.state.result : undefined;
  const error = formError ?? (add.state.status === "error" ? add.state.error : null);

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="card space-y-4 p-6">
        <div>
          <label htmlFor="top-urls" className="field-label">
            Threads links
          </label>
          <textarea
            id="top-urls"
            className="input t-small min-h-28 font-mono"
            placeholder={"https://www.threads.com/@you/post/ABC123\nhttps://www.threads.com/t/DEF456"}
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            disabled={add.busy}
          />
          <p className="field-hint">
            One per line, any language, full or short (/t/…) links. The app reads each public post and Claude explains in
            English why it worked.
          </p>
        </div>
        <div className="max-w-md">
          <label htmlFor="top-note" className="field-label">
            Note (optional)
          </label>
          <input
            id="top-note"
            className="input"
            placeholder="e.g. 120k views, best post of the month"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={add.busy}
          />
        </div>
        <button className="btn btn-primary" disabled={add.busy}>
          {add.busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden /> : <Plus size={16} aria-hidden />}
          {add.busy ? jobLabel(add.state, "Reading and analysing…") : "Add posts"}
        </button>
        {error && (
          <p className="t-small flex items-start gap-2 font-semibold" role="alert">
            <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden /> {error}
          </p>
        )}
        {result && (
          <p className="t-small text-muted" role="status">
            Added {result.added}
            {result.needsText > 0 && ` · ${result.needsText} need their text pasted below`}
            {result.duplicates > 0 && ` · ${result.duplicates} already in the list`}
            {result.invalid.length > 0 && ` · not Threads post links: ${result.invalid.join(", ")}`}
          </p>
        )}
      </form>

      <Profile profile={profile} hasPosts={posts.some((p) => p.gistEn)} />

      {posts.length > 0 && (
        <ul className="grid gap-4 md:grid-cols-2">
          {posts.map((p) => (
            <TopPostCard key={p.id} post={p} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Profile({ profile, hasPosts }: { profile: string; hasPosts: boolean }) {
  const { state, run, busy } = useJob();
  if (!hasPosts) return null;
  return (
    <div className="infobox flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="t-h7 flex items-center gap-2">
          <Sparkles size={16} aria-hidden /> What works for your audience
        </span>
        <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => run("rebuild_profile")}>
          {busy ? <LoaderCircle size={14} className="animate-spin" aria-hidden /> : <RefreshCw size={14} aria-hidden />}
          {busy ? jobLabel(state, "Rebuilding…") : "Regenerate"}
        </button>
      </div>
      <p className="whitespace-pre-wrap">{profile || "Not built yet. Press Regenerate."}</p>
      <p className="t-caption text-muted">
        When scoring, Claude ranks items like these higher and marks them “Like your top posts”.
      </p>
      {state.status === "error" && <p className="font-semibold">{state.error}</p>}
    </div>
  );
}

function TopPostCard({ post }: { post: ReferencePost }) {
  const save = useJob();
  const remove = useJob();
  const [text, setText] = useState("");
  const busy = save.busy || remove.busy;
  const error = [save.state, remove.state].find((s) => s.status === "error")?.error;

  return (
    <li className="card flex flex-col gap-3 p-6">
      <div className="t-caption flex flex-wrap items-center gap-2">
        {post.lang && <span className="badge badge-outline">{post.lang.toUpperCase()}</span>}
        {post.authorHandle && <span className="font-semibold">@{post.authorHandle}</span>}
        {post.stats && <span className="text-muted">{post.stats}</span>}
        {post.note && <span className="text-muted">· {post.note}</span>}
        {!post.gistEn && post.status === "ok" && <span className="text-muted">· analysing…</span>}
      </div>

      {post.status === "needs_text" ? (
        <div className="space-y-2">
          <p className="t-small flex items-start gap-2 font-semibold">
            <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
            Couldn’t read this post{post.error ? ` (${post.error})` : ""}. Paste its text:
          </p>
          <textarea className="input t-small min-h-24" value={text} onChange={(e) => setText(e.target.value)} disabled={busy} />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={busy || !text.trim()}
            onClick={() => save.run("set_top_text", { id: post.id, text })}
          >
            {save.busy && <LoaderCircle size={14} className="animate-spin" aria-hidden />}
            {save.busy ? jobLabel(save.state, "Saving…") : "Save text"}
          </button>
        </div>
      ) : (
        <>
          <p className="t-small line-clamp-4 whitespace-pre-wrap" lang={post.lang || undefined}>
            {post.text}
          </p>
          {post.gistEn && (
            <div className="t-small space-y-1 border-t border-line pt-3">
              <p>
                <span className="font-semibold">In English:</span> {post.gistEn}
              </p>
              <p className="text-muted">
                <span className="font-semibold text-fg">Why it worked:</span> {post.themes}
              </p>
            </div>
          )}
        </>
      )}

      {error && <p className="t-small font-semibold">{error}</p>}

      <div className="mt-auto flex items-center justify-between gap-2 pt-2">
        <a href={post.url} target="_blank" rel="noreferrer" className="btn btn-tertiary btn-sm">
          Open <ArrowUpRight size={14} aria-hidden />
        </a>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={busy}
          onClick={() => remove.run("delete_top_post", { id: post.id })}
        >
          <Trash2 size={14} aria-hidden /> {remove.busy ? jobLabel(remove.state, "Removing…") : "Remove"}
        </button>
      </div>
    </li>
  );
}
