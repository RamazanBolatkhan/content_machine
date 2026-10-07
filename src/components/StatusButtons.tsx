"use client";

import { useTransition } from "react";
import { setDraftStatus } from "@/app/actions";
import type { DraftStatus } from "@/db/schema";

const ACTIONS: { status: DraftStatus; label: string; className: string }[] = [
  { status: "approved", label: "✅ Approve", className: "btn-good" },
  { status: "rejected", label: "❌ Reject", className: "btn-bad" },
  { status: "posted", label: "📤 Mark posted", className: "" },
  { status: "new", label: "↩︎ Back to new", className: "" },
];

export function StatusButtons({ draftId, status }: { draftId: number; status: DraftStatus }) {
  const [pending, start] = useTransition();
  const visible = ACTIONS.filter((a) => a.status !== status && (a.status !== "posted" || status === "approved"));

  return (
    <div className="flex flex-wrap gap-2">
      {visible.map((a) => (
        <button
          key={a.status}
          className={`btn ${a.className}`}
          disabled={pending}
          onClick={() => start(() => setDraftStatus(draftId, a.status))}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
