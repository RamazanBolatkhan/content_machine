import { getXSession } from "./auth";
import { parseV2Posts, POST_FIELDS, type V2Payload, type XPost } from "./parse";

/**
 * Newest bookmarks first, stopping at the first one we already know.
 * Billed as "owned reads" (~$0.001 per post), so `limit` caps the cost per sync.
 */
export async function fetchNewBookmarks(limit: number, isKnown: (postId: string) => boolean): Promise<XPost[]> {
  const { accessToken, userId } = await getXSession();
  const found: XPost[] = [];
  let paginationToken: string | undefined;

  while (found.length < limit) {
    const url = new URL(`https://api.x.com/2/users/${userId}/bookmarks`);
    url.searchParams.set("max_results", String(Math.min(100, Math.max(1, limit - found.length))));
    for (const [key, value] of Object.entries(POST_FIELDS)) url.searchParams.set(key, value.join(","));
    if (paginationToken) url.searchParams.set("pagination_token", paginationToken);

    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const body = (await res.json().catch(() => ({}))) as V2Payload & { meta?: { next_token?: string } };
    if (!res.ok) throw new Error(`X bookmarks ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);

    for (const post of parseV2Posts(body)) {
      if (isKnown(post.id)) return found; // everything older was imported before
      found.push(post);
    }
    paginationToken = body.meta?.next_token;
    if (!paginationToken) break;
  }
  return found;
}
