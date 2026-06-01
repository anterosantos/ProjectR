"use client";

import { useState, useEffect } from "react";
import { TrendingUp } from "lucide-react";
import { getPlayerCorrelationsTabData } from "@/lib/actions/player-profile";
import { EmptyState } from "@/components/ui/empty-state";
import { TooltipExplain } from "@/components/ui/tooltip-explain";
import type {
  CorrelationFinding,
  FatigueDimension,
  ActionMetric,
} from "@/lib/readiness/correlations";

// ── Labels PT-PT ──────────────────────────────────────────────────────────────

type DimGender = "f" | "m";

const DIM_LABELS: Record<FatigueDimension, { label: string; gender: DimGender }> = {
  energy: { label: "Energia", gender: "f" },
  focus: { label: "Concentração", gender: "f" },
  sleep: { label: "Sono", gender: "m" },
  soreness: { label: "Dor muscular", gender: "f" },
  mood: { label: "Estado emocional", gender: "m" },
};

const ACTION_LABELS: Record<ActionMetric, string> = {
  ball_loss: "perdas de bola",
  ball_recovery: "recuperações de bola",
  shot_total: "remates",
  shot_on_target: "remates à baliza",
  pass_completed: "passes completados",
  def_pressure: "pressões defensivas",
  def_action_success: "ações defensivas com sucesso",
  off_action_success: "ações ofensivas com sucesso",
};

// Positive-valence dims: high score = better (energy, focus, sleep, mood)
// Negative-valence dim: soreness (high score = worse, high pain)
const POSITIVE_VALENCE = new Set<FatigueDimension>(["energy", "focus", "sleep", "mood"]);

function toNaturalLanguage(f: CorrelationFinding): string {
  if (!POSITIVE_VALENCE.has(f.dimension) && !(f.dimension in DIM_LABELS)) {
    console.warn(`Unknown dimension: ${f.dimension}`);
  }
  const dimInfo = DIM_LABELS[f.dimension] ?? { label: f.dimension, gender: "f" as DimGender };
  const { label, gender } = dimInfo;
  const actionLabel = ACTION_LABELS[f.action] ?? f.action;
  const isPositiveValence = POSITIVE_VALENCE.has(f.dimension);

  const adj = isPositiveValence
    ? gender === "m"
      ? f.rho > 0
        ? "alto"
        : "baixo"
      : f.rho > 0
        ? "alta"
        : "baixa"
    : gender === "m"
      ? "alto"
      : "alta";

  const moreOrLess = f.rho > 0 ? "mais" : "menos";

  // For negative-valence dims (soreness), we always describe from the problematic "high" state.
  // rho > 0 (unusual): soreness high → MORE of the action (bad signal)
  // rho < 0 (common): soreness high → LESS of the action (good signal, high soreness prevents performance)
  return `${label} ${adj} está associada a ${moreOrLess} ${actionLabel} — ${f.n} jogos analisados`;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface CorrelacoesTabProps {
  playerId: string;
}

export function CorrelacoesTab({ playerId }: CorrelacoesTabProps) {
  const [findings, setFindings] = useState<CorrelationFinding[] | null>(null);
  const [playerName, setPlayerName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    if (!playerId?.trim()) {
      setLoading(false);
      return;
    }

    async function load() {
      setLoading(true);
      setError(null);
      const res = await getPlayerCorrelationsTabData(playerId);
      if (controller.signal.aborted) return;
      if (res.ok) {
        setFindings(res.data.result.findings);
        setPlayerName(res.data.playerName);
      } else {
        setError(res.error.message);
      }
      setLoading(false);
    }

    void load();
    return () => controller.abort();
  }, [playerId]);

  if (loading) {
    return (
      <div
        role="status"
        aria-label="A calcular correlações..."
        className="animate-pulse rounded-lg bg-muted"
        style={{ height: 200 }}
      />
    );
  }

  if (error) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {error}
      </p>
    );
  }

  if (!findings || findings.length === 0) {
    return (
      <EmptyState
        icon={<TrendingUp className="h-8 w-8 text-muted-foreground" />}
        title="Sem padrões significativos ainda"
        description="Continua a recolher dados. Precisamos de 10+ jogos com questionários para detectar padrões."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-base font-semibold text-foreground">
          Correlações Fadiga × Performance
        </h3>
        <TooltipExplain
          term="?"
          definition={`Padrões detectados para ${playerName}. Correlação não é causa — use como pista, não como sentença.`}
        />
      </div>

      <ul className="space-y-3" aria-label="Correlações detectadas">
        {findings.map((f) => (
          <li
            key={`${f.dimension}-${f.action}`}
            className="rounded-lg border border-border bg-card p-4 flex items-start gap-3"
          >
            <span
              aria-hidden="true"
              className={`mt-0.5 h-2 w-2 rounded-full flex-shrink-0 ${
                Math.abs(f.rho) >= 0.7 ? "bg-destructive" : "bg-amber-500"
              }`}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground">{toNaturalLanguage(f)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                rho = {f.rho.toFixed(2)} · p ={" "}
                {f.pValue < 0.001 ? "<0.001" : f.pValue.toFixed(3)}
              </p>
            </div>
            <TooltipExplain
              term="?"
              definition="Correlação não é causa. Use como pista, não como sentença."
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
