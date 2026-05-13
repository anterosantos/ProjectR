
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ROUTES = ["/login", "/recuperar-password", "/reset-password"];
const PROTECTED_ROUTE_PATTERNS = ["/prontidao", "/sessoes", "/hoje"];

export async function middleware(request: NextRequest) {
  try {
    let response = NextResponse.next();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },

          set(name: string, value: string, options) {
            response.cookies.set({
              name,
              value,
              ...options,
            });
          },

          remove(name: string, options) {
            response.cookies.set({
              name,
              value: "",
              ...options,
            });
          },
        },
      }
    );

    const pathname = request.nextUrl.pathname;

    if (PUBLIC_ROUTES.includes(pathname) || pathname === "/") {
      return response;
    }

    const isProtectedRoute = PROTECTED_ROUTE_PATTERNS.some((pattern) =>
      pathname.startsWith(pattern)
    );

    if (isProtectedRoute) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.redirect(new URL("/login", request.url));
      }
    }

    return response;
  } catch (error) {
    console.error("🔥 Middleware crash:", error);

    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};