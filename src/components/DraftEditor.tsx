"use client";

import { Check, CircleAlert, Copy, Download, History, LoaderCircle, Save, Send, Sparkles, Undo2, Wand2 } from "lucide-react";
import { useState, useTransition } from "react";
import { saveManualVersion } from "@/app/actions";
import type { DraftVersion } from "@/db/schema";
import { langInfo, type LangCode } from "@/lib/languages";
import { jobLabel, useJob } from "./useJob";

const QUICK_ASKS = [
  "Make it shorter",
  "Make it more exciting",
  "More neutral, like a news report",
  "Add context for newcomers to the topic",
  "Explain the technical terms simply",
  "Remove emoji",
];

const SOURCE_LABEL: Record<DraftVersion["source"], string> = {
  ai_scout: "AI draft",
  ai_edit: "AI edit",
  manual: "Your edit",
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
  const editJob = useJob<{ text: string }>();
  const fillJob = useJob<{ written: number }>();
  const latestFor = (code: LangCode) => versions.find((v) => v.lang === code)?.text ?? "";

  const [lang, setLang] = useState<LangCode>(langs.find((c) => latestFor(c)) ?? langs[0]);
  // Unsaved edits per language, so switching tabs keeps them
  const [edits, setEdits] = useState<Partial<Record<LangCode, string>>>({});
  const [instruction, setInstruction] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, startSave] = useTransition();

  const aiBusy = editJob.busy;
  const filling = fillJob.busy;
  const info = langInfo(lang);
  const latest = latestFor(lang);
  const text = edits[lang] ?? latest;
  const setText = (value: string) => setEdits((e) => ({ ...e, [lang]: value }));
  const dirty = text.trim() !== latest.trim();
  const over = text.length > charLimit;
  const missing = langs.filter((c) => !latestFor(c));
  const langVersions = versions.filter((v) => v.lang === lang);
  const discard = () => setEdits((e) => ({ ...e, [lang]: undefined }));

  async function askAi(ask: string) {
    if (!ask.trim() || aiBusy || !text.trim()) return;
    setError(null);
    const res = await editJob.run("edit", { draftId, lang, currentText: text, instruction: ask });
    if (res.status === "error") setError(res.error ?? "Something went wrong");
    else {
      discard(); // show the saved version
      setInstruction("");
    }
  }

  async function fillMissing() {
    setError(null);
    const res = await fillJob.run("write", { draftId });
    if (res.status === "error") setError(res.error ?? "Something went wrong");
  }

  async function copy() {
    await navigator.clipboard.writeText(text.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-6">
      {/* ---- Post ---- */}
      <section className="card space-y-4 p-6" aria-labelledby="post-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="post-heading" className="t-h5">
            Post
          </h2>
          <div className="segmented" role="tablist" aria-label="Language">
            {langs.map((code) => {
              const has = Boolean(latestFor(code));
              const unsaved = edits[code] !== undefined && edits[code] !== latestFor(code);
              return (
                <button
                  key={code}
                  role="tab"
                  aria-selected={code === lang}
                  onClick={() => setLang(code)}
                  className={`segment ${code === lang ? "segment-active" : ""} ${has ? "" : "line-through decoration-1"}`}
                  title={`${langInfo(code).name}${has ? "" : " (not written yet)"}`}
                >
                  {code.toUpperCase()}
                  {unsaved && <span className="size-1.5 rounded-full bg-fg" aria-label="unsaved changes" />}
                </button>
              );
            })}
          </div>
        </div>

        {missing.length > 0 && (
          <div className="infobox items-center justify-between">
            <div className="flex items-center gap-3">
              <CircleAlert size={18} className="shrink-0" aria-hidden />
              <span>Not written yet: {missing.map((c) => langInfo(c).name).join(", ")}</span>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={fillMissing} disabled={filling}>
              {filling ? <LoaderCircle size={16} className="animate-spin" aria-hidden /> : <Wand2 size={16} aria-hidden />}
              {filling ? jobLabel(fillJob.state, "Writing…") : "Write them"}
            </button>
          </div>
        )}

        <div>
          <div className="mb-2 flex items-end justify-between gap-4">
            <label htmlFor="post-text" className="field-label mb-0">
              {info.name} <span className="font-normal text-muted">· {info.native}</span>
            </label>
            <span className={`t-caption ${over ? "font-bold text-fg" : "text-muted"}`} aria-live="polite">
              {text.length} / {charLimit}
              {over && " · too long"}
            </span>
          </div>
          <textarea
            id="post-text"
            lang={lang}
            className={`input t-body-lg min-h-64 ${over ? "border-fg border-2" : ""}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={aiBusy}
            placeholder={latest ? "" : "No text in this language yet. Write one, or press “Write them” above."}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button className="btn btn-primary" onClick={copy} disabled={!text.trim()}>
            {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
            {copied ? "Copied" : "Copy text"}
          </button>
          {hasMedia && (
            <a className="btn btn-secondary" href={`/api/drafts/${draftId}/media`}>
              <Download size={16} aria-hidden /> Download media
            </a>
          )}
          <button
            className="btn btn-secondary"
            disabled={!dirty || !text.trim() || saving || aiBusy}
            onClick={() =>
              startSave(async () => {
                await saveManualVersion(draftId, lang, text);
                discard();
              })
            }
          >
            <Save size={16} aria-hidden /> {saving ? "Saving…" : "Save edit"}
          </button>
          {dirty && !aiBusy && (
            <button className="btn btn-tertiary" onClick={discard}>
              <Undo2 size={16} aria-hidden /> Undo changes
            </button>
          )}
        </div>
      </section>

      {/* ---- Ask AI ---- */}
      <section className="card space-y-4 p-6" aria-labelledby="ai-heading">
        <div className="space-y-1">
          <h2 id="ai-heading" className="t-h5 flex items-center gap-2">
            <Sparkles size={18} aria-hidden /> Ask AI to adjust
          </h2>
          <p className="t-small text-muted">Changes the {info.name} post only. You can ask in any language.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK_ASKS.map((q) => (
            <button key={q} className="chip" disabled={aiBusy || !text.trim()} onClick={() => askAi(q)}>
              {q}
            </button>
          ))}
        </div>
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            askAi(instruction);
          }}
        >
          <label htmlFor="ai-instruction" className="sr-only">
            Instruction for the AI
          </label>
          <input
            id="ai-instruction"
            className="input"
            placeholder="e.g. “mention that it's free for students”"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            disabled={aiBusy}
          />
          <button className="btn btn-primary btn-lg" disabled={aiBusy || !instruction.trim() || !text.trim()}>
            {aiBusy ? <LoaderCircle size={18} className="animate-spin" aria-hidden /> : <Send size={18} aria-hidden />}
            {aiBusy ? jobLabel(editJob.state, "Writing…") : "Send"}
          </button>
        </form>
        {error && (
          <p className="t-small flex items-start gap-2 font-semibold" role="alert">
            <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden /> {error}
          </p>
        )}
      </section>

      {/* ---- History ---- */}
      <section className="card p-6" aria-labelledby="history-heading">
        <h2 id="history-heading" className="t-h5 mb-2 flex items-center gap-2">
          <History size={18} aria-hidden /> {info.name} history
        </h2>
        {langVersions.length === 0 && <p className="t-small text-muted">No versions yet.</p>}
        <ul>
          {langVersions.map((v, i) => (
            <li key={v.id} className="flex items-start justify-between gap-4 border-b border-line py-4 last:border-b-0">
              <div className="min-w-0 space-y-1">
                <div className="t-caption flex flex-wrap items-center gap-2 text-muted">
                  <span className={`badge ${i === 0 ? "badge-inverse" : ""}`}>{i === 0 ? "Current" : SOURCE_LABEL[v.source]}</span>
                  {i === 0 && <span>{SOURCE_LABEL[v.source]}</span>}
                  <span>{v.createdAt.toLocaleString()}</span>
                </div>
                {v.instruction && <p className="t-caption text-muted italic">“{v.instruction}”</p>}
                <p className="t-small line-clamp-2" lang={v.lang}>
                  {v.text}
                </p>
              </div>
              {v.text !== text && (
                <button className="btn btn-secondary btn-sm" onClick={() => setText(v.text)} disabled={aiBusy}>
                  Load
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
