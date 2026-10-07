"use client";

import { CircleAlert, LoaderCircle, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { improveTopicAction } from "@/app/actions";
import type { TopicSetupResult } from "@/lib/agents/topic-setup";
import { formatCount } from "@/lib/util";

/** Claude researches keywords, X accounts and feeds; the app verifies them and adds the good ones. */
export function ImproveTopicButton({ topicId }: { topicId: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<TopicSetupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <button
        type="button"
        className="btn btn-secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            setResult(null);
            const res = await improveTopicAction(topicId);
            if (res.error) setError(res.error);
            if (res.result) setResult(res.result);
            router.refresh();
          })
        }
      >
        {pending ? <LoaderCircle size={16} className="animate-spin" aria-hidden /> : <Sparkles size={16} aria-hidden />}
        {pending ? "Researching… (1–3 min)" : "Improve with AI"}
      </button>

      {error && (
        <p className="t-small flex items-start gap-2 font-semibold" role="alert">
          <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden /> {error}
        </p>
      )}

      {result && (
        <div className="infobox flex-col gap-2" role="status">
          <p className="font-semibold">
            Added {result.addedKeywords.length} keywords, {result.addedAccounts.length} accounts and{" "}
            {result.addedFeeds.length} working feeds{result.descriptionSet ? ", and a description" : ""}. Review them
            below and press Save if you edit anything.
          </p>
          {result.addedAccounts.length > 0 && (
            <p className="text-muted">
              Accounts:{" "}
              {result.addedAccounts
                .map((a) => `@${a.handle}${a.followers != null ? ` (${formatCount(a.followers)})` : ""}`)
                .join(", ")}
            </p>
          )}
          {result.addedFeeds.length > 0 && (
            <p className="text-muted">
              Feeds: {result.addedFeeds.map((f) => `${f.name} (${f.items} items)`).join(", ")}
            </p>
          )}
          {(result.skippedFeeds.length > 0 || result.skippedAccounts.length > 0) && (
            <details className="t-caption text-muted">
              <summary className="cursor-pointer underline underline-offset-4">
                Skipped {result.skippedFeeds.length + result.skippedAccounts.length} suggestions that did not pass the
                checks
              </summary>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                {[...result.skippedAccounts.map((a) => `@${a}`), ...result.skippedFeeds].map((x) => (
                  <li key={x} className="break-all">
                    {x}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
