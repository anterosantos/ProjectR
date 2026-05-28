"use client";

import { useState, useEffect, startTransition } from "react";
import { Users } from "lucide-react";
import { FieldFormation } from "@/components/domain/readiness/field-formation";
import { PlayerDrillDownSheet } from "@/components/domain/readiness/player-drill-down-sheet";
import { SemaforoBadge } from "@/components/ui/semaforo-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { getFormationData } from "@/lib/actions/readiness";
import { logger } from "@/lib/logger";
import type { PlayerReadinessData } from "@/types/supabase";
import type { FormationResult } from "@/lib/actions/readiness";

const STATE_LABELS: Record<string, string> = {
  ready:   'Pronto',
  caution: 'Cuidado',
  alert:   'Alerta',
  neutral: 'Sem dados',
};

export interface ReadinessPanelFormationProps {
  players: PlayerReadinessData[];
  sessionId: string;
  flashedIds?: Set<string>;
}

type LoadStatus = 'loading' | 'loaded' | 'error';

function isValidState(state: unknown): state is keyof typeof STATE_LABELS {
  return typeof state === 'string' && state in STATE_LABELS;
}

export function ReadinessPanelFormation({ players, sessionId, flashedIds }: ReadinessPanelFormationProps) {
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [formationData, setFormationData] = useState<FormationResult | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerReadinessData | null>(null);

  useEffect(() => {
    // startTransition: padrão do codebase para setState em useEffect (P-12)
    let isMounted = true;

    startTransition(() => {
      setStatus('loading');
      setFormationData(null);
    });

    getFormationData(sessionId)
      .then((result) => {
        if (!isMounted) return;
        startTransition(() => {
          if (result.ok) {
            setFormationData(result.data);
            setStatus('loaded');
          } else {
            logger.error('readiness.formation.load_failed', { session_id: sessionId, error: result.error.message });
            setStatus('error');
          }
        });
      })
      .catch((e: unknown) => {
        if (!isMounted) return;
        logger.error('readiness.formation.unexpected_error', {
          session_id: sessionId,
          error: e instanceof Error ? e.message : String(e),
        });
        startTransition(() => { setStatus('error'); });
      });

    return () => {
      isMounted = false;
    };
  }, [sessionId]);

  if (status === 'loading') {
    return (
      <div
        data-testid="readiness-panel-formation"
        className="flex flex-col gap-4 px-4 py-6 animate-pulse"
        aria-busy="true"
        aria-label="A carregar formação"
      >
        <div className="h-6 bg-muted rounded w-32 mx-auto" />
        <div className="w-full bg-muted rounded" style={{ paddingBottom: '133%' }} />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div data-testid="readiness-panel-formation" className="px-4 py-8">
        <EmptyState
          icon={<Users className="h-8 w-8 text-muted-foreground" aria-hidden="true" />}
          title="Erro ao carregar convocatória"
          description="Ocorreu um erro ao carregar a convocatória. Tenta novamente."
        />
      </div>
    );
  }

  if (!formationData || formationData.source === 'none') {
    return (
      <div data-testid="readiness-panel-formation" className="px-4 py-8">
        <EmptyState
          icon={<Users className="h-8 w-8 text-muted-foreground" aria-hidden="true" />}
          title="Sem convocatória definida"
          description="Define a convocatória no Calendário para ver a formação."
        />
      </div>
    );
  }

  // Merge lineup entries with players array
  const starters = formationData.lineups
    .filter((l) => l.role === 'starter')
    .map((l) => players.find((p) => p.player_id === l.player_id))
    .filter((p): p is PlayerReadinessData => p !== undefined);

  const bench = formationData.lineups
    .filter((l) => l.role === 'bench')
    .map((l) => players.find((p) => p.player_id === l.player_id))
    .filter((p): p is PlayerReadinessData => p !== undefined);

  // Guard: if all starters are missing from players array (data sync lag), show error
  const expectedStarters = formationData.lineups.filter((l) => l.role === 'starter').length;
  if (expectedStarters > 0 && starters.length === 0) {
    return (
      <div data-testid="readiness-panel-formation" className="px-4 py-8">
        <EmptyState
          icon={<Users className="h-8 w-8 text-muted-foreground" aria-hidden="true" />}
          title="Dados de jogadores indisponíveis"
          description="Aguarde o carregamento dos dados do elenco."
        />
      </div>
    );
  }

  return (
    <div data-testid="readiness-panel-formation" className="flex flex-col pb-6">
      <div className="px-4 pt-4">
        <FieldFormation starters={starters} onSelectPlayer={setSelectedPlayer} flashedIds={flashedIds} />
      </div>

      {bench.length > 0 && (
        <div className="mt-4 px-4">
          <p className="text-xs text-muted-foreground font-medium mb-2 uppercase tracking-wide">
            Banco ({bench.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {bench.map((player) => {
              const stateLabel = isValidState(player.state) ? STATE_LABELS[player.state] : 'Sem dados';
              const acwrLabel = player.acwr != null
                ? player.acwr.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : 'indisponível';

              const isFlashed = flashedIds?.has(player.player_id) ?? false;
              return (
                <button
                  key={player.player_id}
                  type="button"
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border bg-card hover:bg-accent transition-colors${
                    isFlashed
                      ? " motion-safe:bg-primary/10 motion-safe:transition-colors motion-safe:duration-200 motion-safe:ease-out"
                      : ""
                  }`}
                  data-flashed={isFlashed ? "true" : undefined}
                  onClick={() => setSelectedPlayer(player)}
                  aria-label={`Estado: ${stateLabel}, ${player.playerName}, ${player.primaryPosition ?? 'posição desconhecida'}, ACWR ${acwrLabel}`}
                >
                  <SemaforoBadge state={player.state as 'ready' | 'caution' | 'alert' | 'neutral'} size="sm" />
                  <span className="text-xs">{player.playerName.split(' ')[0] ?? player.playerName}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <PlayerDrillDownSheet
        snapshot={selectedPlayer}
        open={selectedPlayer !== null}
        onClose={() => setSelectedPlayer(null)}
      />
    </div>
  );
}
