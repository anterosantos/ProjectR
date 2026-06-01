"use client";

import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { pt } from "date-fns/locale";
import { CalendarX, SlidersHorizontal } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { DrillDownSheet } from "@/components/ui/drill-down-sheet";
import { Button } from "@/components/ui/button";
import { getPlayerAttendanceTabData } from "@/lib/actions/player-profile";
import type { AttendanceTabData } from "@/lib/actions/player-profile";

const STATUS_LABELS: Record<string, string> = {
  present: "Presente",
  absent: "Ausente",
  late: "Atrasado",
  injured: "Lesionado",
  excused: "Dispensado",
};

const SESSION_TYPE_LABELS: Record<string, string> = {
  training: "Treino",
  match: "Jogo",
  friendly: "Amigável",
};

function statusColor(status: string): string {
  if (status === "present" || status === "late") return "text-signal-ok";
  if (status === "excused" || status === "injured") return "text-signal-caution";
  return "text-signal-alert";
}

function formatMonthLabel(yearMonth: string): string {
  try {
    const d = parseISO(`${yearMonth}-01`);
    return format(d, "MMMM 'de' yyyy", { locale: pt });
  } catch {
    return yearMonth;
  }
}

function formatDateLabel(isoDate: string): string {
  try {
    const d = parseISO(isoDate);
    return format(d, "d/MM/yyyy", { locale: pt });
  } catch {
    return isoDate.slice(0, 10);
  }
}

interface PresencasTabProps {
  playerId: string;
}

export function PresencasTab({ playerId }: PresencasTabProps) {
  const [data, setData] = useState<AttendanceTabData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ treinos: true, jogos: true });
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      const result = await getPlayerAttendanceTabData(playerId);
      if (controller.signal.aborted) return;
      if (result.ok) {
        setData(result.data);
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
        aria-label="A carregar presenças..."
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

  if (!data || data.totalSessions === 0) {
    return (
      <EmptyState
        icon={<CalendarX className="h-8 w-8 text-muted-foreground" />}
        title="Sem sessões ainda"
        description="Ainda não há sessões registadas."
      />
    );
  }

  // Apply session type filters
  const filteredMonths = data.months.map((month) => ({
    ...month,
    sessions: month.sessions.filter((s) => {
      if (!filters.treinos && s.session_type === "training") return false;
      if (!filters.jogos && (s.session_type === "match" || s.session_type === "friendly")) return false;
      return true;
    }),
  })).filter((m) => m.sessions.length > 0);

  const filteredTotal = filteredMonths.reduce((sum, m) => sum + m.sessions.length, 0);
  const filteredPresent = filteredMonths.reduce(
    (sum, m) => sum + m.sessions.filter((s) => s.status === "present" || s.status === "late").length,
    0
  );
  const pct = filteredTotal > 0 ? Math.round((filteredPresent / filteredTotal) * 100) : 0;
  const pctColor = pct >= 85 ? "bg-signal-ok" : pct >= 50 ? "bg-signal-caution" : "bg-signal-alert";

  return (
    <div className="space-y-4">
      {/* Filter trigger button */}
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSheetOpen(true)}
          aria-label="Abrir filtros de presenças"
        >
          <SlidersHorizontal className="h-4 w-4 mr-1" aria-hidden="true" />
          Filtros
        </Button>
      </div>

      {/* Filter sheet */}
      <DrillDownSheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <div className="p-6 space-y-4">
          <h2 className="text-base font-semibold">Filtros de presenças</h2>
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={filters.treinos}
                onChange={(e) => setFilters((f) => ({ ...f, treinos: e.target.checked }))}
                className="rounded border-border"
              />
              Treinos
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={filters.jogos}
                onChange={(e) => setFilters((f) => ({ ...f, jogos: e.target.checked }))}
                className="rounded border-border"
              />
              Jogos
            </label>
          </div>
          <Button className="w-full" onClick={() => setSheetOpen(false)}>
            Aplicar
          </Button>
        </div>
      </DrillDownSheet>

      {/* Summary card */}
      <div
        className="rounded-lg border border-border px-4 py-3 space-y-2"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Presenças</span>
          <span className="font-semibold">
            {filteredPresent} de {filteredTotal} sessões ({pct}%)
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full ${pctColor}`}
            style={{ width: `${pct}%` }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Taxa de presença: ${pct}%`}
          />
        </div>
      </div>

      {/* Monthly groups */}
      {filteredMonths.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma sessão para os filtros seleccionados.</p>
      ) : (
        <div className="space-y-4">
          {filteredMonths.map((month) => (
            <section key={month.month} aria-label={`Presenças de ${formatMonthLabel(month.month)}`}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {formatMonthLabel(month.month)}
              </h3>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-1.5 pr-4 text-muted-foreground font-medium">Data</th>
                    <th className="text-left py-1.5 pr-4 text-muted-foreground font-medium">Tipo</th>
                    <th className="text-left py-1.5 text-muted-foreground font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {month.sessions.map((s) => (
                    <tr key={s.session_id} className="border-b border-border last:border-0">
                      <td className="py-1.5 pr-4">{formatDateLabel(s.date)}</td>
                      <td className="py-1.5 pr-4 text-muted-foreground">
                        {SESSION_TYPE_LABELS[s.session_type] ?? s.session_type}
                      </td>
                      <td className={`py-1.5 font-medium ${statusColor(s.status)}`}>
                        {STATUS_LABELS[s.status] ?? s.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
