"use server";

import { createServerClient } from "@/lib/supabase/server";

/**
 * Server Action: Get current user and their role from profile
 * Uses server-side client that ignores RLS policies
 * Called after login to determine redirect destination
 */
export async function getCurrentUserRole() {
  try {
    const supabase = await createServerClient();

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return { user: null, role: null, error: "Not authenticated" };
    }

    // Fetch user's role from profile using server client (bypasses RLS)
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.warn("Could not fetch profile:", profileError?.message);
      return { user, role: null, error: "Profile not found" };
    }

    return { user, role: profile.role as string, error: null };
  } catch (err) {
    console.error("Error in getCurrentUserRole:", err);
    return { user: null, role: null, error: "Server error" };
  }
}
