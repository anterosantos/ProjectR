"use client";

import { forwardRef } from "react";
import {
  RotateCcw,
  Zap,
  Target,
  Crosshair,
  TrendingUp,
  Shield,
  CheckCircle,
  ArrowUpRight,
} from "lucide-react";
import type { MatchAction } from "@/lib/stores/match-session";
import { cn } from "@/lib/utils";

interface ActionButtonProps {
  action: MatchAction;
  onClick?: (action: MatchAction) => void;
}

const ACTIONS_MAP: Record<
  MatchAction,
  { label: string; icon: React.ComponentType<{ className?: string }>; positive: boolean }
> = {
  ball_loss: { label: "Perda de bola", icon: RotateCcw, positive: false },
  ball_recovery: { label: "Recuperação", icon: Zap, positive: true },
  shot_total: { label: "Remate total", icon: Target, positive: true },
  shot_on_target: {
    label: "Remate enquadrado",
    icon: Crosshair,
    positive: true,
  },
  pass_completed: { label: "Passe completado", icon: TrendingUp, positive: true },
  def_pressure: { label: "Pressão defensiva", icon: Shield, positive: false },
  def_action_success: {
    label: "Ação defensiva com sucesso",
    icon: CheckCircle,
    positive: true,
  },
  off_action_success: {
    label: "Ação ofensiva com sucesso",
    icon: ArrowUpRight,
    positive: true,
  },
};

export const ActionButton = forwardRef<
  HTMLButtonElement,
  ActionButtonProps
>(({ action, onClick }, ref) => {
  const actionInfo = ACTIONS_MAP[action];
  if (!actionInfo) return null;

  const { label, icon: Icon, positive } = actionInfo;
  const color = positive
    ? "border-l-emerald-500"
    : "border-l-red-500";

  return (
    <button
      ref={ref}
      onClick={() => onClick?.(action)}
      aria-label={label}
      className={cn(
        "w-full h-16 min-h-16 rounded-lg border-l-4 border-r border-t border-b border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-1.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors duration-0",
        color
      )}
    >
      <Icon className="w-5 h-5" />
      <span className="text-xs text-center font-medium px-2 line-clamp-2">
        {label}
      </span>
    </button>
  );
});

ActionButton.displayName = "ActionButton";
