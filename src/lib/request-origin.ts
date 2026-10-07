/**
 * The origin the browser actually used (e.g. http://127.0.0.1:3000).
 * `req.url` can't be trusted for this: the dev server may report "localhost"
 * even when the page was opened at 127.0.0.1.
 */
export function requestOrigin(req: Request): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
  const proto = req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
  return `${proto}://${host}`;
}
