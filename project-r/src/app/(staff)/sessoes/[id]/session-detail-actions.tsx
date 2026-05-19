"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CancelSessionDialog } from "@/components/dialogs/cancel-session-dialog";

interface SessionDetailActionsProps {
  sessionId: string;
  isScheduled: boolean;
}

export function SessionDetailActions({
  sessionId,
  isScheduled,
}: SessionDetailActionsProps) {
  const [cancelOpen, setCancelOpen] = useState(false);

  if (!isScheduled) return null;

  return (
    <>
      <div className="flex gap-2 pt-4">
        <Button asChild variant="ghost">
          <Link href={`/sessoes/${sessionId}/editar`}>Editar</Link>
        </Button>
        <Button variant="destructive" onClick={() => setCancelOpen(true)}>
          Cancelar sessão
        </Button>
      </div>

      <CancelSessionDialog
        sessionId={sessionId}
        open={cancelOpen}
        onOpenChange={setCancelOpen}
      />
    </>
  );
}
