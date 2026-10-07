"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveManualVersion, writeMissingLanguagesAction } from "@/app/actions";
import type { DraftVersion } from "@/db/schema";
import { langInfo, type LangCode } from "@/lib/languages";

const QUICK_ASKS = [
  "Make it shorter",
  "Make it more exciting",
  "More neutral, like a news report",
  "Add context for people who don't follow AI",
  "Explain the technical terms simply",
  "Remove emoji",
];

const SOURCE_LABEL: Record<DraftVersion["source"], string> = {
  ai_scout: "🤖 AI",
  ai_edit: "🤖 AI edit",
  manual: "✍️ Manual",
};

export function DraftEditor({
  draftId,
  versions,
  langs,
  charLimit,
  hasMedia,
}: {
  draftId: number;
  versions: DraftVersion[]; // newest first
  langs: LangCode[];
  charLimit: number;
  hasMedia: boolean;
}) {
  const router = useRouter();
  const latestFor = (code: LangCode) => versions.find((v) => v.lang === code)?.text ?? "";

  const [lang, setLang] = useState<LangCode>(langs.find((c) => latestFor(c)) ?? langs[0]);
  // Unsaved edits per language, so switching tabs keeps them
  const [edits, setEdits] = useState<Partial<Record<LangCode, string>>>({});
  const [instruction, setInstruction] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, startSave] = useTransition();
  const [filling, startFill] = useTransition();

  const latest = latestFor(lang);
  const text = edits[lang] ?? latest;
  const setText = (value: string) => setEdits((e) => ({ ...e, [lang]: value }));
  const dirty = text.trim() !== latest.trim();
  const over = text.length > charLimit;
  const missing = langs.filter((c) => !latestFor(c));
  const langVersions = versions.filter((v) => v.lang === lang);

  async function askAi(ask: string) {
    if (!ask.trim() || aiBusy || !text.trim()) return;
    setAiBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/drafts/${draftId}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, instruction: ask, currentText: text }),
      });
      const body = await res.text();
      if (!res.ok) throw new Error(body || `Error ${res.status}`);
      setEdits((e) => ({ ...e, [lang]: undefined })); // show the saved version
      setInstruction("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAiBusy(false);
    }
  }

  function fillMissing() {
    setError(null);
    startFill(async () => {
      const res = await writeMissingLanguagesAction(draftId);
      if (res.error) setError(res.error);
      router.refresh();
    });
  }

  async function copy() {
    await navigator.clipboard.writeText(text.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {langs.map((code) => {
            const info = langInfo(code);
            const has = Boolean(latestFor(code));
            return (
              <button
                key={code}
                onClick={() => setLang(code)}
                className={`rounded-full px-3 py-1 text-sm ${
                  code === lang
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                } ${has ? "" : "opacity-50"}`}
                title={info.name}
              >
                {info.flag} {info.native}
                {edits[code] !== undefined && edits[code] !== latestFor(code) && " •"}
              </button>
            );
          })}
        </div>

        {missing.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            <span>Not written yet: {missing.map((c) => langInfo(c).name).join(", ")}</span>
            <button className="btn text-xs" onClick={fillMissing} disabled={filling}>
              {filling ? "Writing…" : "✨ Write missing languages"}
            </button>
          </div>
        )}

        <div className="mb-2 flex items-center justify-between">
          <span className="label">
            {langInfo(lang).flag} {langInfo(lang).name} post
          </span>
          <span className={`text-xs ${over ? "font-semibold text-rose-600" : "text-zinc-500"}`}>
            {text.length} / {charLimit}
          </span>
        </div>
        <textarea
          lang={lang}
          className="input min-h-56 text-base leading-relaxed"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={aiBusy}
          placeholder={latest ? "" : "No text in this language yet. Write one or press “Write missing languages”."}
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
            disabled={!dirty || !text.trim() || saving || aiBusy}
            onClick={() =>
              startSave(async () => {
                await saveManualVersion(draftId, lang, text);
                setEdits((e) => ({ ...e, [lang]: undefined }));
              })
            }
          >
            {saving ? "Saving…" : "💾 Save edit"}
          </button>
          {dirty && !aiBusy && (
            <button className="btn" onClick={() => setEdits((e) => ({ ...e, [lang]: undefined }))}>
              Undo changes
            </button>
          )}
        </div>
      </div>

      <div className="card p-4">
        <span className="label">Ask AI to adjust the {langInfo(lang).name} post</span>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {QUICK_ASKS.map((q) => (
            <button key={q} className="btn text-xs" disabled={aiBusy || !text.trim()} onClick={() => askAi(q)}>
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
            placeholder="e.g. “mention that it's free for students” (any language)"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            disabled={aiBusy}
          />
          <button className="btn btn-primary" disabled={aiBusy || !instruction.trim() || !text.trim()}>
            {aiBusy ? "Writing…" : "Send"}
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      </div>

      <div className="card p-4">
        <span className="label">{langInfo(lang).name} version history</span>
        {langVersions.length === 0 && <p className="text-sm text-zinc-500">No versions yet.</p>}
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {langVersions.map((v, i) => (
            <li key={v.id} className="flex items-start justify-between gap-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="text-xs text-zinc-500">
                  {SOURCE_LABEL[v.source]} · {v.createdAt.toLocaleString()} {i === 0 && "· current"}
                </div>
                {v.instruction && <div className="text-xs text-zinc-500 italic">“{v.instruction}”</div>}
                <p className="line-clamp-2" lang={v.lang}>
                  {v.text}
                </p>
              </div>
              {v.text !== text && (
                <button className="btn shrink-0 text-xs" onClick={() => setText(v.text)} disabled={aiBusy}>
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
