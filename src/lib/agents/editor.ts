import { db, schema } from "@/db";
import type { Draft } from "@/db/schema";
import { AI_PROVIDER, aiText, translationRules } from "@/lib/ai";
import { getSettings } from "@/lib/queries";

/**
 * Rewrites a draft's Russian text following the owner's instruction
 * and saves the result as a new "ai_edit" version.
 */
export async function editDraft(draft: Draft, currentText: string, instruction: string): Promise<string> {
  const settings = getSettings();
  const canBrowse = AI_PROVIDER === "claude-code";
  const isX = draft.source === "x_bookmark" || draft.source === "x_search";

  const text = await aiText({
    web: canBrowse && !isX ? "fetch" : undefined,
    instructions: [
      "You edit a Russian Threads post. Apply the owner's instruction to the current text.",
      "Reply with ONLY the full new post text: no quotes, no explanations, no preface.",
      canBrowse && !isX
        ? "If the instruction needs more facts, open the source URL with WebFetch. Never invent facts."
        : "Never invent facts that are not in the source.",
      "",
      translationRules(settings),
    ].join("\n"),
    prompt: [
      isX ? `Source: X post by @${draft.authorHandle} (${draft.sourceUrl})` : `Source: ${draft.sourceName} (${draft.sourceUrl})`,
      draft.originalText,
      "",
      "Current Russian text:",
      currentText,
      "",
      `Instruction: ${instruction}`,
    ].join("\n"),
  });

  const finalText = text.trim();
  if (!finalText) throw new Error("AI returned an empty answer");
  db.insert(schema.draftVersions).values({ draftId: draft.id, textRu: finalText, source: "ai_edit", instruction }).run();
  return finalText;
}
