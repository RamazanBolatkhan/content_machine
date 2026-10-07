import type { MediaItem, PostMetrics } from "@/db/schema";

export type XPost = {
  id: string;
  text: string;
  createdAt: Date | null;
  lang: string | null;
  authorHandle: string;
  authorName: string;
  url: string;
  metrics: PostMetrics;
  media: Omit<MediaItem, "file">[];
  isReply: boolean;
};

// Fields requested from X API v2 (same for MCP and direct mode)
export const POST_FIELDS = {
  "tweet.fields": [
    "created_at",
    "public_metrics",
    "author_id",
    "lang",
    "attachments",
    "note_tweet",
    "in_reply_to_user_id",
  ],
  expansions: ["author_id", "attachments.media_keys"],
  "media.fields": ["url", "preview_image_url", "type", "variants"],
  "user.fields": ["username", "name"],
} as const;

type V2Media = {
  media_key: string;
  type: string;
  url?: string;
  preview_image_url?: string;
  variants?: { bit_rate?: number; content_type: string; url: string }[];
};
type V2User = { id: string; username: string; name: string };
type V2Post = {
  id: string;
  text: string;
  created_at?: string;
  lang?: string;
  author_id?: string;
  in_reply_to_user_id?: string;
  note_tweet?: { text: string };
  attachments?: { media_keys?: string[] };
  public_metrics?: {
    like_count?: number;
    retweet_count?: number;
    reply_count?: number;
    quote_count?: number;
    impression_count?: number;
    bookmark_count?: number;
  };
};
export type V2Payload = {
  data?: V2Post[] | V2Post;
  includes?: { users?: V2User[]; media?: V2Media[] };
  errors?: { detail?: string; title?: string; message?: string }[];
};

/**
 * MCP tool results may wrap the X API JSON in different ways
 * (text content, nested "body"/"result" fields). Find the v2 payload.
 */
export function findV2Payload(value: unknown, depth = 0): V2Payload | null {
  if (depth > 5 || value == null) return null;
  if (typeof value === "string") {
    try {
      return findV2Payload(JSON.parse(value), depth + 1);
    } catch {
      return null;
    }
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findV2Payload(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("data" in obj && (Array.isArray(obj.data) || typeof obj.data === "object")) {
      return obj as V2Payload;
    }
    if ("meta" in obj && "result_count" in (obj.meta as object)) {
      return { data: [] };
    }
    for (const key of ["structuredContent", "content", "text", "body", "result", "response"]) {
      if (key in obj) {
        const found = findV2Payload(obj[key], depth + 1);
        if (found) return found;
      }
    }
  }
  return null;
}

/** X returns post text with &amp; &lt; &gt; escaped. */
export function decodeEntities(text: string): string {
  return text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
}

function pickMedia(m: V2Media): Omit<MediaItem, "file"> | null {
  if (m.type === "photo" && m.url) {
    return { type: "photo", remoteUrl: m.url };
  }
  if ((m.type === "video" || m.type === "animated_gif") && m.variants?.length) {
    const best = m.variants
      .filter((v) => v.content_type === "video/mp4")
      .sort((a, b) => (b.bit_rate ?? 0) - (a.bit_rate ?? 0))[0];
    if (best) {
      return { type: m.type, remoteUrl: best.url, previewUrl: m.preview_image_url };
    }
  }
  return null;
}

export function parseV2Posts(payload: V2Payload): XPost[] {
  const posts = Array.isArray(payload.data) ? payload.data : payload.data ? [payload.data] : [];
  const users = new Map((payload.includes?.users ?? []).map((u) => [u.id, u]));
  const media = new Map((payload.includes?.media ?? []).map((m) => [m.media_key, m]));

  return posts.map((p) => {
    const user = p.author_id ? users.get(p.author_id) : undefined;
    const handle = user?.username ?? "unknown";
    const pm = p.public_metrics ?? {};
    return {
      id: p.id,
      text: decodeEntities(p.note_tweet?.text ?? p.text),
      createdAt: p.created_at ? new Date(p.created_at) : null,
      lang: p.lang ?? null,
      authorHandle: handle,
      authorName: user?.name ?? handle,
      url: `https://x.com/${handle}/status/${p.id}`,
      isReply: Boolean(p.in_reply_to_user_id),
      metrics: {
        likes: pm.like_count ?? 0,
        reposts: pm.retweet_count ?? 0,
        replies: pm.reply_count ?? 0,
        quotes: pm.quote_count ?? 0,
        views: pm.impression_count ?? null,
        bookmarks: pm.bookmark_count ?? 0,
      },
      media: (p.attachments?.media_keys ?? [])
        .map((k) => media.get(k))
        .filter((m): m is V2Media => Boolean(m))
        .map(pickMedia)
        .filter((m): m is Omit<MediaItem, "file"> => Boolean(m)),
    };
  });
}
