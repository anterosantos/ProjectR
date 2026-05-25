/**
 * PositionGroup — Secção de posição com icon, header e lista de PlayerRows.
 *
 * AC #3: GR/DEF/MED/AVA agrupamentos com icons lucide-react
 * AC #5: Ordenação já feita no parent (alert→caution→ready→neutral, ACWR DESC)
 * AC #8: role="heading" aria-level="2" em cada secção
 */

import { Shield, ShieldAlert, Zap, Target } from "lucide-react";
import { PlayerRow } from "@/components/domain/readiness/player-row";
import type { PlayerReadinessData } from "@/types/supabase";

export type PositionKey = "GR" | "DEF" | "MED" | "AVA";

const POSITION_CONFIG: Record<
  PositionKey,
  { label: string; icon: React.ReactNode }
> = {
  GR: {
    label: "Guarda-Redes",
    icon: <Shield className="size-4" aria-hidden="true" />,
  },
  DEF: {
    label: "Defesa",
    icon: <ShieldAlert className="size-4" aria-hidden="true" />,
  },
  MED: {
    label: "Médio",
    icon: <Zap className="size-4" aria-hidden="true" />,
  },
  AVA: {
    label: "Avançado",
    icon: <Target className="size-4" aria-hidden="true" />,
  },
};

export interface PositionGroupProps {
  position: PositionKey;
  players: PlayerReadinessData[];
  onSelectPlayer?: (snapshot: PlayerReadinessData) => void;
}

export function PositionGroup({
  position,
  players,
  onSelectPlayer,
}: PositionGroupProps) {
  if (players.length === 0) return null;

  const config = POSITION_CONFIG[position];

  return (
    <section className="my-4" aria-labelledby={`pos-heading-${position}`}>
      {/* Position header — P-19: <h2> nativo em vez de <div role="heading"> (melhor suporte AT) */}
      <h2
        id={`pos-heading-${position}`}
        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-foreground"
      >
        {config.icon}
        <span>{config.label}</span>
        <span className="text-muted-foreground font-normal ml-1">
          ({players.length})
        </span>
      </h2>

      {/* Player rows */}
      <ul role="list" className="divide-y divide-border/40">
        {players.map((snapshot) => (
          <li key={snapshot.player_id} role="listitem">
            <PlayerRow
              snapshot={snapshot}
              position={config.label}
              onSelect={onSelectPlayer}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
