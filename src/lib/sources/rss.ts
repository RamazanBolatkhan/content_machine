import { XMLParser } from "fast-xml-parser";
import type { NewsItem } from "./types";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@", textNodeName: "#text" });

const asArray = <T>(v: T | T[] | undefined): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);

/** Text of a node that may be a string, a number or {"#text": ...}. */
function str(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "object" && "#text" in (v as object)) return String((v as { "#text": unknown })["#text"]);
  return "";
}

function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

function firstImage(html: string): string | undefined {
  return html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
}

type Node = Record<string, unknown>;

function rssImage(item: Node): string | undefined {
  for (const key of ["media:content", "media:thumbnail", "enclosure"]) {
    for (const m of asArray(item[key] as Node | Node[])) {
      const url = m?.["@url"] as string | undefined;
      const type = (m?.["@type"] as string | undefined) ?? "";
      if (url && (!type || type.startsWith("image"))) return url;
    }
  }
  const group = item["media:group"] as Node | undefined;
  const thumb = asArray(group?.["media:thumbnail"] as Node | Node[])[0];
  return (thumb?.["@url"] as string | undefined) ?? undefined;
}

function parseDate(v: unknown): Date | null {
  const d = new Date(str(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Fetch an RSS 2.0 or Atom feed (news sites, subreddit .rss, Steam, YouTube…). */
export async function fetchFeed(feedUrl: string): Promise<NewsItem[]> {
  const res = await fetch(feedUrl, {
    headers: { "User-Agent": "ContentMachine/1.0 (personal RSS reader)", Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const xml = parser.parse(await res.text()) as Node;

  // RSS 2.0
  const channel = (xml.rss as Node | undefined)?.channel as Node | undefined;
  if (channel) {
    const feedName = str(channel.title) || new URL(feedUrl).hostname;
    return asArray(channel.item as Node | Node[]).map((item) => {
      const html = str(item["content:encoded"]) || str(item.description);
      const link = str(item.link) || str(item.guid);
      return {
        url: link,
        title: stripHtml(str(item.title)),
        summary: stripHtml(html).slice(0, 1200),
        sourceName: feedName,
        publishedAt: parseDate(item.pubDate ?? item["dc:date"]),
        imageUrl: rssImage(item) ?? firstImage(html),
      };
    });
  }

  // Atom (YouTube, Reddit, many blogs)
  const feed = xml.feed as Node | undefined;
  if (feed) {
    const feedName = str(feed.title) || new URL(feedUrl).hostname;
    return asArray(feed.entry as Node | Node[]).map((entry) => {
      const links = asArray(entry.link as Node | Node[]);
      const link = (links.find((l) => !l["@rel"] || l["@rel"] === "alternate") ?? links[0])?.["@href"] as string;
      const group = entry["media:group"] as Node | undefined;
      const html = str(entry.content) || str(entry.summary) || str(group?.["media:description"]);
      return {
        url: link ?? "",
        title: stripHtml(str(entry.title)),
        summary: stripHtml(html).slice(0, 1200),
        sourceName: feedName,
        publishedAt: parseDate(entry.published ?? entry.updated),
        imageUrl: rssImage(entry) ?? firstImage(html),
      };
    });
  }

  throw new Error("Not an RSS or Atom feed");
}

/** og:image of an article, for news found without a picture. */
export async function fetchOgImage(pageUrl: string): Promise<string | undefined> {
  try {
    const res = await fetch(pageUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ContentMachine/1.0)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return undefined;
    const html = (await res.text()).slice(0, 300_000);
    const match =
      html.match(/<meta[^>]+property=["']og:image(?::url)?["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::url)?["']/i);
    return match ? new URL(match[1].replace(/&amp;/g, "&"), pageUrl).toString() : undefined;
  } catch {
    return undefined;
  }
}
