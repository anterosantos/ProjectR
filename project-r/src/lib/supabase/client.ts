/**
 * Supabase client helpers for authentication and role-based routing
 * Handles JWT interaction and role-based home page redirects
 */

import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client (lazy initialization to support testing)
let supabaseClient: ReturnType<typeof createClient> | null = null;

function getSupabaseInstance() {
  if (!supabaseClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        "Missing Supabase credentials in .env.local (NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)"
      );
    }

    supabaseClient = createClient(supabaseUrl, supabaseKey);
  }
  return supabaseClient;
}

/**
 * Check if user has an active session
 */
export async function isAuthenticated() {
  const supabase = getSupabaseInstance();
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return !!session;
  } catch (err) {
    return false;
  }
}

/**
 * Get current session
 */
export async function getSession() {
  const supabase = getSupabaseInstance();
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session;
  } catch (err) {
    return null;
  }
}

/**
 * Update user password and invalidate existing sessions
 */
export async function updatePassword(newPassword: string) {
  const supabase = getSupabaseInstance();
  try {
    const response = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (response.error) {
      return {
        success: false,
        error: {
          message: "Erro ao atualizar password",
          originalError: response.error,
        },
      };
    }

    // Sign out all other sessions by signing out the current session
    // This ensures NFR18 is satisfied (all existing sessions invalidated)
    await supabase.auth.signOut({ scope: "global" });

    return {
      success: true,
      error: null,
    };
  } catch (err) {
    return {
      success: false,
      error: {
        message: "Erro ao atualizar password",
        originalError: err,
      },
    };
  }
}

/**
 * Request password recovery email
 * Returns generic success to avoid account enumeration
 */
export async function requestPasswordRecovery(email: string) {
  const supabase = getSupabaseInstance();
  try {
    // Supabase will send recovery email if account exists
    // We always return success to avoid enumeration attacks
    const response = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || ""}/reset-password`,
    });

    return {
      success: true,
      error: null,
    };
  } catch (err) {
    // Even on error, return success message to avoid enumeration
    console.error("Password recovery request error:", err);
    return {
      success: true,
      error: null,
    };
  }
}

/**
 * Sign out the current user
 * Revokes session tokens and clears local state
 */
export async function logout() {
  const supabase = getSupabaseInstance();
  try {
    const response = await supabase.auth.signOut();
    return response;
  } catch (err) {
    console.error("Logout error:", err);
    throw err;
  }
}

/**
 * Sign in with email and password
 * Returns generic error message to avoid account enumeration
 */
export async function signInWithPassword(email: string, password: string) {
  const supabase = getSupabaseInstance();
  try {
    const response = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    // Check for any auth errors
    if (response.error) {
      // Return generic message to avoid account enumeration
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

/**
 * Map role to home page route
 */
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

/**
 * Get current user and their profile role
 */
export async function getCurrentUserWithRole() {
  const supabase = getSupabaseInstance();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, role: null };
  }

  // Extract role from JWT claims (set by auth-hook in Story 1.4)
  const role =
    user.user_metadata?.role ||
    user.app_metadata?.role ||
    user.user_metadata?.["role"];

  return { user, role };
}

/**
 * Get the Supabase client instance
 */
export function getSupabaseClient() {
  return getSupabaseInstance();
}

export default getSupabaseInstance;
