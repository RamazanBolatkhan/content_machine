/**
 * Simple password protection for the hosted site.
 * Set APP_PASSWORD (on Vercel). Without it (e.g. locally) the site is open.
 */
export const AUTH_COOKIE = "cm_auth";

export function authEnabled(): boolean {
  return Boolean(process.env.APP_PASSWORD);
}

/** Cookie value: a hash of the password, so the password itself is never stored in the browser. */
export async function authToken(): Promise<string> {
  const data = new TextEncoder().encode(`content-machine:${process.env.APP_PASSWORD ?? ""}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Buffer.from(hash).toString("hex");
}
