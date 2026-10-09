"use client";

import { Check, RotateCcw, Send, X, LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { setDraftStatus } from "@/app/actions";
import type { DraftStatus } from "@/db/schema";

const ACTIONS = [
  { status: "approved", label: "Approve", icon: Check, variant: "btn-secondary" },
  { status: "rejected", label: "Reject", icon: X, variant: "btn-ghost" },
  { status: "posted", label: "Mark posted", icon: Send, variant: "btn-secondary" },
  { status: "new", label: "Back to new", icon: RotateCcw, variant: "btn-ghost" },
] as const;

export function StatusButtons({ draftId, status, compact = false }: { draftId: number; status: DraftStatus; compact?: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const visible = ACTIONS.filter((a) => a.status !== status && (a.status !== "posted" || status === "approved"));

  return (
    <div className="flex flex-wrap items-center gap-1" aria-busy={pending}>
      {visible.map(({ status: next, label, icon: Icon, variant }) => (
        <button
          key={next}
          className={`btn btn-sm ${compact ? "btn-ghost !w-8 !px-0" : variant}`}
          title={label}
          aria-label={label}
          disabled={pending}
          onClick={() => {
            setError(null);
            start(async () => {
              try { await setDraftStatus(draftId, next); }
              catch { setError("Couldn’t save. Please try again."); }
            });
          }}
        >
          <Icon size={16} aria-hidden />
          {!compact && label}
        </button>
      ))}
      {pending && <span className="t-caption flex items-center gap-1 text-muted" role="status"><LoaderCircle size={12} className="animate-spin" aria-hidden /><span className={compact ? "sr-only" : ""}>Saving…</span></span>}
      {error && <span className="feedback t-caption w-full" role="alert">{error}</span>}
    </div>
  );
}
