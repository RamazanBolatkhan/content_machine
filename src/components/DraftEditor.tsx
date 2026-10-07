"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveManualVersion } from "@/app/actions";
import type { DraftVersion } from "@/db/schema";
import { THREADS_CHAR_LIMIT } from "@/lib/util";

const QUICK_ASKS = [
  "Сделай короче",
  "Сделай более хайповым",
  "Сделай нейтральнее, как новость",
  "Добавь контекст для тех, кто не следит за игрой",
  "Убери эмодзи",
];

const SOURCE_LABEL: Record<DraftVersion["source"], string> = {
  ai_scout: "🤖 Scout",
  ai_edit: "🤖 AI edit",
  manual: "✍️ Manual",
};

export function DraftEditor({
  draftId,
  versions,
  hasMedia,
}: {
  draftId: number;
  versions: DraftVersion[];
  hasMedia: boolean;
}) {
  const router = useRouter();
  const latest = versions[0]?.textRu ?? "";
  const [text, setText] = useState(latest);
  const [instruction, setInstruction] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, startSave] = useTransition();

  const dirty = text.trim() !== latest.trim();
  const over = text.length > THREADS_CHAR_LIMIT;

  async function askAi(ask: string) {
    if (!ask.trim() || aiBusy) return;
    setAiBusy(true);
    setError(null);
    const before = text;
    try {
      const res = await fetch(`/api/drafts/${draftId}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: ask, currentText: text }),
      });
      if (!res.ok || !res.body) throw new Error(`${res.status} ${await res.text()}`);
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let out = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        out += value;
        setText(out);
      }
      if (!out.trim()) {
        setText(before);
        throw new Error("AI returned an empty answer");
      }
      setText(out.trim());
      setInstruction("");
      router.refresh(); // pull the saved version into the history list
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAiBusy(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(text.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="label">Russian post</span>
          <span className={`text-xs ${over ? "font-semibold text-rose-600" : "text-zinc-500"}`}>
            {text.length} / {THREADS_CHAR_LIMIT}
          </span>
        </div>
        <textarea
          className="input min-h-56 text-base leading-relaxed"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={aiBusy}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={copy} disabled={!text.trim()}>
            {copied ? "✓ Copied" : "📋 Copy text"}
          </button>
          {hasMedia && (
            <a className="btn" href={`/api/drafts/${draftId}/media`}>
              ⬇️ Download media
            </a>
          )}
          <button
            className="btn"
            disabled={!dirty || saving || aiBusy}
            onClick={() => startSave(() => saveManualVersion(draftId, text))}
          >
            {saving ? "Saving…" : "💾 Save edit"}
          </button>
          {dirty && !aiBusy && (
            <button className="btn" onClick={() => setText(latest)}>
              Undo changes
            </button>
          )}
        </div>
      </div>

      <div className="card p-4">
        <span className="label">Ask AI to adjust</span>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {QUICK_ASKS.map((q) => (
            <button key={q} className="btn text-xs" disabled={aiBusy} onClick={() => askAi(q)}>
              {q}
            </button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            askAi(instruction);
          }}
        >
          <input
            className="input"
            placeholder="e.g. «добавь, что релиз 26 мая 2026» or “make it sound like breaking news”"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            disabled={aiBusy}
          />
          <button className="btn btn-primary" disabled={aiBusy || !instruction.trim()}>
            {aiBusy ? "Writing…" : "Send"}
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      </div>

      <div className="card p-4">
        <span className="label">Version history</span>
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {versions.map((v, i) => (
            <li key={v.id} className="flex items-start justify-between gap-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="text-xs text-zinc-500">
                  {SOURCE_LABEL[v.source]} · {v.createdAt.toLocaleString()} {i === 0 && "· current"}
                </div>
                {v.instruction && <div className="text-xs text-zinc-500 italic">“{v.instruction}”</div>}
                <p className="line-clamp-2">{v.textRu}</p>
              </div>
              {v.textRu !== text && (
                <button className="btn shrink-0 text-xs" onClick={() => setText(v.textRu)} disabled={aiBusy}>
                  Load
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
