"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient, logout } from "@/lib/supabase/client";

/**
 * Hook to manage session state and handle token refresh
 * Redirects to login if session expires or is invalid
 * Respects 1-hour token expiry (NFR17)
 */
export function useProtectedSession() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAndRefreshSession = async () => {
      const supabase = getSupabaseClient();

      // Get current session
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        // No session, redirect to login
        router.push("/login");
        setIsLoading(false);
        return;
      }

      setIsAuthenticated(true);

      // Set up auth state listener for token refresh
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
        if (event === "SIGNED_OUT" || !currentSession) {
          router.push("/login");
        }

        if (event === "TOKEN_REFRESHED") {
          // Token was refreshed successfully
          setIsAuthenticated(true);
        }

        if (event === "USER_UPDATED") {
          // User was updated (e.g., password changed)
          setIsAuthenticated(true);
        }
      });

      setIsLoading(false);

      // Cleanup subscription on unmount
      return () => {
        subscription?.unsubscribe();
      };
    };

    checkAndRefreshSession();
  }, [router]);

  return { isLoading, isAuthenticated };
}
