import { db, schema } from "@/db";
import type { Draft } from "@/db/schema";
import { AI_PROVIDER, aiText, writingRules } from "@/lib/ai";
import { enabledLangs, langInfo, type LangCode } from "@/lib/languages";
import { getDraft, getSettings, latestTexts } from "@/lib/queries";
import { writePosts } from "./writer";

const isXSource = (draft: Draft) => draft.source === "x_bookmark" || draft.source === "x_search";

/**
 * Rewrites one language version of a draft following the owner's instruction
 * and saves the result as a new "ai_edit" version.
 */
export async function editDraft(draft: Draft, lang: LangCode, currentText: string, instruction: string): Promise<string> {
  const settings = getSettings();
  const canBrowse = AI_PROVIDER === "claude-code" && !isXSource(draft);

  const text = await aiText({
    web: canBrowse ? "fetch" : undefined,
    instructions: [
      `You edit a social media post written in ${langInfo(lang).hint}. Apply the owner's instruction to the current text.`,
      `The result must stay in ${langInfo(lang).hint}, even if the instruction is written in another language.`,
      "Reply with ONLY the full new post text: no quotes, no explanations, no preface.",
      canBrowse
        ? "If the instruction needs more facts, open the source URL with WebFetch. Never invent facts."
        : "Never invent facts that are not in the source.",
      "",
      writingRules(settings),
    ].join("\n"),
    prompt: [
      isXSource(draft)
        ? `Source: X post by @${draft.authorHandle} (${draft.sourceUrl})`
        : `Source: ${draft.sourceName} (${draft.sourceUrl})`,
      draft.originalText,
      "",
      "Current post:",
      currentText,
      "",
      `Instruction: ${instruction}`,
    ].join("\n"),
  });

  const finalText = text.trim();
  if (!finalText) throw new Error("AI returned an empty answer");
  db.insert(schema.draftVersions)
    .values({ draftId: draft.id, lang, text: finalText, source: "ai_edit", instruction })
    .run();
  return finalText;
}

/** Write the enabled languages a draft doesn't have yet (e.g. after enabling a new language). */
export async function writeMissingLanguages(draftId: number): Promise<number> {
  const found = getDraft(draftId);
  if (!found) throw new Error("Draft not found");
  const settings = getSettings();
  const have = latestTexts(found.versions);
  const missing = enabledLangs(settings).filter((code) => !have[code]);
  if (!missing.length) return 0;

  const { draft } = found;
  const posts = await writePosts(
    [
      {
        id: draft.sourceId,
        source: isXSource(draft) ? `X post by @${draft.authorHandle}` : draft.sourceName,
        text: draft.originalText,
      },
    ],
    missing,
    settings,
  );
  const texts = Object.entries(posts.get(draft.sourceId) ?? {});
  if (texts.length) {
    db.insert(schema.draftVersions)
      .values(texts.map(([lang, text]) => ({ draftId, lang, text, source: "ai_scout" as const })))
      .run();
  }
  return texts.length;
}
