"use client";

import { useState } from "react";
import { Archive } from "lucide-react";
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
import { archivePlayer } from "@/lib/actions/players";

interface ArchivePlayerDialogProps {
  playerId: string;
  playerName: string;
}

export function ArchivePlayerDialog({ playerId, playerName }: ArchivePlayerDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleArchive() {
    setError(null);
    setIsPending(true);
    try {
      const result = await archivePlayer({ playerId });
      if (!result.ok) {
        setError(result.error.message);
        setIsPending(false);
      }
      // On success: archivePlayer redirects to /plantel
    } catch {
      setError("Erro inesperado. Tenta novamente.");
      setIsPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={`Arquivar ${playerName}`}
      >
        <Archive className="h-4 w-4" />
        Arquivar
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Arquivar jogador?</DialogTitle>
          <DialogDescription>
            <strong>{playerName}</strong> deixa de aparecer no plantel activo. Os dados
            históricos são preservados.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p className="text-sm text-signal-alert">{error}</p>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" disabled={isPending}>
              Cancelar
            </Button>
          </DialogClose>
          <Button variant="destructive" onClick={handleArchive} disabled={isPending}>
            {isPending ? "A arquivar..." : "Arquivar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
