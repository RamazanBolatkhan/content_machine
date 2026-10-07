import type { Draft } from "@/db/schema";

const LABEL: Record<Draft["source"], string> = {
  x_bookmark: "🔖 X bookmark",
  x_search: "🔎 X search",
  rss: "📰 RSS",
  web: "🌐 Web",
};

export function SourceBadge({ draft }: { draft: Pick<Draft, "source" | "sourceName" | "authorHandle" | "sourceUrl"> }) {
  const isX = draft.source === "x_bookmark" || draft.source === "x_search";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">{LABEL[draft.source]}</span>
      <a href={draft.sourceUrl} target="_blank" rel="noreferrer" className="hover:underline">
        {isX ? `@${draft.authorHandle}` : draft.sourceName || new URL(draft.sourceUrl).hostname}
      </a>
    </span>
  );
}
