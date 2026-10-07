/**
 * Reads a public Threads post through its official embed page (the widget Threads
 * provides for showing posts on other websites). No login, one request per link.
 */

export type ThreadsPost = {
  url: string;
  authorHandle: string;
  text: string;
  date: string;
  /** e.g. "12.8K likes" */
  stats: string;
};

const POST_URL = /^https?:\/\/(?:www\.)?threads\.(?:net|com)\/@([\w.]+)\/post\/([\w-]+)/i;

/** Canonical https://www.threads.com/@user/post/ID form, or null if it isn't a Threads post link. */
export function normalizeThreadsUrl(raw: string): string | null {
  const m = POST_URL.exec(raw.trim());
  return m ? `https://www.threads.com/@${m[1]}/post/${m[2]}` : null;
}

const decode = (s: string) =>
  s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#0?39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();

/** Inner HTML of the first element with this class, matching nested spans. */
function innerOf(html: string, className: string): string | null {
  const start = html.search(new RegExp(`<(\\w+)[^>]*class="[^"]*\\b${className}\\b[^"]*"[^>]*>`));
  if (start < 0) return null;
  const open = /<(\w+)[^>]*>/.exec(html.slice(start))!;
  const tag = open[1];
  let depth = 0;
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "g");
  re.lastIndex = start;
  for (let m; (m = re.exec(html));) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return html.slice(start + open[0].length, m.index);
  }
  return null;
}

export async function readThreadsPost(rawUrl: string): Promise<ThreadsPost> {
  const url = normalizeThreadsUrl(rawUrl);
  if (!url) throw new Error("Not a Threads post link (expected threads.com/@user/post/…)");
  const res = await fetch(`${url}/embed`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; ContentMachine/1.0)" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Threads returned ${res.status}`);
  const html = await res.text();

  const body = innerOf(html, "BodyTextContainer");
  const text = body ? decode(body) : "";
  if (!text) throw new Error("Couldn't read the post text (private, deleted or image-only?)");

  const likes = /class="ActionBarCount">([^<]+)</.exec(html)?.[1]?.trim();
  return {
    url,
    authorHandle: POST_URL.exec(url)![1],
    text,
    date: decode(/class="Timestamp">([^<]+)</.exec(html)?.[1] ?? ""),
    stats: likes ? `${likes} likes` : "",
  };
}
