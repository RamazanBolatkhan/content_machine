import { Play } from "lucide-react";
import type { MediaItem } from "@/db/schema";

export function MediaGrid({ media, small = false }: { media: MediaItem[]; small?: boolean }) {
  if (!media.length) return null;
  return (
    <div className={`grid gap-2 ${media.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
      {media.map((m, i) => {
        const src = m.file ? `/api/media/${m.file}` : m.type === "photo" ? m.remoteUrl : m.previewUrl;
        const cls = `w-full rounded-xl border border-line bg-surface object-cover ${small ? "h-40" : "max-h-[420px]"}`;
        if (m.type !== "photo" && m.file && !small) {
          return <video key={i} src={src} controls className={cls} />;
        }
        return src ? (
          <div key={i} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className={cls} loading="lazy" />
            {m.type !== "photo" && (
              <span className="badge badge-inverse absolute top-2 left-2">
                <Play size={12} aria-hidden /> Video
              </span>
            )}
          </div>
        ) : null;
      })}
    </div>
  );
}
