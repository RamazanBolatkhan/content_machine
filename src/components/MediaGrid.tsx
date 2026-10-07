import { Play } from "lucide-react";
import type { MediaItem } from "@/db/schema";

/**
 * Board cards (small) only ever load images: videos show their preview picture,
 * never the video file (those can be hundreds of MB).
 */
export function MediaGrid({ media, small = false }: { media: MediaItem[]; small?: boolean }) {
  if (!media.length) return null;
  return (
    <div className={`grid gap-2 ${media.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
      {media.map((m, i) => {
        const local = m.file; // our copy on Vercel Blob
        const isVideo = m.type !== "photo";
        const cls = `w-full rounded-xl border border-line bg-surface object-cover ${small ? "h-40" : "max-h-[420px]"}`;

        if (isVideo && !small && (local || m.remoteUrl)) {
          return <video key={i} src={local ?? m.remoteUrl} poster={m.previewUrl} controls preload="none" className={cls} />;
        }
        const image = isVideo ? m.previewUrl : (local ?? m.remoteUrl);
        return (
          <div key={i} className="relative">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="" className={cls} loading="lazy" decoding="async" />
            ) : (
              <div className={`${cls} grid place-items-center`} />
            )}
            {isVideo && (
              <span className="badge badge-inverse absolute top-2 left-2">
                <Play size={12} aria-hidden /> Video
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
