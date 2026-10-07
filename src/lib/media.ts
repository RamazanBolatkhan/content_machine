import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { MEDIA_DIR } from "@/db";
import type { MediaItem } from "@/db/schema";

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
};

/** Download a draft's media into data/media. Failed downloads keep file = null. */
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
        const type = res.headers.get("content-type")?.split(";")[0] ?? "";
        const ext = EXT[type] ?? (item.type === "photo" ? "jpg" : "mp4");
        // A web page instead of a file (blocked hotlink, login wall…)
        if (type.startsWith("text/")) throw new Error(`not media: ${type}`);
        const file = `${key}_${i + 1}.${ext}`;
        await fs.writeFile(path.join(MEDIA_DIR, file), Buffer.from(await res.arrayBuffer()));
        return { ...item, file };
      } catch {
        return { ...item, file: null };
      }
    }),
  );
}

/** Resolve a media file name safely inside data/media. */
export function mediaPath(file: string): string | null {
  const name = path.basename(file);
  if (name !== file || name.startsWith(".")) return null;
  return path.join(MEDIA_DIR, name);
}

export function contentTypeFor(file: string): string {
  const ext = path.extname(file).slice(1).toLowerCase();
  return Object.entries(EXT).find(([, e]) => e === ext)?.[0] ?? "application/octet-stream";
}
