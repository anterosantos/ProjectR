"use client";

import { logout } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useOutboxStatus } from "@/lib/outbox/status";

export function LogoutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const { pendingCount } = useOutboxStatus();

  const performLogout = async () => {
    setIsLoading(true);
    try {
      await logout();
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      router.push("/login");
    }
  };

  const handleLogoutRequest = () => {
    if (pendingCount > 0) {
      setShowDialog(true);
    } else {
      void performLogout();
    }
  };

  return (
    <>
      <Button onClick={handleLogoutRequest} disabled={isLoading} variant="ghost">
        {isLoading ? "A sair..." : "Sair"}
      </Button>
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Tens {pendingCount} submissões por enviar. Sair sem sincronizar?
            </DialogTitle>
            <DialogDescription>
              Os teus dados offline ainda não foram enviados. Se saíres agora, podem perder-se.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDialog(false)} disabled={isLoading}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowDialog(false);
                void performLogout();
              }}
              disabled={isLoading}
            >
              {isLoading ? "A sair..." : "Sair mesmo assim"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
