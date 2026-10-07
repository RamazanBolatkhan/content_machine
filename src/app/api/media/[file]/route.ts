import fs from "node:fs/promises";
import type { NextRequest } from "next/server";
import { contentTypeFor, mediaPath } from "@/lib/media";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/media/[file]">) {
  const { file } = await ctx.params;
  const filePath = mediaPath(file);
  if (!filePath) return new Response("Bad file name", { status: 400 });
  try {
    const data = await fs.readFile(filePath);
    return new Response(data, {
      headers: { "Content-Type": contentTypeFor(file), "Cache-Control": "private, max-age=31536000, immutable" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
