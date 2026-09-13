import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth/jwt";
import { ROLE_HOME } from "@/lib/auth/roles";

const PUBLIC_PREFIXES = ["/login", "/pass/", "/book/", "/api/gate-pass/", "/api/cron/", "/_next", "/favicon", "/brand"];
const ROLE_PREFIX: Record<string, string> = {
  "/admin": "admin",
  "/carrier": "carrier",
  "/customer": "customer",
  "/security": "security",
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const user = token ? await verifySessionToken(token) : null;

  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname === "/") {
    const url = req.nextUrl.clone();
    url.pathname = ROLE_HOME[user.role];
    return NextResponse.redirect(url);
  }

  for (const [prefix, role] of Object.entries(ROLE_PREFIX)) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      if (user.role !== role) {
        const url = req.nextUrl.clone();
        url.pathname = ROLE_HOME[user.role];
        return NextResponse.redirect(url);
      }
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/).*)"],
};
