import { z } from "zod";
import type { Settings } from "@/db/schema";
import { aiObject, writingRules } from "@/lib/ai";
import { langInfo, type LangCode } from "@/lib/languages";

export type WriteInput = {
  id: string;
  source: string;
  text: string;
};

// Several items per AI call keeps runs fast; small enough to stay reliable
const BATCH_SIZE = 3;

/**
 * Writes a ready-to-post text for each item in every requested language.
 * Returns item id → language → text (languages the AI skipped are missing).
 */
export async function writePosts(
  items: WriteInput[],
  langs: LangCode[],
  settings: Settings,
): Promise<Map<string, Partial<Record<LangCode, string>>>> {
  const out = new Map<string, Partial<Record<LangCode, string>>>();
  if (!items.length || !langs.length) return out;

  const postsSchema = z.object(
    Object.fromEntries(langs.map((code) => [code, z.string().describe(`Post in ${langInfo(code).hint}`)])) as Record<
      LangCode,
      z.ZodString
    >,
  );
  const schema = z.object({
    items: z.array(z.object({ id: z.string().describe("Item id, exactly as given"), posts: postsSchema })),
  });

  for (let start = 0; start < items.length; start += BATCH_SIZE) {
    const batch = items.slice(start, start + BATCH_SIZE);
    const result = await aiObject(schema, {
      instructions: [
        "You write short social media posts about news and interesting content for a multilingual audience.",
        `For each item, write one complete, ready-to-post text in each of these languages: ${langs.map((c) => langInfo(c).hint).join(", ")}.`,
        "Each language version must stand on its own (no 'see above', no mixing languages).",
        "Only use facts from the item. For long articles, pick the 2–4 most important facts.",
        "",
        writingRules(settings),
      ].join("\n"),
      prompt: JSON.stringify(
        batch.map((i) => ({ id: i.id, source: i.source, text: i.text.slice(0, 3000) })),
        null,
        1,
      ),
    });
    for (const item of result.items) {
      const posts: Partial<Record<LangCode, string>> = {};
      for (const code of langs) {
        const text = item.posts[code]?.trim();
        if (text) posts[code] = text;
      }
      out.set(item.id, posts);
    }
  }
  return out;
}
