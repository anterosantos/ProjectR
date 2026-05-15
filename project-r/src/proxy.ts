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

  // Growth phase (Story 1.7 AC #6): enforce mandatory MFA enrollment here.
  // When MFA_REQUIRED_ROLES env var is set (e.g. "coach,analyst"), check the
  // JWT AAL claim. If aal !== "aal2" and the user's role is in the list,
  // redirect to /configuracoes/seguranca for enrollment.
  // MVP: enforcement is not active. Implement in Edge Function or here in Growth phase.

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
