/** Split a multi-line settings field into trimmed, non-empty entries. */
export function lines(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function formatCount(n: number | null | undefined): string {
  if (n == null) return "–";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function timeAgo(date: Date | null | undefined): string {
  if (!date) return "";
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

