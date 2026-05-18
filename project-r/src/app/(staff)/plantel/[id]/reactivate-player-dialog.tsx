"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { reactivatePlayer } from "@/lib/actions/players";

interface ReactivatePlayerDialogProps {
  playerId: string;
  playerName: string;
}

export function ReactivatePlayerDialog({ playerId, playerName }: ReactivatePlayerDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReactivate() {
    setError(null);
    setIsPending(true);
    try {
      const result = await reactivatePlayer({ playerId });
      if (!result.ok) {
        setError(result.error.message);
        setIsPending(false);
      }
      // On success: reactivatePlayer calls redirect(`/plantel/${playerId}?reativado=1`)
    } catch {
      setError("Erro inesperado. Tenta novamente.");
      setIsPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Reactivar
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reactivar jogador?</DialogTitle>
          <DialogDescription>
            <strong>{playerName}</strong> volta a aparecer no plantel activo.
          </DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-signal-alert">{error}</p>}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" disabled={isPending}>Cancelar</Button>
          </DialogClose>
          <Button onClick={handleReactivate} disabled={isPending}>
            {isPending ? "A reactivar…" : "Reactivar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
