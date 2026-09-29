import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE_NAME, getGateConfig, verifyAccessToken } from "@/lib/access/token";

// Optional shared-password gate. Off when APP_ACCESS_PASSWORD is not set.
export async function proxy(request: NextRequest) {
  const gate = getGateConfig();
  if (!gate.enabled) return NextResponse.next();

  const token = request.cookies.get(ACCESS_COOKIE_NAME)?.value;
  if (gate.secret && (await verifyAccessToken(gate.secret, token))) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  url.pathname = "/access";
  url.search = "";
  if (next !== "/") url.searchParams.set("next", next);

  // Non-page requests (route handlers, server actions) get a plain 401.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!access|_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
