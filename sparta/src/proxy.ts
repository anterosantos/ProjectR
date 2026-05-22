import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { ageInYears } from "@/lib/utils/age";

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
  player: ["/hoje", "/historico", "/configuracoes", "/aguardar-consentimento"],
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

  const { user, response, claims, supabase } = await updateSession(request);

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

  // Consent gate para jogadores sub-14/15 (Story 3.2) — precede ROLE_ALLOWED_ROUTES
  if (userRole === "player" && user) {
    const typedUser = user as { id: string };
    const { data: profileData } = await supabase
      .from("profiles")
      .select("consent_status")
      .eq("id", typedUser.id)
      .single();

    // Block access unless consent is granted. 'not_required' (default) also blocks minors
    // because consent may not have been requested yet. NULL edge case also blocks (safe default).
    // Note: profiles.consent_status uses 'granted' (not 'confirmed') — see migration 000170.
    if (profileData?.consent_status !== "granted") {
      const { data: playerData } = await supabase
        .from("players")
        .select("birthdate")
        .eq("profile_id", typedUser.id)
        .maybeSingle();

      const birthdate = playerData?.birthdate ?? null;
      const isNowAdult = birthdate !== null && ageInYears(birthdate) >= 16;

      if (!isNowAdult) {
        // Allow access to /aguardar-consentimento and child routes (e.g. /aguardar-consentimento/resend)
        if (!pathname.startsWith("/aguardar-consentimento")) {
          return NextResponse.redirect(
            new URL("/aguardar-consentimento", request.url)
          );
        }
        return response;
      }
    }
  }

  // If userRole is available from JWT claims, validate access
  if (userRole && userRole in ROLE_ALLOWED_ROUTES) {
    const allowedRoutes = ROLE_ALLOWED_ROUTES[userRole as keyof typeof ROLE_ALLOWED_ROUTES];
    const hasAccess = allowedRoutes?.some((route) =>
      pathname === route || pathname.startsWith(route + "/")
    ) ?? false;

    if (!hasAccess) {
      const defaultRoute = ROLE_DEFAULT_ROUTES[userRole as keyof typeof ROLE_DEFAULT_ROUTES] || "/login";
      return NextResponse.redirect(new URL(defaultRoute, request.url));
    }
  }
  // If no userRole in JWT claims, allow page to load - RLS policies will enforce access control
  // Pages will fetch role from /api/auth/user-role endpoint if needed

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
     * - favicon.ico, sitemap.xml, robots.txt, sw.js
     * - /api routes (own auth layer)
     */
    "/((?!api|_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|sw\\.js).*)",
  ],
};
