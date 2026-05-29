"use server";

import { createServerClient } from "@/lib/supabase/server";
import { ok, err } from "@/lib/types";
import type { Result, AppError } from "@/lib/types";

/**
 * Server Action: Get current user and their role from profile
 * Uses server-side client that ignores RLS policies
 * Called after login to determine redirect destination
 */
export async function getCurrentUserRole() {
  try {
    console.log("[Auth] Starting getCurrentUserRole");

    const supabase = await createServerClient();
    console.log("[Auth] Server client created");

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log("[Auth] getUser result:", { userId: user?.id, userError: userError?.message });

    if (userError || !user) {
      console.log("[Auth] User not found or error");
      return { user: null, role: null, error: "Not authenticated" };
    }

    // Fetch user's role from profile using server client (bypasses RLS)
    console.log("[Auth] Fetching profile for user:", user.id);
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    console.log("[Auth] Profile fetch result:", { role: profile?.role, error: profileError?.message });

    if (profileError || !profile) {
      console.warn("[Auth] Could not fetch profile:", profileError?.message);
      return { user, role: null, error: "Profile not found" };
    }

    console.log("[Auth] Success - returning role:", profile.role);
    return { user, role: profile.role as string, error: null };
  } catch (err) {
    console.error("[Auth] Error in getCurrentUserRole:", err);
    return { user: null, role: null, error: "Server error" };
  }
}

/**
 * Server Action: Require staff role (coach or analyst) for protected routes
 * Returns user info and club ID if authorized
 */
export async function requireStaffRole(): Promise<
  Result<{ userId: string; clubId: string; role: string }, AppError>
> {
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return err({ code: "unauthorized", message: "Autenticação necessária." });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, club_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return err({ code: "unauthorized", message: "Perfil não encontrado." });
  }

  if (profile.role !== "coach" && profile.role !== "analyst") {
    return err({ code: "forbidden", message: "Acesso restrito a staff." });
  }

  if (!profile.club_id) {
    return err({ code: "forbidden", message: "Clube não atribuído." });
  }

  return ok({
    userId: user.id,
    clubId: profile.club_id,
    role: profile.role as string,
  });
}
