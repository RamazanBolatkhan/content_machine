import crypto from "node:crypto";
import { put } from "@vercel/blob";
import type { MediaItem } from "@/db/schema";

// Bigger files are not stored (the draft keeps the link to the original)
const MAX_BYTES = 150 * 1024 * 1024;

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
};

/** Copy a draft's media to Vercel Blob. Failed or too-big files keep file = null. */
export async function downloadMedia(sourceId: string, items: Omit<MediaItem, "file">[]): Promise<MediaItem[]> {
  const key = crypto.createHash("sha1").update(sourceId).digest("hex").slice(0, 12);
  return Promise.all(
    items.map(async (item, i) => {
      try {
        // Ask X for the original-size photo
        const isXPhoto = item.type === "photo" && new URL(item.remoteUrl).hostname === "pbs.twimg.com";
        const url = isXPhoto ? `${item.remoteUrl}${item.remoteUrl.includes("?") ? "&" : "?"}name=orig` : item.remoteUrl;
        const res = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; ContentMachine/1.0)" },
          signal: AbortSignal.timeout(60_000),
        });
        if (!res.ok) throw new Error(String(res.status));
        if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) {
          await res.body?.cancel();
          throw new Error("file too large");
        }
        const type = res.headers.get("content-type")?.split(";")[0] ?? "";
        // A web page instead of a file (blocked hotlink, login wall…)
        if (type.startsWith("text/")) throw new Error(`not media: ${type}`);
        const body = Buffer.from(await res.arrayBuffer());
        if (body.length > MAX_BYTES) throw new Error("file too large");
        const ext = EXT[type] ?? (item.type === "photo" ? "jpg" : "mp4");
        const blob = await put(`media/${key}_${i + 1}.${ext}`, body, {
          access: "public",
          contentType: type || undefined,
          addRandomSuffix: true,
          multipart: body.length > 20 * 1024 * 1024,
        });
        return { ...item, file: blob.url };
      } catch {
        return { ...item, file: null };
      }
    }),
  );
}
