import fs from "node:fs/promises";
import JSZip from "jszip";
import type { NextRequest } from "next/server";
import { getDraft } from "@/lib/queries";
import { mediaPath } from "@/lib/media";

/** All media of a draft as one zip file. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/drafts/[id]/media">) {
  const { id } = await ctx.params;
  const found = getDraft(Number(id));
  if (!found) return new Response("Not found", { status: 404 });

  const zip = new JSZip();
  for (const item of found.draft.media) {
    const filePath = item.file && mediaPath(item.file);
    if (filePath) zip.file(item.file!, await fs.readFile(filePath).catch(() => Buffer.alloc(0)));
  }
  const body = await zip.generateAsync({ type: "uint8array" });
  return new Response(body as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="draft_${found.draft.id}_media.zip"`,
    },
  });
}
