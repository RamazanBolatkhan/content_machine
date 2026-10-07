import type { MediaItem } from "@/db/schema";

export function MediaGrid({ media, small = false }: { media: MediaItem[]; small?: boolean }) {
  if (!media.length) return null;
  return (
    <div className={`grid gap-2 ${media.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
      {media.map((m, i) => {
        const src = m.file ? `/api/media/${m.file}` : m.type === "photo" ? m.remoteUrl : m.previewUrl;
        const cls = `w-full rounded-lg border border-zinc-200 object-cover dark:border-zinc-800 ${small ? "h-32" : "max-h-96"}`;
        if (m.type !== "photo" && m.file && !small) {
          return <video key={i} src={src} controls className={cls} />;
        }
        return src ? (
          <div key={i} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className={cls} />
            {m.type !== "photo" && (
              <span className="absolute top-1 left-1 rounded bg-black/70 px-1.5 text-xs text-white">▶ video</span>
            )}
          </div>
        ) : null;
      })}
    </div>
  );
}
