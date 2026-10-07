import JSZip from "jszip";
import type { NextRequest } from "next/server";
import { getDraft } from "@/lib/queries";

/** All stored media of a draft as one zip file. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/drafts/[id]/media">) {
  const { id } = await ctx.params;
  const found = await getDraft(Number(id));
  if (!found) return new Response("Not found", { status: 404 });

  const zip = new JSZip();
  let i = 0;
  for (const item of found.draft.media) {
    if (!item.file) continue;
    const res = await fetch(item.file).catch(() => null);
    if (!res?.ok) continue;
    const name = new URL(item.file).pathname.split("/").pop() ?? `file_${i}`;
    zip.file(`${++i}_${name}`, new Uint8Array(await res.arrayBuffer()));
  }
  const body = await zip.generateAsync({ type: "uint8array" });
  return new Response(body as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="draft_${found.draft.id}_media.zip"`,
    },
  });
}
