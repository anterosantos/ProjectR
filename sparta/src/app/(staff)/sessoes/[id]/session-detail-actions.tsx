"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardList, Users, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CancelSessionDialog } from "@/components/dialogs/cancel-session-dialog";

interface SessionDetailActionsProps {
  sessionId: string;
  sessionType: "training" | "match" | "friendly";
  isScheduled: boolean;
  isCoach: boolean;
}

export function SessionDetailActions({
  sessionId,
  sessionType,
  isScheduled,
  isCoach,
}: SessionDetailActionsProps) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const isMatchOrFriendly = sessionType === "match" || sessionType === "friendly";

  return (
    <>
      <div className="flex flex-col gap-3 pt-4">
        {/* Captura de eventos — staff (coach + analyst) para jogos agendados */}
        {isMatchOrFriendly && isScheduled && (
          <Button asChild variant="primary" className="w-full justify-start gap-2">
            <Link href={`/sessoes/${sessionId}/captura`}>
              <Video className="h-4 w-4" />
              Captura de eventos
            </Link>
          </Button>
        )}

        {/* Presenças — staff (coach + analyst), todos os tipos de sessão */}
        <Button asChild variant="ghost" className="w-full justify-start gap-2">
          <Link href={`/sessoes/${sessionId}/presencas`}>
            <ClipboardList className="h-4 w-4" />
            Presenças
          </Link>
        </Button>

        {/* Convocatória — coach apenas */}
        {isMatchOrFriendly && isCoach && (
          <Button asChild variant="ghost" className="w-full justify-start gap-2">
            <Link href={`/sessoes/${sessionId}/convocatoria`}>
              <Users className="h-4 w-4" />
              Convocatória
            </Link>
          </Button>
        )}

        {/* Editar e cancelar — coach apenas, sessão agendada */}
        {isCoach && isScheduled && (
          <div className="flex gap-2">
            <Button asChild variant="ghost" className="flex-1">
              <Link href={`/sessoes/${sessionId}/editar`}>Editar</Link>
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => setCancelOpen(true)}
            >
              Cancelar sessão
            </Button>
          </div>
        )}
      </div>

      <CancelSessionDialog
        sessionId={sessionId}
        open={cancelOpen}
        onOpenChange={setCancelOpen}
      />
    </>
  );
}
