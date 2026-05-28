"use client";

import { getPositionKey } from "@/components/domain/readiness/readiness-panel-list";
import type { PlayerReadinessData } from "@/types/supabase";

export interface FieldFormationProps {
  starters: PlayerReadinessData[];
  onSelectPlayer: (p: PlayerReadinessData) => void;
  flashedIds?: Set<string>;
}

const STATE_COLORS: Record<string, string> = {
  ready:   '#22c55e',
  caution: '#eab308',
  alert:   '#ef4444',
  neutral: '#6b7280',
};

const STATE_LABELS: Record<string, string> = {
  ready:   'Pronto',
  caution: 'Cuidado',
  alert:   'Alerta',
  neutral: 'Sem dados',
};

function isValidState(state: unknown): state is keyof typeof STATE_COLORS {
  return typeof state === 'string' && state in STATE_COLORS;
}

// 4-3-3 position layout: top% and left% per slot in each line
const FORMATION_ROWS: { key: 'AVA' | 'MED' | 'DEF' | 'GR'; topPct: number }[] = [
  { key: 'AVA', topPct: 8  },
  { key: 'MED', topPct: 33 },
  { key: 'DEF', topPct: 60 },
  { key: 'GR',  topPct: 84 },
];

function distributePositions(count: number): number[] {
  if (count === 0) return [];
  const positions: number[] = [];
  for (let i = 0; i < count; i++) {
    positions.push(((i + 1) / (count + 1)) * 100);
  }
  return positions;
}

export function FieldFormation({ starters, onSelectPlayer, flashedIds }: FieldFormationProps) {
  const byPosition: Record<'GR' | 'DEF' | 'MED' | 'AVA', PlayerReadinessData[]> = {
    GR:  starters.filter(p => getPositionKey(p.primaryPosition) === 'GR'),
    DEF: starters.filter(p => getPositionKey(p.primaryPosition) === 'DEF'),
    MED: starters.filter(p => getPositionKey(p.primaryPosition) === 'MED'),
    AVA: starters.filter(p => getPositionKey(p.primaryPosition) === 'AVA'),
  };

  return (
    <div className="w-full">
      {/* Formation selector — only 4-3-3 active in MVP (AC #7) */}
      <div className="flex items-center justify-center mb-2">
        <button
          type="button"
          className="text-xs font-medium px-2.5 py-1 rounded border bg-primary text-primary-foreground cursor-default"
          disabled={false}
          aria-label="Formação 4-3-3 seleccionada"
        >
          4-3-3 ▾
        </button>
        {(["4-4-2", "3-5-2"] as const).map((scheme) => (
          <button
            key={scheme}
            type="button"
            disabled
            title="Em breve"
            className="ml-1 text-xs font-medium px-2.5 py-1 rounded border text-muted-foreground opacity-50 cursor-not-allowed"
            aria-label={`Formação ${scheme} — em breve`}
          >
            {scheme}
          </button>
        ))}
      </div>

      {/* SVG field + positioned player chips */}
      <div
        className="relative w-full"
        style={{ paddingBottom: '133%' }}
      >
        <svg
          viewBox="0 0 300 400"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="Campo de futebol — formação 4-3-3"
          className="absolute inset-0 w-full h-full"
        >
          <rect width="300" height="400" fill="#2d6a2d" rx="4" />
          <line x1="10" y1="200" x2="290" y2="200" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
          <circle cx="150" cy="200" r="40" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" fill="none" />
          <rect x="60" y="10" width="180" height="80" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" fill="none" />
          <rect x="60" y="310" width="180" height="80" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" fill="none" />
        </svg>

        {FORMATION_ROWS.map(({ key, topPct }) => {
          const rowPlayers = byPosition[key];
          const leftPositions = distributePositions(rowPlayers.length);
          return rowPlayers.map((player, idx) => {
            const leftPct = leftPositions[idx] ?? 50;
            const stateColor = isValidState(player.state) ? STATE_COLORS[player.state] : STATE_COLORS['neutral'];
            const stateLabel = isValidState(player.state) ? STATE_LABELS[player.state] : 'Sem dados';
            const firstName = (player.playerName?.trim() || 'Jogador').split(' ')[0] ?? 'Jogador';
            const acwrLabel = player.acwr != null
              ? player.acwr.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              : 'indisponível';
            const isFlashed = flashedIds?.has(player.player_id) ?? false;

            return (
              <button
                key={player.player_id}
                type="button"
                className={`absolute flex flex-col items-center gap-0.5 -translate-x-1/2 -translate-y-1/2 touch-manipulation${
                  isFlashed
                    ? " motion-safe:ring-2 motion-safe:ring-primary motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out"
                    : ""
                }`}
                data-flashed={isFlashed ? "true" : undefined}
                style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                onClick={() => onSelectPlayer(player)}
                aria-label={`Estado: ${stateLabel}, ${player.playerName}, ${player.primaryPosition ?? 'posição desconhecida'}, ACWR ${acwrLabel}`}
              >
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-white shadow-md"
                  style={{ backgroundColor: stateColor }}
                >
                  {player.jerseyNum != null ? player.jerseyNum : '?'}
                </div>
                <span className="text-white text-[10px] font-medium drop-shadow-sm max-w-[52px] truncate">
                  {firstName}
                </span>
              </button>
            );
          });
        })}
      </div>
    </div>
  );
}
