'use client';

/**
 * TodayPageContent — Conteúdo da página /hoje com badge de outbox e botão de sync.
 * Versão client-side que integra o hook useOutboxDrain.
 * Story 4.10: Adiciona feedback visual de respostas e estado "Tudo em dia"
 */

import { Calendar, CheckCircle2 } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { SessionCard } from '@/components/ui/session-card';
import { TodayOutboxBadge } from '@/components/domain/today-outbox-badge';
import type { Session } from '@/lib/schemas/sessions';

interface TodayPageContentProps {
  nextSession: Session | null;
  nextSessionAnswered?: boolean;
  recentSession?: Session | null;
  allDoneToday?: boolean;
  userRole: 'player' | 'coach' | 'analyst';
}

export function TodayPageContent({
  nextSession,
  nextSessionAnswered,
  recentSession,
  allDoneToday,
  userRole,
}: TodayPageContentProps) {
  return (
    <div className="px-4 py-6 sm:px-6 space-y-4">
      {/* Badge de sincronização offline */}
      <TodayOutboxBadge />

      {/* Caso 1: Há sessão próxima */}
      {nextSession ? (
        <>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Próxima sessão
          </h2>
          <SessionCard
            session={nextSession}
            userRole={userRole}
            phase="pre"
            answered={nextSessionAnswered}
          />
        </>
      ) : null}

      {/* Caso 2: Sessão recente com post por responder (Story 4.9) */}
      {recentSession && (
        <>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Sessão recente
          </h2>
          <SessionCard
            session={recentSession}
            userRole={userRole}
            phase="post"
          />
        </>
      )}

      {/* Caso 3: Tudo em dia — sessão recente com ambas as fases respondidas (AC #3, Story 4.10) */}
      {allDoneToday && !nextSession && (
        <EmptyState
          icon={<CheckCircle2 className="h-8 w-8 text-green-600" />}
          title="Tudo registado"
          description="Questionários desta sessão concluídos."
        />
      )}

      {/* Caso 4: Sem sessões em lado nenhum (existente) */}
      {!nextSession && !recentSession && !allDoneToday && (
        <EmptyState
          icon={<Calendar className="h-8 w-8 text-muted-foreground" />}
          title="Sem sessões nos próximos 7 dias"
          description="Não há sessões agendadas para os próximos 7 dias."
        />
      )}
    </div>
  );
}
