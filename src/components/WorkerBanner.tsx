import { connection } from "next/server";
import { TriangleAlert } from "lucide-react";
import { getWorker } from "@/lib/queries";

/** Shown when the local worker (X + Claude on the owner's Mac) hasn't checked in recently. */
export async function WorkerBanner() {
  await connection();
  const worker = await getWorker().catch(() => null);
  if (!worker || worker.online) return null;
  return (
    <div className="border-b border-line bg-surface">
      <p className="t-small mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 md:px-6">
        <TriangleAlert size={16} className="shrink-0" aria-hidden />
        Your Mac worker is offline: searches, writing and AI edits will wait until you run <code>npm run dev</code> on
        your Mac.
      </p>
    </div>
  );
}
