import { generateText, Output } from "ai";
import { z } from "zod";
import type { Settings } from "@/db/schema";
import { findClaudeBin, runClaude } from "./claude-cli";
import { lines } from "./util";

/**
 * Two ways to run the AI:
 * - "claude-code" (default): the local Claude Code CLI on the owner's subscription, no API cost
 * - "gateway": Vercel AI Gateway, paid per token (AI_GATEWAY_API_KEY)
 */
export const AI_PROVIDER = process.env.AI_PROVIDER === "gateway" ? "gateway" : "claude-code";

/** Model string routed through Vercel AI Gateway. */
const GATEWAY_MODEL = process.env.AI_MODEL || "anthropic/claude-sonnet-5.5";

export function aiConfigured(): boolean {
  if (AI_PROVIDER === "gateway") return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
  return findClaudeBin() !== null;
}

export function aiSetupHint(): string {
  return AI_PROVIDER === "gateway"
    ? "AI_GATEWAY_API_KEY is not set in .env.local"
    : "Claude Code CLI not found. Install Claude Code and log in, or set CLAUDE_BIN in .env.local";
}

type AiTask = {
  instructions: string;
  prompt: string;
  /** Let the AI search / open web pages (claude-code only). */
  web?: "search" | "fetch";
};

function webTools(web: AiTask["web"]): string[] {
  if (web === "search") return ["WebSearch", "WebFetch"];
  if (web === "fetch") return ["WebFetch"];
  return [];
}

/** Ask the AI for data matching a zod schema. */
export async function aiObject<T extends z.ZodType>(schema: T, task: AiTask): Promise<z.infer<T>> {
  if (AI_PROVIDER === "gateway") {
    if (task.web === "search") throw new Error("Web search needs AI_PROVIDER=claude-code");
    const { output } = await generateText({
      model: GATEWAY_MODEL,
      output: Output.object({ schema }),
      instructions: task.instructions,
      prompt: task.prompt,
    });
    return output as z.infer<T>;
  }
  const { text, structured } = await runClaude({
    system: task.instructions,
    prompt: task.prompt,
    jsonSchema: z.toJSONSchema(schema, { target: "draft-7" }),
    tools: webTools(task.web),
  });
  return schema.parse(structured ?? JSON.parse(text));
}

/** Ask the AI for plain text. */
export async function aiText(task: AiTask): Promise<string> {
  if (AI_PROVIDER === "gateway") {
    const { text } = await generateText({ model: GATEWAY_MODEL, instructions: task.instructions, prompt: task.prompt });
    return text.trim();
  }
  const { text } = await runClaude({ system: task.instructions, prompt: task.prompt, tools: webTools(task.web) });
  return text;
}

export const DEFAULT_STYLE = `Пиши как живой игровой новостной аккаунт в Threads: коротко, по делу, без канцелярита.
Первая строка — цепляющая суть новости. Можно 1–2 уместных эмодзи. Без хэштегов, если не просят.
Не выдумывай факты, которых нет в источнике. Слухи помечай как слухи.`;

/** Shared translation rules for the scout and editor agents. */
export function translationRules(settings: Settings): string {
  const glossary = lines(settings.glossary);
  return [
    "Target language: Russian. Target platform: Threads (max 500 characters).",
    "Write a natural Russian post for a gaming audience, not a word-for-word translation.",
    "Keep game titles, studio names, platform names and well-known gaming terms in their original form.",
    glossary.length ? `Never translate these terms: ${glossary.join(", ")}.` : "",
    `Style guide:\n${settings.stylePrompt.trim() || DEFAULT_STYLE}`,
  ]
    .filter(Boolean)
    .join("\n");
}
