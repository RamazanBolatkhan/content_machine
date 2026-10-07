"use client";

import { Check, RotateCcw, Send, X } from "lucide-react";
import { useTransition } from "react";
import { setDraftStatus } from "@/app/actions";
import type { DraftStatus } from "@/db/schema";

const ACTIONS = [
  { status: "approved", label: "Approve", icon: Check, variant: "btn-secondary" },
  { status: "rejected", label: "Reject", icon: X, variant: "btn-ghost" },
  { status: "posted", label: "Mark posted", icon: Send, variant: "btn-secondary" },
  { status: "new", label: "Back to new", icon: RotateCcw, variant: "btn-ghost" },
] as const;

export function StatusButtons({ draftId, status }: { draftId: number; status: DraftStatus }) {
  const [pending, start] = useTransition();
  const visible = ACTIONS.filter((a) => a.status !== status && (a.status !== "posted" || status === "approved"));

  return (
    <div className="flex flex-wrap gap-2">
      {visible.map(({ status: next, label, icon: Icon, variant }) => (
        <button
          key={next}
          className={`btn btn-sm ${variant}`}
          disabled={pending}
          onClick={() => start(() => setDraftStatus(draftId, next))}
        >
          <Icon size={16} aria-hidden />
          {label}
        </button>
      ))}
    </div>
  );
}
