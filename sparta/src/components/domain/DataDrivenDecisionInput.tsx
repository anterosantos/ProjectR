"use client";

import { useEffect, useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { pt } from "date-fns/locale";
import { BookmarkPlus } from "lucide-react";
import {
  getDataDrivenDecisions,
  saveDataDrivenDecision,
  updateDataDrivenDecision,
} from "@/lib/actions/decisions";
import {
  DECISION_KIND_LABELS,
  DECISION_KINDS,
  type DataDecision,
  type DecisionKind,
} from "@/lib/types/decisions";

interface DataDrivenDecisionInputProps {
  playerId: string;
  sessionId?: string | null;
}

function isPastEditable(d: DataDecision, currentUserId: string): boolean {
  // 24-hour window: createdAt + 24h > now() (strict boundary check)
  return (
    d.actorId === currentUserId &&
    new Date(d.createdAt).getTime() + 24 * 3600 * 1000 > Date.now()
  );
}

function formatDecisionDate(iso: string): string {
  try {
    return format(parseISO(iso), "d MMM", { locale: pt });
  } catch {
    return "—";
  }
}

export function DataDrivenDecisionInput({
  playerId,
  sessionId,
}: DataDrivenDecisionInputProps) {
  const [decisions, setDecisions] = useState<DataDecision[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState("");
  const [decisionKind, setDecisionKind] = useState<DecisionKind | null>(null);
  const [wasDataDriven, setWasDataDriven] = useState(true);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState("");
  const [editStatus, setEditStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await getDataDrivenDecisions(playerId);
      if (result.ok) {
        setDecisions(result.data.decisions);
        setCurrentUserId(result.data.currentUserId);
      }
    });
  }, [playerId]);

  const handleSave = async () => {
    if (!decisionKind) return;
    setStatus("saving");

    const result = await saveDataDrivenDecision({
      playerId,
      sessionId,
      decisionKind,
      note: note.trim() || null,
      wasDataDriven,
    });

    if (result.ok) {
      setStatus("success");
      setNote("");
      setDecisionKind(null);
      setWasDataDriven(true);
      startTransition(async () => {
        const freshResult = await getDataDrivenDecisions(playerId);
        if (freshResult.ok) {
          setDecisions(freshResult.data.decisions);
        }
      });
      const timeoutId = setTimeout(() => {
        setStatus("idle");
        setExpanded(false);
      }, 2000);
      return () => clearTimeout(timeoutId);
    } else {
      setStatus("error");
    }
  };

  const handleCancel = () => {
    setExpanded(false);
    setNote("");
    setDecisionKind(null);
    setWasDataDriven(true);
    setStatus("idle");
  };

  const handleEditSave = async (id: string) => {
    setEditStatus("saving");
    const result = await updateDataDrivenDecision(id, editNote);
    if (result.ok) {
      setEditStatus("success");
      setEditingId(null);
      setEditNote("");
      startTransition(async () => {
        const freshResult = await getDataDrivenDecisions(playerId);
        if (freshResult.ok) {
          setDecisions(freshResult.data.decisions);
        }
      });
      setTimeout(() => setEditStatus("idle"), 1500);
    } else {
      setEditStatus("error");
    }
  };

  return (
    <div className="space-y-3">
      {/* Histórico das últimas 3 decisões */}
      {decisions.length > 0 && (
        <div className="space-y-2" aria-label="Últimas decisões registadas">
          {decisions.slice(0, 3).map((d) => {
            const kindLabel = DECISION_KIND_LABELS[d.decisionKind] ?? "Desconhecido";
            const dateLabel = formatDecisionDate(d.createdAt);
            const editable = isPastEditable(d, currentUserId);

            return (
              <div
                key={d.id}
                className="rounded-md border border-border bg-muted/30 p-2 text-xs space-y-0.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{kindLabel}</span>
                  <div className="flex items-center gap-2">
                    {!d.wasDataDriven && (
                      <span className="text-muted-foreground text-[10px]">Não data-driven</span>
                    )}
                    <span className="text-muted-foreground">{dateLabel}</span>
                  </div>
                </div>

                {editingId === d.id ? (
                  <div className="space-y-1 mt-1">
                    <textarea
                      className="w-full resize-none rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      rows={2}
                      maxLength={500}
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      aria-label="Editar nota"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground disabled:opacity-50"
                        onClick={() => handleEditSave(d.id)}
                        disabled={editStatus === "saving"}
                      >
                        {editStatus === "saving" ? "A guardar…" : "Guardar"}
                      </button>
                      <button
                        type="button"
                        className="rounded border border-border px-2 py-0.5 text-[10px] text-muted-foreground"
                        onClick={() => { setEditingId(null); setEditStatus("idle"); }}
                      >
                        Cancelar
                      </button>
                    </div>
                    {editStatus === "error" && (
                      <p className="text-[10px] text-destructive">Erro ao editar decisão.</p>
                    )}
                  </div>
                ) : (
                  <>
                    {d.note && (
                      <p className="text-muted-foreground line-clamp-2">
                        {d.note.length > 100 ? `${d.note.slice(0, 100)}…` : d.note}
                      </p>
                    )}
                    {editable && (
                      <button
                        type="button"
                        className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2 mt-0.5"
                        onClick={() => { setEditingId(d.id); setEditNote(d.note ?? ""); }}
                      >
                        Editar
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Formulário / botão colapsado */}
      {status === "success" ? (
        <p className="text-sm text-foreground font-medium" role="status">
          Decisão registada ✓
        </p>
      ) : !expanded ? (
        <button
          type="button"
          className="flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          aria-expanded={false}
          onClick={() => setExpanded(true)}
        >
          <BookmarkPlus className="h-4 w-4" aria-hidden="true" />
          Marcar decisão data-driven
        </button>
      ) : (
        <div
          role="group"
          aria-label="Formulário de decisão data-driven"
          className="space-y-3 rounded-md border border-border bg-muted/20 p-3"
        >
          <textarea
            className="w-full resize-none rounded border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            rows={3}
            maxLength={500}
            placeholder="Que decisão tomaste com base nestes dados? (opcional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-label="Nota da decisão"
          />

          {/* RadioGroup — decision_kind */}
          <fieldset>
            <legend className="text-xs font-medium text-foreground mb-1.5">Tipo de decisão</legend>
            <div className="space-y-1">
              {DECISION_KINDS.map((kind, idx) => (
                <label key={kind} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name={`decision-kind-${idx}`}
                    value={kind}
                    checked={decisionKind === kind}
                    onChange={() => setDecisionKind(kind)}
                    className="accent-primary"
                  />
                  <span className="text-foreground">{DECISION_KIND_LABELS[kind]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Checkbox — was_data_driven */}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={wasDataDriven}
              onChange={(e) => setWasDataDriven(e.target.checked)}
              className="accent-primary"
              aria-label="Foi mesmo data-driven?"
            />
            <span className="text-foreground">Foi mesmo data-driven?</span>
          </label>

          {status === "error" && (
            <p className="text-sm text-destructive" role="alert">
              Erro ao guardar decisão.
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              className="rounded bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
              onClick={handleSave}
              disabled={!decisionKind || status === "saving"}
            >
              {status === "saving" ? "A guardar…" : "Guardar"}
            </button>
            <button
              type="button"
              className="rounded border border-border px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground"
              onClick={handleCancel}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
