"use server";

import { createServerClient } from "@/lib/supabase/server";

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
