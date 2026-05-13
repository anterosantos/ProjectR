import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const PUBLIC_ROUTES = ["/login", "/recuperar-password", "/reset-password"];
const PROTECTED_ROUTE_PATTERNS = ["/prontidao", "/sessoes", "/hoje"];

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse;
  }

  let supabase;
  try {
    supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    });
  } catch (error) {
    // Isto vai aparecer nos Logs do Vercel!
    console.error("🔥 ERRO NO SUPABASE MIDDLEWARE 🔥:", error);
    console.error("URL recebido no Vercel:", supabaseUrl);
    console.error("Key existe?", !!supabaseKey);
    
    // Devolvemos a resposta normal para a página não dar erro 500
    return supabaseResponse; 
  }

  const pathname = request.nextUrl.pathname;

  if (PUBLIC_ROUTES.includes(pathname) || pathname === "/") {
    return supabaseResponse;
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

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};
