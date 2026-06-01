"use client";

import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Activity } from "lucide-react";
import { getPlayerRecoveryTabData } from "@/lib/actions/player-profile";
import { EmptyState } from "@/components/ui/empty-state";
import { TooltipExplain } from "@/components/ui/tooltip-explain";
import type { RecoveryCurveResult } from "@/lib/readiness/recovery";

const DIMENSION_COLORS = {
  energy: "#3b82f6",
  focus: "#8b5cf6",
  sleep: "#06b6d4",
  soreness: "#f97316",
  mood: "#22c55e",
};

const DIMENSION_LABELS: Record<string, string> = {
  energy: "Energia",
  focus: "Concentração",
  sleep: "Sono",
  soreness: "Dor muscular",
  mood: "Estado emocional",
};

const DAY_LABELS: Record<number, string> = {
  0: "Dia 0 (pós-sessão)",
  1: "Dia 1",
  2: "Dia 2",
  3: "Dia 3",
};

interface RecuperacaoTabProps {
  playerId: string;
}

export function RecuperacaoTab({ playerId }: RecuperacaoTabProps) {
  const [result, setResult] = useState<RecoveryCurveResult | null>(null);
  const [playerName, setPlayerName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768);
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      const res = await getPlayerRecoveryTabData(playerId);
      if (controller.signal.aborted) return;
      if (res.ok) {
        setResult(res.data.result);
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
        aria-label="A carregar curva de recuperação..."
        className="animate-pulse rounded-lg bg-muted"
        style={{ height: 260 }}
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

  if (!result || result.sampleSize < 5) {
    return (
      <EmptyState
        icon={<Activity className="h-8 w-8 text-muted-foreground" />}
        title="Sem amostra suficiente"
        description="Precisamos de 5+ sessões intensas com questionário pós-sessão para traçar a curva."
      />
    );
  }

  const chartData = result.points.map((p) => ({
    day: DAY_LABELS[p.day] ?? `Dia ${p.day}`,
    energy: p.dimensions.energy,
    focus: p.dimensions.focus,
    sleep: p.dimensions.sleep,
    soreness: p.dimensions.soreness,
    mood: p.dimensions.mood,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-base font-semibold text-foreground">Curva de Recuperação</h3>
        <TooltipExplain
          term="?"
          definition={`Esta curva mostra como ${playerName} recupera nos dias após um treino intenso. Use para calibrar a próxima sessão.`}
        />
      </div>

      <p className="text-sm text-muted-foreground">
        n={result.totalHighIntensitySessions} sessões intensas analisadas
      </p>

      <div
        aria-label={`Gráfico de curva de recuperação de ${playerName}`}
        className="w-full overflow-x-auto"
      >
        <ResponsiveContainer width="100%" height={isMobile ? 200 : 260}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="day" tick={{ fontSize: 12 }} />
            <YAxis domain={[1, 10]} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend
              formatter={(value) => DIMENSION_LABELS[value] ?? value}
            />
            {Object.entries(DIMENSION_COLORS).map(([key, color]) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={color}
                dot={{ r: 4 }}
                strokeWidth={2}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
