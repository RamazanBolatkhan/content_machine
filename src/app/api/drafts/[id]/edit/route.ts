import type { NextRequest } from "next/server";
import { z } from "zod";
import { editDraft } from "@/lib/agents/editor";
import { aiConfigured, aiSetupHint } from "@/lib/ai";
import { LANG_CODES, type LangCode } from "@/lib/languages";
import { getDraft } from "@/lib/queries";

const bodySchema = z.object({
  lang: z.enum(LANG_CODES as [string, ...string[]]),
  instruction: z.string().trim().min(1).max(2000),
  currentText: z.string().max(5000),
});

/** AI rewrite of one language version of a draft; the result is saved as a new version and returned as plain text. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/drafts/[id]/edit">) {
  const { id } = await ctx.params;
  const found = getDraft(Number(id));
  if (!found) return new Response("Not found", { status: 404 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new Response("Bad request", { status: 400 });
  if (!aiConfigured()) return new Response(aiSetupHint(), { status: 503 });

  try {
    const text = await editDraft(
      found.draft,
      parsed.data.lang as LangCode,
      parsed.data.currentText,
      parsed.data.instruction,
    );
    return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : String(e), { status: 500 });
  }
}
