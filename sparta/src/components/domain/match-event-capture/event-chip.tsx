"use client";

import { useState } from "react";
import {
  XCircle,
  RefreshCw,
  Target,
  Crosshair,
  ArrowRight,
  Shield,
  ShieldCheck,
  Zap,
} from "lucide-react";
import type { RecentEventEntry, MatchAction } from "@/lib/stores/match-session";
import type { MATCH_ZONES } from "@/lib/schemas/match-events";

const ACTION_ICON: Record<MatchAction, React.ElementType> = {
  ball_loss: XCircle,
  ball_recovery: RefreshCw,
  shot_total: Target,
  shot_on_target: Crosshair,
  pass_completed: ArrowRight,
  def_pressure: Shield,
  def_action_success: ShieldCheck,
  off_action_success: Zap,
};

const ACTION_LABEL: Record<MatchAction, string> = {
  ball_loss: "Perda de bola",
  ball_recovery: "Recuperação de bola",
  shot_total: "Remate",
  shot_on_target: "Remate à baliza",
  pass_completed: "Passe completado",
  def_pressure: "Pressão defensiva",
  def_action_success: "Ação defensiva",
  off_action_success: "Ação ofensiva",
};

const ZONE_ABBR: Record<(typeof MATCH_ZONES)[number], string> = {
  def_left: "DE",
  def_center: "DC",
  def_right: "DD",
  mid_left: "ME",
  mid_center: "MC",
  mid_right: "MD",
  att_left: "AE",
  att_center: "AC",
  att_right: "AD",
};

const ZONE_LABEL: Record<(typeof MATCH_ZONES)[number], string> = {
  def_left: "Defesa esquerda",
  def_center: "Defesa centro",
  def_right: "Defesa direita",
  mid_left: "Meio esquerda",
  mid_center: "Meio centro",
  mid_right: "Meio direita",
  att_left: "Ataque esquerda",
  att_center: "Ataque centro",
  att_right: "Ataque direita",
};

interface EventChipProps {
  entry: RecentEventEntry;
  onDelete: (id: string) => Promise<void>;
  isDeleting: boolean;
}

export function EventChip({ entry, onDelete, isDeleting }: EventChipProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  const Icon = ACTION_ICON[entry.action];
  const zoneAbbr = ZONE_ABBR[entry.zone];
  const actionLabel = ACTION_LABEL[entry.action];
  const zoneLabel = ZONE_LABEL[entry.zone];

  const chipAriaLabel = `${actionLabel}, #${entry.jersey_number}, ${zoneLabel}`;
  const deleteAriaLabel = `Remover evento: ${actionLabel} #${entry.jersey_number} ${zoneLabel}`;

  // TODO Story 6.6: substituir por check real de isWithinEditWindow(sessionId)
  const isWithinEditWindow = true;
  // if (!isWithinEditWindow) {
  //   return <TooltipExplain term="..." definition="Janela de edição encerrada (24h após a sessão)" />;
  // }

  if (isConfirming) {
    return (
      <div
        className="flex items-center gap-1 px-2 py-1 rounded border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 min-h-[44px]"
        aria-label={chipAriaLabel}
      >
        <span className="text-xs font-mono text-red-700 dark:text-red-300 whitespace-nowrap">
          Remover evento?
        </span>
        <button
          onClick={async () => {
            try {
              setIsConfirming(false);
              await onDelete(entry.id);
            } catch (err) {
              console.error("Delete failed:", err);
              setIsConfirming(true);
            }
          }}
          disabled={isDeleting}
          className="px-2 py-0.5 text-xs rounded bg-red-600 text-white font-medium"
          aria-label="Remover"
        >
          Remover
        </button>
        <button
          onClick={() => setIsConfirming(false)}
          className="px-2 py-0.5 text-xs rounded text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Cancelar"
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => isWithinEditWindow && setIsConfirming(true)}
      disabled={isDeleting || !isWithinEditWindow}
      aria-label={deleteAriaLabel}
      className="flex items-center gap-1 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 min-h-[44px] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
      <span className="font-mono text-xs whitespace-nowrap">
        #{entry.jersey_number} {zoneAbbr}
      </span>
    </button>
  );
}
