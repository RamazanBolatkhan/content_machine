"use client";

import { ArrowUpRight, CircleAlert, LoaderCircle, Plus, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import {
  addTopPostsAction,
  deleteTopPostAction,
  rebuildProfileAction,
  setTopPostTextAction,
  type TopPostsState,
} from "@/app/actions";
import type { ReferencePost } from "@/db/schema";

export function TopPostsSection({ posts, profile }: { posts: ReferencePost[]; profile: string }) {
  const [state, addAction, adding] = useActionState<TopPostsState, FormData>(addTopPostsAction, null);

  return (
    <div className="space-y-6">
      <form action={addAction} className="card space-y-4 p-6">
        <div>
          <label htmlFor="top-urls" className="field-label">
            Threads links
          </label>
          <textarea
            id="top-urls"
            name="urls"
            className="input t-small min-h-28 font-mono"
            placeholder={"https://www.threads.com/@you/post/ABC123\nhttps://www.threads.com/@you/post/DEF456"}
            disabled={adding}
            required
          />
          <p className="field-hint">
            One per line, any language. The app reads each public post and Claude explains in English why it worked.
          </p>
        </div>
        <div className="max-w-md">
          <label htmlFor="top-note" className="field-label">
            Note (optional)
          </label>
          <input
            id="top-note"
            name="note"
            className="input"
            placeholder="e.g. 120k views, best post of the month"
            disabled={adding}
          />
        </div>
        <button className="btn btn-primary" disabled={adding}>
          {adding ? <LoaderCircle size={16} className="animate-spin" aria-hidden /> : <Plus size={16} aria-hidden />}
          {adding ? "Reading and analysing…" : "Add posts"}
        </button>
        {state?.error && (
          <p className="t-small flex items-start gap-2 font-semibold" role="alert">
            <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden /> {state.error}
          </p>
        )}
        {state?.result && (
          <p className="t-small text-muted" role="status">
            Added {state.result.added}
            {state.result.needsText > 0 && ` · ${state.result.needsText} need their text pasted below`}
            {state.result.duplicates > 0 && ` · ${state.result.duplicates} already in the list`}
            {state.result.invalid.length > 0 && ` · not Threads post links: ${state.result.invalid.join(", ")}`}
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
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!hasPosts) return null;
  return (
    <div className="infobox flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="t-h7 flex items-center gap-2">
          <Sparkles size={16} aria-hidden /> What works for your audience
        </span>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await rebuildProfileAction();
              setError(res.error ?? null);
              router.refresh();
            })
          }
        >
          {pending ? (
            <LoaderCircle size={14} className="animate-spin" aria-hidden />
          ) : (
            <RefreshCw size={14} aria-hidden />
          )}
          Regenerate
        </button>
      </div>
      <p className="whitespace-pre-wrap">{profile || "Not built yet. Press Regenerate."}</p>
      <p className="t-caption text-muted">
        When scoring, Claude ranks items like these higher and marks them “Like your top posts”.
      </p>
      {error && <p className="font-semibold">{error}</p>}
    </div>
  );
}

function TopPostCard({ post }: { post: ReferencePost }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <li className="card flex flex-col gap-3 p-6">
      <div className="t-caption flex flex-wrap items-center gap-2">
        {post.lang && <span className="badge badge-outline">{post.lang.toUpperCase()}</span>}
        {post.authorHandle && <span className="font-semibold">@{post.authorHandle}</span>}
        {post.stats && <span className="text-muted">{post.stats}</span>}
        {post.note && <span className="text-muted">· {post.note}</span>}
      </div>

      {post.status === "needs_text" ? (
        <div className="space-y-2">
          <p className="t-small flex items-start gap-2 font-semibold">
            <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
            Couldn’t read this post{post.error ? ` (${post.error})` : ""}. Paste its text:
          </p>
          <textarea
            className="input t-small min-h-24"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={pending}
          />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={pending || !text.trim()}
            onClick={() =>
              start(async () => {
                const res = await setTopPostTextAction(post.id, text);
                setError(res.error ?? null);
                router.refresh();
              })
            }
          >
            {pending && <LoaderCircle size={14} className="animate-spin" aria-hidden />} Save text
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
          disabled={pending}
          onClick={() =>
            start(async () => {
              await deleteTopPostAction(post.id);
              router.refresh();
            })
          }
        >
          <Trash2 size={14} aria-hidden /> Remove
        </button>
      </div>
    </li>
  );
}
