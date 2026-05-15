import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

/** Browser/Client Component Supabase client. Do not use in Server Actions or middleware. */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}

export const supabase = createClient();

export async function isAuthenticated() {
  try {
    const {
      data: { session },
    } = await createClient().auth.getSession();
    return !!session;
  } catch {
    return false;
  }
}

export async function getSession() {
  try {
    const {
      data: { session },
    } = await createClient().auth.getSession();
    return session;
  } catch {
    return null;
  }
}

export async function updatePassword(newPassword: string) {
  const client = createClient();
  try {
    const response = await client.auth.updateUser({ password: newPassword });

    if (response.error) {
      return {
        success: false,
        error: {
          message: "Erro ao atualizar password",
          originalError: response.error,
        },
      };
    }

    // Invalidate all sessions (NFR18)
    const signOutResponse = await client.auth.signOut({ scope: "global" });

    if (signOutResponse.error) {
      return {
        success: false,
        error: {
          message:
            "Password atualizada, mas não foi possível invalidar as outras sessões. Tenta novamente.",
          originalError: signOutResponse.error,
        },
      };
    }

    return { success: true, error: null };
  } catch (err) {
    return {
      success: false,
      error: { message: "Erro ao atualizar password", originalError: err },
    };
  }
}

export async function requestPasswordRecovery(email: string) {
  const appUrl =
    (typeof window !== "undefined" ? window.location.origin : null) ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "";
  try {
    await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/reset-password`,
    });
    return { success: true, error: null };
  } catch (err) {
    console.error("Password recovery request error:", err);
    return { success: true, error: null };
  }
}

export async function logout() {
  const client = createClient();
  try {
    const response = await client.auth.signOut();
    return response;
  } catch (err) {
    console.error("Logout error:", err);
    throw err;
  }
}

export async function signInWithPassword(email: string, password: string) {
  try {
    const response = await createClient().auth.signInWithPassword({
      email,
      password,
    });

    if (response.error) {
      return {
        data: null,
        error: {
          message: "Email ou password incorretos",
          originalError: response.error,
        },
      };
    }

    return response;
  } catch (err) {
    return {
      data: null,
      error: {
        message: "Email ou password incorretos",
        originalError: err,
      },
    };
  }
}

export function getRoleHomePath(
  role: string | null | undefined
): "/prontidao" | "/sessoes" | "/hoje" | "/login" {
  switch (role) {
    case "coach":
      return "/prontidao";
    case "analyst":
      return "/sessoes";
    case "player":
      return "/hoje";
    default:
      return "/login";
  }
}

export async function getCurrentUserWithRole() {
  const client = createClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) return { user: null, role: null };

  const { data: profile, error } = await client
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    console.warn("Could not fetch profile role:", error?.message);
    return { user, role: null };
  }

  return { user, role: profile.role as string | null };
}

/** @deprecated Use createClient() directly */
export function getSupabaseClient() {
  return createClient();
}

export default createClient;
