import { AtSign, Bookmark, Globe, Newspaper, Rss, Search, type LucideIcon } from "lucide-react";
import type { Draft } from "@/db/schema";

const SOURCES: Record<Draft["source"], { label: string; icon: LucideIcon }> = {
  x_bookmark: { label: "Bookmark", icon: Bookmark },
  x_search: { label: "X search", icon: Search },
  x_news: { label: "X News", icon: Newspaper },
  rss: { label: "RSS", icon: Rss },
  web: { label: "Web", icon: Globe },
};

export function sourceLabel(source: Draft["source"]) {
  return SOURCES[source].label;
}

export function SourceBadge({ draft }: { draft: Pick<Draft, "source" | "sourceName" | "authorHandle" | "sourceUrl"> }) {
  const { label, icon: Icon } = SOURCES[draft.source];
  const isX = draft.source === "x_bookmark" || draft.source === "x_search";
  let name = draft.sourceName;
  if (isX) name = draft.authorHandle;
  else if (!name) {
    try {
      name = new URL(draft.sourceUrl).hostname;
    } catch {
      name = draft.sourceUrl;
    }
  }
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span className="badge badge-outline" title={label}>
        <Icon size={12} aria-hidden />
        {label}
      </span>
      <a
        href={draft.sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-w-0 items-center gap-0.5 truncate font-semibold text-fg hover:underline"
      >
        {isX && <AtSign size={12} aria-hidden className="shrink-0" />}
        <span className="truncate">{name}</span>
      </a>
    </span>
  );
}
