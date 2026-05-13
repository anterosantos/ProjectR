import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const PUBLIC_ROUTES = ["/login", "/recuperar-password", "/reset-password"];
const PROTECTED_ROUTE_PATTERNS = ["/prontidao", "/sessoes", "/hoje"];

export async function middleware(request: NextRequest) {
  // Envolvemos TUDO num try...catch
  try {
    let supabaseResponse = NextResponse.next({ request });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    // Log para confirmar que as variáveis estão a ser lidas
    console.log("Middleware a iniciar. URL existe?", !!supabaseUrl, "Key existe?", !!supabaseKey);

    if (!supabaseUrl || !supabaseKey) {
      return supabaseResponse;
    }

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
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

    const pathname = request.nextUrl.pathname;

    if (PUBLIC_ROUTES.includes(pathname) || pathname === "/") {
      return supabaseResponse;
    }

    const isProtectedRoute = PROTECTED_ROUTE_PATTERNS.some((pattern) =>
      pathname.startsWith(pattern)
    );

    if (isProtectedRoute) {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Se não houver utilizador e for rota protegida, redirecionar para login
      if (!user) {
        return NextResponse.redirect(new URL("/login", request.url));
      }
    }

    return supabaseResponse;

  } catch (error) {
    // Agora NADA escapa deste log
    console.error("🔥 ERRO FATAL NO MIDDLEWARE 🔥:", error);
    
    // Devolvemos um NextResponse.next() para a página não dar erro 500
    // (Pode não estar logado, mas a página vai carregar em vez de crashar o Vercel)
    return NextResponse.next({ request });
  }
}

// Garante que o middleware não corre em ficheiros estáticos (imagens, css, etc)
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};