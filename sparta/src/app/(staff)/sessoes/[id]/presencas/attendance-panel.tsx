"use client";

import { useState, useCallback } from "react";
import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PendingBadge } from "@/components/domain/pending-badge";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { upsertAttendance } from "@/lib/actions/attendance";
import { enqueueMutation } from "@/lib/outbox/enqueue";
import { newId } from "@/lib/uuid";
import {
  ATTENDANCE_STATUSES,
  type AttendanceStatus,
  type AttendanceRecord,
  type PlayerForAttendance,
} from "@/lib/schemas/attendances";

interface AttendancePanelProps {
  players: PlayerForAttendance[];
  existingAttendances: AttendanceRecord[];
  sessionId: string;
}

const STATUS_CYCLE: AttendanceStatus[] = [...ATTENDANCE_STATUSES];

function nextStatus(current: AttendanceStatus): AttendanceStatus {
  if (!ATTENDANCE_STATUSES.includes(current)) {
    return "present";
  }
  const idx = STATUS_CYCLE.indexOf(current);
  if (idx === -1) {
    return "present";
  }
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]!;
}

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: "Presente",
  absent: "Ausente",
  late: "Atrasado",
  injured: "Lesionado",
  excused: "Justificado",
};

const STATUS_COLOR: Record<AttendanceStatus, string> = {
  present: "bg-green-100 text-green-800",
  absent: "bg-red-100 text-red-800",
  late: "bg-yellow-100 text-yellow-800",
  injured: "bg-orange-100 text-orange-800",
  excused: "bg-blue-100 text-blue-800",
};

const POSITION_ORDER: Record<string, number> = {
  GK: 0,
  DEF: 1,
  MID: 2,
  FWD: 3,
};

export function AttendancePanel({
  players,
  existingAttendances,
  sessionId,
}: AttendancePanelProps) {
  const { isOnline } = useOnlineStatus();

  const initialStatuses = useCallback(() => {
    const map = new Map<string, AttendanceStatus>();
    const playerIds = new Set(players.map((p) => p.id));

    for (const player of players) {
      map.set(player.id, "present");
    }

    for (const record of existingAttendances) {
      if (playerIds.has(record.player_id)) {
        map.set(record.player_id, record.status);
      }
    }
    return map;
  }, [players, existingAttendances]);

  const [statuses, setStatuses] = useState<Map<string, AttendanceStatus>>(
    initialStatuses
  );
  const [showInactive, setShowInactive] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const hasInactivePlayers = players.some((p) => !p.is_active);
  const visiblePlayers = showInactive
    ? players
    : players.filter((p) => p.is_active);

  const handleToggle = useCallback((playerId: string) => {
    setStatuses((prev) => {
      const current = prev.get(playerId) ?? "present";
      const next = new Map(prev);
      next.set(playerId, nextStatus(current));
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (visiblePlayers.length === 0) {
      setError("Nenhum jogador para guardar");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (isOnline) {
        const results = await Promise.all(
          visiblePlayers.map((player) =>
            upsertAttendance({
              id: newId(),
              session_id: sessionId,
              player_id: player.id,
              status: statuses.get(player.id) ?? "present",
            })
          )
        );
        const failed = results.filter((r) => !r.ok);
        if (failed.length > 0) {
          setError("Erro ao guardar algumas presenças. Tente novamente.");
        } else {
          setSuccessMsg("Presenças guardadas");
        }
      } else {
        const payloads = visiblePlayers.map((player) => ({
          id: newId(),
          session_id: sessionId,
          player_id: player.id,
          status: statuses.get(player.id) ?? "present",
        }));

        await Promise.all(
          payloads.map((payload) => enqueueMutation("attendance.upsert", payload))
        );

        setPendingCount((prev) => prev + payloads.length);
        setSuccessMsg(
          `${payloads.length} presenças em fila para sincronização`
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setIsSaving(false);
    }
  }, [isOnline, visiblePlayers, statuses, sessionId]);

  if (players.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <EmptyState
          icon={<ClipboardList className="h-8 w-8 text-muted-foreground" />}
          title="Sem jogadores no plantel"
          description="Adiciona jogadores em /plantel antes de registar presenças."
        />
      </div>
    );
  }

  // Group visible players by position
  const playersByPosition: Record<string, PlayerForAttendance[]> = {};
  for (const player of visiblePlayers) {
    const pos = player.primary_position ?? "Indefinido";
    if (!playersByPosition[pos]) playersByPosition[pos] = [];
    playersByPosition[pos]!.push(player);
  }

  const sortedPositionEntries = Object.entries(playersByPosition).sort(
    ([a], [b]) => {
      return (POSITION_ORDER[a] ?? 999) - (POSITION_ORDER[b] ?? 999);
    }
  );

  return (
    <div className="flex flex-col flex-1 p-4 gap-4">
      {pendingCount > 0 && (
        <PendingBadge count={pendingCount} label="presenças pendentes" />
      )}

      {error && (
        <div
          role="alert"
          className="rounded-md bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {successMsg && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-md bg-green-50 p-3 text-sm text-green-700"
        >
          {successMsg}
        </div>
      )}

      <ul className="flex flex-col gap-4 list-none p-0 m-0">
        {sortedPositionEntries.map(([position, groupPlayers]) => (
          <li key={position}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
              {position}
            </h2>
            <ul className="flex flex-col gap-1 list-none p-0 m-0">
              {groupPlayers.map((player) => {
                const status = statuses.get(player.id) ?? "present";
                return (
                  <li key={player.id}>
                    <button
                      type="button"
                      onClick={() => handleToggle(player.id)}
                      aria-label={`${player.full_name} — ${STATUS_LABEL[status]}. Tocar para alterar.`}
                      className={`w-full flex items-center justify-between min-h-[44px] px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors ${!player.is_active ? "opacity-60" : ""}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground w-6 text-right tabular-nums">
                          {player.jersey_num !== 0 ? player.jersey_num : "—"}
                        </span>
                        <span className="text-sm font-medium">
                          {player.full_name}
                          {!player.is_active && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              (inativo)
                            </span>
                          )}
                        </span>
                      </div>
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_COLOR[status]}`}
                      >
                        {STATUS_LABEL[status]}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>

      {hasInactivePlayers && (
        <Button
          type="button"
          variant="ghost"
          onClick={() => setShowInactive((v) => !v)}
          className="self-start text-sm"
        >
          {showInactive ? "Ocultar inativos" : "Mostrar inativos"}
        </Button>
      )}

      <div className="sticky bottom-0 pt-4 pb-safe bg-background/95 backdrop-blur-sm border-t border-border mt-auto">
        <Button
          type="button"
          variant="primary"
          className="w-full"
          disabled={isSaving || visiblePlayers.length === 0}
          onClick={handleSave}
          aria-label="Guardar presenças da sessão"
        >
          {isSaving ? "A guardar…" : "Guardar presenças"}
        </Button>
      </div>
    </div>
  );
}
