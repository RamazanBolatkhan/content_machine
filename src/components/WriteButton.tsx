"use client";

import { CircleAlert, LoaderCircle, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { writeMissingLanguagesAction } from "@/app/actions";

/** Writes the post in every enabled language (the scout only scores news). */
export function WriteButton({ draftId, label = "Write it" }: { draftId: number; label?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        className="btn btn-primary btn-sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await writeMissingLanguagesAction(draftId);
            if (res.error) setError(res.error);
            router.refresh();
          })
        }
      >
        {pending ? <LoaderCircle size={16} className="animate-spin" aria-hidden /> : <Wand2 size={16} aria-hidden />}
        {pending ? "Writing…" : label}
      </button>
      {error && (
        <span className="t-caption flex items-center gap-1 font-semibold" role="alert">
          <CircleAlert size={12} aria-hidden /> {error.slice(0, 120)}
        </span>
      )}
    </div>
  );
}
