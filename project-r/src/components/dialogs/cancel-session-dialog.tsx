"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CalmConfirmation } from "@/components/ui/calm-confirmation";
import { cancelSession } from "@/lib/actions/sessions";

interface CancelSessionDialogProps {
  sessionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CancelSessionDialog({
  sessionId,
  open,
  onOpenChange,
}: CancelSessionDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await cancelSession(sessionId);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      onOpenChange(false);
      setShowConfirmation(true);
    });
  }

  return (
    <>
      {showConfirmation && (
        <CalmConfirmation
          message="Sessão cancelada"
          onDismiss={() => router.push("/calendario")}
        />
      )}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar sessão</DialogTitle>
            <DialogDescription>
              Esta sessão vai ser cancelada. Já há respostas ou eventos
              associados?
            </DialogDescription>
          </DialogHeader>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Fechar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={isPending}
            >
              {isPending ? "A cancelar…" : "Cancelar sessão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
