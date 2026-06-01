"use client";

import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { pt } from "date-fns/locale";
import { ClipboardList } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { getPlayerDataDecisionsTabData } from "@/lib/actions/player-profile";
import type { DataDecision } from "@/lib/types/decisions";
import { DECISION_KIND_LABELS } from "@/lib/types/decisions";

interface DecisoesTabProps {
  playerId: string;
}

function formatDecisionDate(isoDate: string): string {
  try {
    return format(parseISO(isoDate), "d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: pt });
  } catch {
    return isoDate;
  }
}

export function DecisoesTab({ playerId }: DecisoesTabProps) {
  const [decisions, setDecisions] = useState<DataDecision[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      const result = await getPlayerDataDecisionsTabData(playerId);
      if (controller.signal.aborted) return;
      if (result.ok) {
        setDecisions(result.data.decisions);
      } else {
        setError(result.error.message);
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
        aria-label="A carregar decisões data-driven..."
        className="animate-pulse rounded-lg bg-muted"
        style={{ height: 120 }}
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

  if (!decisions || decisions.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardList className="h-8 w-8 text-muted-foreground" />}
        title="Sem decisões registadas"
        description="Sem decisões data-driven registadas ainda."
      />
    );
  }

  return (
    <ul className="space-y-3" aria-label="Lista de decisões data-driven">
      {decisions.map((d) => (
        <li
          key={d.id}
          className="rounded-lg border border-border px-4 py-3 space-y-1"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {DECISION_KIND_LABELS[d.decisionKind] ?? d.decisionKind}
            </span>
            <time
              dateTime={d.createdAt}
              className="text-xs text-muted-foreground whitespace-nowrap"
            >
              {formatDecisionDate(d.createdAt)}
            </time>
          </div>
          {d.note && (
            <p className="text-sm text-foreground">{d.note}</p>
          )}
          {!d.note && (
            <p className="text-sm text-muted-foreground italic">Sem nota.</p>
          )}
        </li>
      ))}
    </ul>
  );
}
