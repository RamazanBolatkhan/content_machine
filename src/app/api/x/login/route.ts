import { requestOrigin } from "@/lib/request-origin";
import { buildAuthorizeUrl, redirectUri } from "@/lib/x/auth";

/** Start "Connect X": send the owner to X's login page. */
export async function GET(req: Request) {
  // X only accepts the exact callback URL, so log in from the same host
  const expected = new URL(redirectUri());
  if (new URL(requestOrigin(req)).host !== expected.host) {
    return Response.redirect(new URL("/api/x/login", expected.origin));
  }
  try {
    return Response.redirect(await buildAuthorizeUrl());
  } catch (e) {
    return new Response(e instanceof Error ? e.message : String(e), { status: 500 });
  }
}
