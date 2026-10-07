"use client";

import { CircleAlert, LoaderCircle, Wand2 } from "lucide-react";
import { jobLabel, useJob } from "./useJob";

/** Writes the post in every enabled language (the scout only scores news). */
export function WriteButton({ draftId, label = "Write it" }: { draftId: number; label?: string }) {
  const { state, run, busy } = useJob<{ written: number }>();

  return (
    <div className="flex flex-col items-end gap-1">
      <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => run("write", { draftId })}>
        {busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden /> : <Wand2 size={16} aria-hidden />}
        {busy ? "Writing…" : label}
      </button>
      {busy && <span className="t-caption text-muted">{jobLabel(state, "Writing…")}</span>}
      {state.status === "error" && (
        <span className="t-caption flex items-center gap-1 font-semibold" role="alert">
          <CircleAlert size={12} aria-hidden /> {state.error?.slice(0, 120)}
        </span>
      )}
    </div>
  );
}
