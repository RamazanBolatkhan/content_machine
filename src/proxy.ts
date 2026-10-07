import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, authEnabled, authToken } from "@/lib/auth";

/** Everything except the login page and static files needs the password cookie (when APP_PASSWORD is set). */
export async function proxy(request: NextRequest) {
  if (!authEnabled()) return NextResponse.next();
  if (request.cookies.get(AUTH_COOKIE)?.value === (await authToken())) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }
  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|icon.svg|favicon.ico).*)"],
};
