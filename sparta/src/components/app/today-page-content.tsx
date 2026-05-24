'use client';

/**
 * TodayPageContent — Conteúdo da página /hoje com badge de outbox e botão de sync.
 * Versão client-side que integra o hook useOutboxDrain.
 */

import { Calendar } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { SessionCard } from '@/components/ui/session-card';
import { TodayOutboxBadge } from '@/components/domain/today-outbox-badge';
import type { Session } from '@/lib/schemas/sessions';

interface TodayPageContentProps {
  nextSession: Session | null;
  userRole: 'player' | 'coach' | 'analyst';
}

export function TodayPageContent({
  nextSession,
  userRole,
}: TodayPageContentProps) {
  return (
    <div className="px-4 py-6 sm:px-6 space-y-4">
      {/* Badge de sincronização offline (AC #3, #4) */}
      <TodayOutboxBadge />

      {nextSession ? (
        <>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Próxima sessão
          </h2>
          <SessionCard session={nextSession} userRole={userRole} />
        </>
      ) : (
        <EmptyState
          icon={<Calendar className="h-8 w-8 text-muted-foreground" />}
          title="Sem sessões nos próximos 7 dias"
          description="Não há sessões agendadas para os próximos 7 dias."
        />
      )}
    </div>
  );
}
