import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Routes that don't require authentication
const PUBLIC_ROUTES = ["/login", "/recuperar-password", "/reset-password"];

// Routes that require authentication
const PROTECTED_ROUTE_PATTERNS = [
  "/prontidao", // Coach home
  "/sessoes", // Analyst home
  "/hoje", // Player home
];

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    // If Supabase is not configured, allow the request
    return NextResponse.next();
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const pathname = request.nextUrl.pathname;

  // Check if route is public
  if (PUBLIC_ROUTES.includes(pathname) || pathname === "/") {
    return NextResponse.next();
  }

  // Check if route requires authentication
  const isProtectedRoute = PROTECTED_ROUTE_PATTERNS.some((pattern) =>
    pathname.startsWith(pattern)
  );

  if (isProtectedRoute) {
    // Try to get session from cookie
    const session = request.cookies.get("sb-auth-token");

    if (!session) {
      // No session found, redirect to login
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // Continue to the route
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
