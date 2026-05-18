import { createServerClient as createSSRServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

/** Server Component / Server Action Supabase client. Do not use in browser code. */
export async function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      `Supabase environment variables missing. Check CI secrets: NEXT_PUBLIC_SUPABASE_URL=${supabaseUrl ? '✓' : '✗'}, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${supabaseKey ? '✓' : '✗'}`
    );
  }

  const cookieStore = await cookies();

  return createSSRServerClient<Database>(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component where cookies cannot be set.
            // Session refresh is handled by the proxy instead.
          }
        },
      },
    }
  );
}
