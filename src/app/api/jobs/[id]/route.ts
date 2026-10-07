import type { NextRequest } from "next/server";
import { getJob, getWorker } from "@/lib/queries";

/** Status of a queued job, polled by the page until it is done. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/jobs/[id]">) {
  const { id } = await ctx.params;
  const [job, worker] = await Promise.all([getJob(Number(id)), getWorker()]);
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });
  return Response.json(
    { status: job.status, result: job.result, error: job.error, workerOnline: worker.online },
    { headers: { "Cache-Control": "no-store" } },
  );
}
