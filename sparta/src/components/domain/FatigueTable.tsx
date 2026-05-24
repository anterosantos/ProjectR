"use client";

import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { pt } from "date-fns/locale";
import { ChevronDown, ChevronRight, TrendingDown } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import type { FatigueResponse, SessionInfo } from "@/lib/actions/fatigue-staff";

// Dimension labels PT-PT (UX-DR2)
const DIMENSIONS = [
  { key: "dim_energy",   label: "Energia" },
  { key: "dim_focus",    label: "Concentração" },
  { key: "dim_sleep",    label: "Sono" },
  { key: "dim_soreness", label: "Dores" },
  { key: "dim_mood",     label: "Estado emocional" },
] as const;

type DimKey = (typeof DIMENSIONS)[number]["key"];

const SESSION_TYPE_LABELS: Record<string, string> = {
  training: "Treino",
  match: "Jogo",
  friendly: "Jogo amigável",
};

interface DeltaProps {
  pre: number | null;
  post: number | null;
}

/** Calculates delta and renders with semantic color + icon (UX-DR1) */
function DeltaDisplay({ pre, post }: DeltaProps) {
  if (pre === null || post === null) {
    return <span className="text-muted-foreground">—</span>;
  }
  const delta = post - pre;
  if (delta > 0) {
    return (
      <span className="flex items-center gap-0.5 font-medium text-signal-ready" aria-label={`Melhoria de ${delta}`}>
        <span aria-hidden="true">↑</span>+{delta}
      </span>
    );
  }
  if (delta < 0) {
    return (
      <span className="flex items-center gap-0.5 font-medium text-signal-alert" aria-label={`Deterioração de ${Math.abs(delta)}`}>
        <span aria-hidden="true">↓</span>{delta}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-0.5 text-muted-foreground" aria-label="Sem alteração">
      <span aria-hidden="true">—</span>0
    </span>
  );
}

interface SessionRow {
  sessionId: string;
  sessionDate: string;
  sessionType: string;
  pre: FatigueResponse | undefined;
  post: FatigueResponse | undefined;
}

function formatSessionDate(iso: string): string {
  try {
    const parsed = parseISO(iso);
    if (isNaN(parsed.getTime())) return "Data inválida";
    return format(parsed, "d 'de' MMM yyyy", { locale: pt });
  } catch {
    return "Data inválida";
  }
}

function formatResponseDate(iso: string): string {
  try {
    const parsed = parseISO(iso);
    if (isNaN(parsed.getTime())) return "Data inválida";
    return format(parsed, "d/MM HH:mm", { locale: pt });
  } catch {
    return "Data inválida";
  }
}

interface CollapsibleRowProps {
  row: SessionRow;
  activeDimensions?: DimKey[];
}

function CollapsibleRow({ row, activeDimensions }: CollapsibleRowProps) {
  const [expanded, setExpanded] = useState(false);

  const validActiveDims = activeDimensions?.filter((d) => DIMENSIONS.some((dim) => dim.key === d)) ?? DIMENSIONS.map((d) => d.key);
  const visibleDims = DIMENSIONS.filter(
    (d) => !validActiveDims || validActiveDims.includes(d.key)
  );

  const hasBoth = row.pre !== undefined && row.post !== undefined;

  return (
    <div className="border-b border-border last:border-0">
      {/* Session header row */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px]"
        aria-expanded={expanded}
        aria-controls={`session-detail-${row.sessionId}`}
      >
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground">{row.sessionDate}</span>
          <span className="text-xs text-muted-foreground">{row.sessionType}</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Quick summary badges */}
          {row.pre && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              Pré
            </span>
          )}
          {row.post && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              Pós
            </span>
          )}
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          )}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div
          id={`session-detail-${row.sessionId}`}
          className="px-4 pb-4"
        >
          {/* Header columns */}
          <div className="mb-2 grid grid-cols-[1fr_auto_auto_auto] gap-x-3 text-xs font-medium text-muted-foreground">
            <span>Dimensão</span>
            <span className="text-center w-10">Pré</span>
            <span className="text-center w-10">Pós</span>
            <span className="text-center w-12">Delta</span>
          </div>

          <div className="space-y-1.5">
            {visibleDims.map((dim) => {
              const preVal = row.pre?.[dim.key] ?? null;
              const postVal = row.post?.[dim.key] ?? null;
              return (
                <div
                  key={dim.key}
                  className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 rounded-md bg-muted/40 px-2 py-1.5 text-sm"
                >
                  <span className="text-foreground">{dim.label}</span>
                  <span className="w-10 text-center text-foreground">
                    {preVal ?? <span className="text-muted-foreground">—</span>}
                  </span>
                  <span className="w-10 text-center text-foreground">
                    {postVal ?? <span className="text-muted-foreground">—</span>}
                  </span>
                  <span className="w-12 flex justify-center">
                    {hasBoth ? (
                      <DeltaDisplay pre={preVal} post={postVal} />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          {/* sRPE row (pós only) */}
          {row.post?.srpe_value !== undefined && row.post.srpe_value !== null && (
            <div className="mt-2 rounded-md bg-muted/40 px-2 py-1.5 text-sm">
              <span className="text-muted-foreground">sRPE pós-sessão: </span>
              <span className="font-medium text-foreground">{row.post.srpe_value}</span>
              <span className="text-muted-foreground"> /10</span>
            </div>
          )}

          {/* Timestamps */}
          <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
            {row.pre && (
              <span>Pré: {formatResponseDate(row.pre.submitted_at)}</span>
            )}
            {row.post && (
              <span>Pós: {formatResponseDate(row.post.submitted_at)}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export interface FatigueTableProps {
  playerId: string;
  playerName: string;
  responses: FatigueResponse[];
  sessions: Record<string, SessionInfo>;
  /** Active filter: dimension keys to display */
  activeDimensions?: DimKey[];
  /** Active filter: "pre" | "post" | undefined (all) */
  activePhase?: "pre" | "post" | undefined;
}

export function FatigueTable({
  playerName,
  responses,
  sessions,
  activeDimensions,
  activePhase,
}: FatigueTableProps) {
  // Apply phase filter
  const filtered = useMemo(() => {
    if (!activePhase) return responses;
    return responses.filter((r) => r.phase === activePhase);
  }, [responses, activePhase]);

  // Group responses by session_id
  const sessionRows = useMemo<SessionRow[]>(() => {
    const map = new Map<string, { pre?: FatigueResponse; post?: FatigueResponse }>();

    for (const r of filtered) {
      const entry = map.get(r.session_id) ?? {};
      if (r.phase === "pre") {
        entry.pre = r;
      } else if (r.phase === "post") {
        entry.post = r;
      }
      map.set(r.session_id, entry);
    }

    // Build rows, sort by session date descending
    return [...map.entries()]
      .map(([sessionId, { pre, post }]) => {
        const session = sessions[sessionId];
        const sessionDate = session
          ? formatSessionDate(session.scheduled_at)
          : formatResponseDate(pre?.submitted_at ?? post?.submitted_at ?? "");
        const sessionType = session
          ? (SESSION_TYPE_LABELS[session.type] ?? session.type)
          : "Sessão";

        return { sessionId, sessionDate, sessionType, pre, post };
      })
      .sort((a, b) => {
        // Sort by session scheduled_at descending; fallback to response submitted_at
        const aTime = sessions[a.sessionId]?.scheduled_at ?? a.pre?.submitted_at ?? a.post?.submitted_at ?? "";
        const bTime = sessions[b.sessionId]?.scheduled_at ?? b.pre?.submitted_at ?? b.post?.submitted_at ?? "";
        const aTimeMs = new Date(aTime).getTime();
        const bTimeMs = new Date(bTime).getTime();
        // Fallback to 0 if parsing fails (NaN comparison always returns false)
        const aSafe = isNaN(aTimeMs) ? 0 : aTimeMs;
        const bSafe = isNaN(bTimeMs) ? 0 : bTimeMs;
        return bSafe - aSafe;
      });
  }, [filtered, sessions]);

  if (sessionRows.length === 0) {
    return (
      <EmptyState
        icon={<TrendingDown className="h-8 w-8 text-muted-foreground" />}
        title="Sem respostas ainda"
        description={`O ${playerName} vai começar a registar quando responder ao primeiro questionário.`}
      />
    );
  }

  return (
    <div
      role="region"
      aria-label={`Tabela de respostas de fadiga dos últimos 28 dias — ${playerName}`}
      className="rounded-lg border border-border bg-background"
    >
      {sessionRows.map((row) => (
        <CollapsibleRow
          key={row.sessionId}
          row={row}
          activeDimensions={activeDimensions}
        />
      ))}
    </div>
  );
}

// Export delta calculation for testing
export function calculateDelta(pre: number | null, post: number | null): number | null {
  if (pre === null || post === null) return null;
  return post - pre;
}
