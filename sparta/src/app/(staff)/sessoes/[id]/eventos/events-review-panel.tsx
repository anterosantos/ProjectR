"use client";

import { useState } from "react";
import { deleteMatchEvent, updateMatchEvent } from "@/lib/actions/events";
import { TooltipExplain } from "@/components/ui/tooltip-explain";
import {
  MATCH_ACTIONS,
  MATCH_ZONES,
  type SessionEventEntry,
  type MatchEventUpdate,
} from "@/lib/schemas/match-events";

const ACTION_LABEL: Record<(typeof MATCH_ACTIONS)[number], string> = {
  ball_loss: "Perda de bola",
  ball_recovery: "Recuperação de bola",
  shot_total: "Remate",
  shot_on_target: "Remate à baliza",
  pass_completed: "Passe completado",
  def_pressure: "Pressão defensiva",
  def_action_success: "Ação defensiva",
  off_action_success: "Ação ofensiva",
};

const ZONE_LABEL: Record<(typeof MATCH_ZONES)[number], string> = {
  def_left: "Defesa esq.",
  def_center: "Defesa cen.",
  def_right: "Defesa dir.",
  mid_left: "Meio esq.",
  mid_center: "Meio cen.",
  mid_right: "Meio dir.",
  att_left: "Ataque esq.",
  att_center: "Ataque cen.",
  att_right: "Ataque dir.",
};

interface EventsReviewPanelProps {
  events: SessionEventEntry[];
  sessionId: string;
  isWithinEditWindow: boolean;
}

export function EventsReviewPanel({
  events: initialEvents,
  isWithinEditWindow,
}: EventsReviewPanelProps) {
  const [localEvents, setLocalEvents] = useState<SessionEventEntry[]>(initialEvents);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<MatchEventUpdate>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const showError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 4000);
  };

  const handleDelete = async (id: string) => {
    if (deletingId !== null) return;
    setDeletingId(id);

    // Optimistic remove
    const prev = localEvents;
    setLocalEvents((es) => es.filter((e) => e.id !== id));

    const result = await deleteMatchEvent(id);
    setDeletingId(null);

    if (!result.ok) {
      setLocalEvents(prev);
      showError(result.error.message);
    }
  };

  const handleEditStart = (entry: SessionEventEntry) => {
    setEditingId(entry.id);
    setEditDraft({ action: entry.action, zone: entry.zone });
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditDraft({});
  };

  const handleEditSave = async (id: string) => {
    const result = await updateMatchEvent(id, editDraft);
    if (!result.ok) {
      if (result.error.code === "forbidden") {
        showError("Janela de edição encerrada.");
      } else {
        showError(result.error.message);
      }
      setEditingId(null);
      setEditDraft({});
      return;
    }

    setLocalEvents((es) =>
      es.map((e) =>
        e.id === id
          ? {
              ...e,
              action: (editDraft.action ?? e.action) as (typeof MATCH_ACTIONS)[number],
              zone: (editDraft.zone ?? e.zone) as (typeof MATCH_ZONES)[number],
            }
          : e
      )
    );
    setEditingId(null);
    setEditDraft({});
  };

  const closedTooltip = (
    <TooltipExplain
      term="Edição encerrada"
      definition="Janela de edição encerrada (24h após a sessão)"
    />
  );

  if (localEvents.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem eventos registados nesta sessão.</p>;
  }

  return (
    <div className="space-y-2">
      {error && (
        <div
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="py-2 pr-3 font-medium">Hora</th>
            <th className="py-2 pr-3 font-medium">Ação</th>
            <th className="py-2 pr-3 font-medium">Zona</th>
            <th className="py-2 pr-3 font-medium">Jogador</th>
            <th className="py-2 font-medium">Opções</th>
          </tr>
        </thead>
        <tbody>
          {localEvents.map((entry) => {
            const time = new Date(entry.occurred_at).toLocaleTimeString("pt-PT", {
              hour: "2-digit",
              minute: "2-digit",
            });

            if (editingId === entry.id) {
              return (
                <tr key={entry.id} className="border-b border-border">
                  <td className="py-2 pr-3 text-muted-foreground">{time}</td>
                  <td className="py-2 pr-3">
                    <select
                      className="rounded border border-border px-2 py-1 text-xs"
                      value={editDraft.action ?? entry.action}
                      onChange={(e) =>
                        setEditDraft((d) => ({
                          ...d,
                          action: e.target.value as (typeof MATCH_ACTIONS)[number],
                        }))
                      }
                      aria-label="Ação do evento"
                    >
                      {MATCH_ACTIONS.map((a) => (
                        <option key={a} value={a}>
                          {ACTION_LABEL[a]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-3">
                    <select
                      className="rounded border border-border px-2 py-1 text-xs"
                      value={editDraft.zone ?? entry.zone}
                      onChange={(e) =>
                        setEditDraft((d) => ({
                          ...d,
                          zone: e.target.value as (typeof MATCH_ZONES)[number],
                        }))
                      }
                      aria-label="Zona do evento"
                    >
                      {MATCH_ZONES.map((z) => (
                        <option key={z} value={z}>
                          {ZONE_LABEL[z]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">
                    {entry.jersey_number != null ? `nº${entry.jersey_number} ` : ""}
                    {entry.player_name ?? "—"}
                  </td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => void handleEditSave(entry.id)}
                        className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:opacity-90"
                        aria-label={`Guardar edição do evento ${time}`}
                      >
                        Guardar
                      </button>
                      <button
                        onClick={handleEditCancel}
                        className="rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                        aria-label="Cancelar edição"
                      >
                        Cancelar
                      </button>
                    </div>
                  </td>
                </tr>
              );
            }

            return (
              <tr key={entry.id} className="border-b border-border">
                <td className="py-2 pr-3 text-muted-foreground">{time}</td>
                <td className="py-2 pr-3">{ACTION_LABEL[entry.action] ?? entry.action}</td>
                <td className="py-2 pr-3">{ZONE_LABEL[entry.zone] ?? entry.zone}</td>
                <td className="py-2 pr-3 text-muted-foreground">
                  {entry.jersey_number != null ? `nº${entry.jersey_number} ` : ""}
                  {entry.player_name ?? "—"}
                </td>
                <td className="py-2">
                  {isWithinEditWindow ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditStart(entry)}
                        className="rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-muted"
                        aria-label={`Editar evento ${ACTION_LABEL[entry.action]} às ${time}`}
                        disabled={deletingId === entry.id}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => void handleDelete(entry.id)}
                        className="rounded border border-destructive/50 px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                        aria-label={`Apagar evento ${ACTION_LABEL[entry.action]} às ${time}`}
                        disabled={deletingId === entry.id}
                      >
                        {deletingId === entry.id ? "A apagar…" : "Apagar"}
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        disabled
                        className="rounded border border-border px-2 py-1 text-xs text-muted-foreground opacity-50 cursor-not-allowed"
                        aria-label="Editar desactivado — janela encerrada"
                      >
                        Editar
                      </button>
                      <button
                        disabled
                        className="rounded border border-border px-2 py-1 text-xs text-muted-foreground opacity-50 cursor-not-allowed"
                        aria-label="Apagar desactivado — janela encerrada"
                      >
                        Apagar
                      </button>
                      {closedTooltip}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
