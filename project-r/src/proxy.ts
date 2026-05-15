import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PUBLIC_PATHS = new Set([
  "/login",
  "/recuperar-password",
  "/reset-password",
]);

const ROLE_DEFAULT_ROUTES: Record<string, string> = {
  player: "/hoje",
  coach: "/prontidao",
  analyst: "/sessoes",
};

const ROLE_ALLOWED_ROUTES: Record<string, string[]> = {
  player: ["/hoje", "/historico", "/configuracoes"],
  coach: ["/prontidao", "/calendario", "/plantel", "/configuracoes"],
  analyst: ["/sessoes", "/plantel", "/tendencias", "/configuracoes"],
};

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Allow public auth entry points without session check.
  if (
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith("/consentimento")
  ) {
    return NextResponse.next({ request: { headers: request.headers } });
  }

  const { user, response, claims } = await updateSession(request);

  // Redirect unauthenticated users to /login (307 Temporary Redirect).
  if (!user) {
    // Only allow relative URLs in returnTo to prevent open redirects
    const returnToPath = pathname.startsWith("/") ? pathname : "/";
    const returnToQuery = searchParams.toString();
    const returnTo = encodeURIComponent(returnToPath + (returnToQuery ? `?${returnToQuery}` : ""));
    return NextResponse.redirect(
      new URL(`/login?returnTo=${returnTo}`, request.url)
    );
  }

  // Get user role from JWT custom claims injected by the auth hook (Story 1.4/1.9).
  // The auth hook adds user_role as a top-level JWT claim; it is not in user_metadata.
  const userRole = (claims.user_role || claims.role) as string | undefined;

  // Validate userRole is one of the allowed roles
  if (!userRole || !(userRole in ROLE_ALLOWED_ROUTES)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const allowedRoutes = ROLE_ALLOWED_ROUTES[userRole as keyof typeof ROLE_ALLOWED_ROUTES];
  const hasAccess = allowedRoutes?.some((route) =>
    pathname === route || pathname.startsWith(route + "/")
  ) ?? false;

  if (!hasAccess) {
    const defaultRoute = ROLE_DEFAULT_ROUTES[userRole as keyof typeof ROLE_DEFAULT_ROUTES] || "/login";
    return NextResponse.redirect(new URL(defaultRoute, request.url));
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
