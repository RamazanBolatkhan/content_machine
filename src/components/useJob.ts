"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { refreshAfterJob, startJob } from "@/app/actions";
import type { JobKind } from "@/db/schema";

export type JobState<T> = {
  status: "idle" | "queued" | "running" | "done" | "error";
  result?: T;
  error?: string;
  /** false when the local worker hasn't checked in recently: the job waits for it */
  workerOnline: boolean;
  seconds: number;
};

const IDLE = { status: "idle", workerOnline: true, seconds: 0 } as const;

/**
 * Queue a job for the local worker and follow it until it's done.
 * `run` resolves with the final state; the page data is refreshed afterwards.
 */
export function useJob<T = unknown>() {
  const router = useRouter();
  const [state, setState] = useState<JobState<T>>(IDLE);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const run = useCallback(
    async (kind: JobKind, payload: Record<string, unknown> = {}): Promise<JobState<T>> => {
      const started = Date.now();
      const elapsed = () => Math.round((Date.now() - started) / 1000);
      setState({ status: "queued", workerOnline: true, seconds: 0 });
      const { jobId, error } = await startJob(kind, payload);
      if (!jobId) {
        const failed: JobState<T> = { status: "error", error, workerOnline: true, seconds: 0 };
        setState(failed);
        return failed;
      }
      for (;;) {
        await new Promise((r) => setTimeout(r, 1500));
        if (!alive.current) return { ...IDLE };
        try {
          const res = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
          const body = (await res.json()) as {
            status: JobState<T>["status"];
            result?: T;
            error?: string;
            workerOnline: boolean;
          };
          const next: JobState<T> = { ...body, error: body.error ?? undefined, seconds: elapsed() };
          setState(next);
          if (body.status === "done" || body.status === "error") {
            await refreshAfterJob();
            router.refresh();
            return next;
          }
        } catch {
          // network hiccup (e.g. dev server reload): keep polling
          setState((s) => ({ ...s, seconds: elapsed() }));
        }
      }
    },
    [router],
  );

  const reset = useCallback(() => setState(IDLE), []);
  const busy = state.status === "queued" || state.status === "running";
  return { state, run, reset, busy };
}

/** "Working… 1:23" or "Waiting for your Mac…" */
export function jobLabel(state: JobState<unknown>, working = "Working…"): string {
  const t = `${Math.floor(state.seconds / 60)}:${String(state.seconds % 60).padStart(2, "0")}`;
  if (state.status === "queued" && !state.workerOnline) return `Waiting for your Mac worker… ${t}`;
  if (state.status === "queued") return `Queued… ${t}`;
  return `${working} ${t}`;
}
