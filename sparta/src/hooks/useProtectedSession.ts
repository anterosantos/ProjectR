"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";

/**
 * Hook to manage session state and handle token refresh.
 * Redirects to login if session expires or is invalid.
 * Respects 1-hour token expiry (NFR17).
 */
export function useProtectedSession() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);

  useEffect(() => {
    const supabase = getSupabaseClient();

    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        setIsLoading(false);
        return;
      }

      setIsAuthenticated(true);

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, currentSession) => {
        if (event === "SIGNED_OUT" || !currentSession) {
          router.push("/login");
        }
        if (event === "TOKEN_REFRESHED") {
          setIsAuthenticated(true);
        }
        if (event === "USER_UPDATED") {
          setIsAuthenticated(true);
        }
      });

      subscriptionRef.current = subscription;
      setIsLoading(false);
    };

    init();

    return () => {
      subscriptionRef.current?.unsubscribe();
    };
  }, [router]);

  return { isLoading, isAuthenticated };
}
