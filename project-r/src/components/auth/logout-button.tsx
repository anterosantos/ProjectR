"use client";

import { logout } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await logout();
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      // Always redirect to login, even if signOut threw (AC #3)
      router.push("/login");
    }
  };

  return (
    <Button onClick={handleLogout} disabled={isLoading} variant="ghost">
      {isLoading ? "A sair..." : "Sair"}
    </Button>
  );
}
