import { completeLogin } from "@/lib/x/auth";

/** X redirects here after the owner approves access. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const settingsUrl = new URL("/settings", url.origin);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (error || !code || !state) {
    settingsUrl.searchParams.set("x_error", error ?? "missing code");
    return Response.redirect(settingsUrl);
  }
  try {
    await completeLogin(code, state);
    settingsUrl.searchParams.set("x", "connected");
  } catch (e) {
    settingsUrl.searchParams.set("x_error", e instanceof Error ? e.message : String(e));
  }
  return Response.redirect(settingsUrl);
}
