import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PUBLIC_PATHS = new Set([
  "/login",
  "/recuperar-password",
  "/reset-password",
]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public auth entry points without session check.
  if (
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith("/consentimento")
  ) {
    return NextResponse.next({ request: { headers: request.headers } });
  }

  const { user, response } = await updateSession(request);

  // Redirect unauthenticated users to /login (307 Temporary Redirect).
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static  (static assets)
     * - _next/image   (image optimisation)
     * - favicon.ico, sitemap.xml, robots.txt
     * - /api routes (own auth layer)
     */
    "/((?!api|_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt).*)",
  ],
};
