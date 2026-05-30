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
          {/* Fundo verde */}
          <rect width="300" height="400" fill="#2d6a2d" rx="4" />

          {/* Limite exterior do campo */}
          <rect x="15" y="10" width="270" height="380" stroke="white" strokeWidth="2" fill="none" strokeOpacity="0.9" />

          {/* Linha de meio-campo */}
          <line x1="15" y1="200" x2="285" y2="200" stroke="white" strokeWidth="1.5" strokeOpacity="0.9" />

          {/* Círculo central (r≈33px ≙ 9.15m) */}
          <circle cx="150" cy="200" r="33" stroke="white" strokeWidth="1.5" fill="none" strokeOpacity="0.9" />
          {/* Ponto central */}
          <circle cx="150" cy="200" r="2" fill="white" fillOpacity="0.9" />

          {/* Área de penálti superior (16.5m ≈ 60px, 40.32m ≈ 161px) */}
          <rect x="70" y="10" width="160" height="60" stroke="white" strokeWidth="1.5" fill="none" strokeOpacity="0.9" />
          {/* Área de baliza superior (5.5m ≈ 20px, 18.32m ≈ 73px) */}
          <rect x="114" y="10" width="72" height="20" stroke="white" strokeWidth="1.5" fill="none" strokeOpacity="0.9" />
          {/* Baliza superior (7.32m ≈ 29px) */}
          <rect x="136" y="1" width="28" height="9" stroke="white" strokeWidth="1.5" fill="rgba(0,0,0,0.25)" strokeOpacity="0.9" />
          {/* Ponto de penálti superior (11m ≈ 40px) */}
          <circle cx="150" cy="50" r="2" fill="white" fillOpacity="0.9" />
          {/* Arco de penálti superior — curva para fora da área (para o centro do campo) */}
          <path d="M 124 70 A 33 33 0 0 0 176 70" stroke="white" strokeWidth="1.5" fill="none" strokeOpacity="0.9" />

          {/* Área de penálti inferior */}
          <rect x="70" y="330" width="160" height="60" stroke="white" strokeWidth="1.5" fill="none" strokeOpacity="0.9" />
          {/* Área de baliza inferior */}
          <rect x="114" y="370" width="72" height="20" stroke="white" strokeWidth="1.5" fill="none" strokeOpacity="0.9" />
          {/* Baliza inferior */}
          <rect x="136" y="390" width="28" height="9" stroke="white" strokeWidth="1.5" fill="rgba(0,0,0,0.25)" strokeOpacity="0.9" />
          {/* Ponto de penálti inferior */}
          <circle cx="150" cy="350" r="2" fill="white" fillOpacity="0.9" />
          {/* Arco de penálti inferior — curva para fora da área (para o centro do campo) */}
          <path d="M 124 330 A 33 33 0 0 1 176 330" stroke="white" strokeWidth="1.5" fill="none" strokeOpacity="0.9" />

          {/* Arcos de canto */}
          <path d="M 23 10 A 8 8 0 0 1 15 18" stroke="white" strokeWidth="1.5" fill="none" strokeOpacity="0.9" />
          <path d="M 277 10 A 8 8 0 0 0 285 18" stroke="white" strokeWidth="1.5" fill="none" strokeOpacity="0.9" />
          <path d="M 15 382 A 8 8 0 0 0 23 390" stroke="white" strokeWidth="1.5" fill="none" strokeOpacity="0.9" />
          <path d="M 285 382 A 8 8 0 0 1 277 390" stroke="white" strokeWidth="1.5" fill="none" strokeOpacity="0.9" />
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
