"use client";

/**
 * FatigueQuestionnaire — Questionário de fadiga com 5 sliders (Story 4.2)
 *
 * - Mostra todas as 5 dimensões numa única vista (AC #2)
 * - Autosave em IndexedDB (db.cache) com debounce 800ms (AC #3)
 * - Restaura draft ao montar (AC #3)
 * - Slider sRPE opcional apenas na fase post (AC #5)
 * - Botão "Submeter" desactivado até todas as 5 dimensões estarem preenchidas (AC #4)
 * - Redireccionamento para /hoje após confirmação (AC #4)
 *
 * Story 4.4 substituirá a chamada directa a submitFatigueResponse por uma
 * entrada no outbox (offline-first). Não alterar esta lógica até essa story.
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/outbox/db";
import { newId } from "@/lib/uuid";
import { submitFatigueResponse } from "@/lib/actions/fatigue";
import { enqueueFatigueSubmit } from "@/lib/outbox/enqueue";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { CalmConfirmation } from "@/components/ui/calm-confirmation";
import { FatigueSlider } from "@/components/ui/fatigue-slider";
import { getFatigueCopy } from "@/lib/i18n/pt-PT/fatigue";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface FatigueQuestionnaireProps {
  sessionId: string;
  sessionType: "training" | "match" | "friendly";
  /** ISO string — é formatada em PT-PT */
  sessionDate: string;
  phase: "pre" | "post";
  playerId: string;
  /**
   * Grupo etário do jogador — controla adaptação linguística (Story 4.3, UX-DR32).
   * "u14" | "u15" → versão simplificada sub-14; qualquer outro valor → versão senior.
   * Default: "senior" (para não quebrar testes e chamadas existentes sem esta prop).
   */
  ageGroup?: "senior" | "u14";
}

interface DraftValues {
  id: string;
  dim_energy: number | null;
  dim_focus: number | null;
  dim_sleep: number | null;
  dim_soreness: number | null;
  dim_mood: number | null;
  srpe_value: number | null;
}

// Schema para validar draft restaurado de IndexedDB
const DraftValuesSchema = z.object({
  id: z.string().min(1),
  dim_energy: z.number().int().min(1).max(5).nullable(),
  dim_focus: z.number().int().min(1).max(5).nullable(),
  dim_sleep: z.number().int().min(1).max(5).nullable(),
  dim_soreness: z.number().int().min(1).max(5).nullable(),
  dim_mood: z.number().int().min(1).max(5).nullable(),
  srpe_value: z.number().int().min(1).max(10).nullable(),
});

// ─── Configuração das dimensões (Story 4.3: substituída por getFatigueCopy) ───
// A constante DIMENSIONS foi removida em Story 4.3.
// As dimensões e labels vêm agora de @/lib/i18n/pt-PT/fatigue via getFatigueCopy(ageGroup).

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSessionType(type: "training" | "match" | "friendly"): string {
  const map: Record<typeof type, string> = {
    training: "Treino",
    match: "Jogo",
    friendly: "Jogo amigável",
  };
  return map[type];
}

function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString("pt-PT", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return isoString;
  }
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function FatigueQuestionnaire({
  sessionId,
  sessionType,
  sessionDate,
  phase,
  playerId,
  ageGroup = "senior",
}: FatigueQuestionnaireProps) {
  const router = useRouter();
  const { isOnline } = useOnlineStatus();

  // Copy adaptado ao grupo etário (Story 4.3)
  const copy = getFatigueCopy(ageGroup);

  const draftKey = `draft:questionnaire:${sessionId}:${phase}:${playerId}`;

  const [values, setValues] = useState<DraftValues>({
    id: "",
    dim_energy: null,
    dim_focus: null,
    dim_sleep: null,
    dim_soreness: null,
    dim_mood: null,
    srpe_value: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // ─── Mount: restaurar draft ou gerar id novo ─────────────────────────────

  useEffect(() => {
    let cancelled = false;
    db.cache.get(draftKey).then((entry) => {
      if (cancelled) return;
      if (entry?.payload) {
        // Validar payload antes de restaurar
        const validated = DraftValuesSchema.safeParse(entry.payload);
        if (validated.success) {
          setValues(validated.data);
        } else {
          // Payload corrompido — gerar novo id
          setValues((prev) => ({ ...prev, id: newId() }));
        }
      } else {
        setValues((prev) => ({ ...prev, id: newId() }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [draftKey]);

  // ─── Autosave: debounce 800ms ────────────────────────────────────────────

  useEffect(() => {
    if (!values.id) return; // aguardar mount
    const timer = setTimeout(() => {
      db.cache.put({
        key: draftKey,
        payload: values,
        updatedAt: new Date().toISOString(),
      }).catch((err) => {
        // Quota exceeded or other IndexedDB error — log silently
        // (user can still submit online; draft will be cleared on success)
        console.warn("[autosave] IndexedDB write failed:", err);
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [values, draftKey]);

  // ─── Handler de slider ───────────────────────────────────────────────────

  const handleChange = useCallback(
    (key: keyof Omit<DraftValues, "id">, value: number) => {
      setValues((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  // ─── Guard de submissão ──────────────────────────────────────────────────

  const allSet = [
    values.dim_energy,
    values.dim_focus,
    values.dim_sleep,
    values.dim_soreness,
    values.dim_mood,
  ].every((v) => v !== null);

  // ─── Submit ──────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (isSubmitting || !allSet) return;
    setIsSubmitting(true);
    setError(null);

    try {
      // Re-verificar isOnline (pode ter mudado entre clique e execução)
      const currentOnline = typeof window !== 'undefined' ? window.navigator.onLine : true;

      if (!currentOnline) {
        // Modo offline — enfileirar no outbox (Story 4.4)
        await enqueueFatigueSubmit({
          player_id: playerId,
          session_id: sessionId,
          phase,
          dim_energy: values.dim_energy as number,
          dim_focus: values.dim_focus as number,
          dim_sleep: values.dim_sleep as number,
          dim_soreness: values.dim_soreness as number,
          dim_mood: values.dim_mood as number,
          srpe_value: phase === "post" ? (values.srpe_value ?? null) : null,
        });

        // Limpar draft após enqueue bem-sucedido
        try {
          await db.cache.delete(draftKey);
        } catch (cacheErr) {
          // Mostrar erro ao user em vez de log silencioso (evita resubmissão duplicada)
          setError("Falha ao limpar draft. Por favor, recarregue a página.");
          setIsSubmitting(false);
          return;
        }

        // Usar mensagem offline específica (AC #1, Story 4.4)
        setConfirmationMessage("Em modo offline. Os teus dados estão seguros e vão ser enviados quando voltares a ter rede.");
        setShowConfirmation(true);
      } else {
        // Modo online — submeter directo ao servidor
        const result = await submitFatigueResponse({
          id: values.id,
          player_id: playerId,
          session_id: sessionId,
          phase,
          dim_energy: values.dim_energy as number,
          dim_focus: values.dim_focus as number,
          dim_sleep: values.dim_sleep as number,
          dim_soreness: values.dim_soreness as number,
          dim_mood: values.dim_mood as number,
          srpe_value: phase === "post" ? (values.srpe_value ?? null) : null,
          submitted_via: "online",
        });

        if (result.ok) {
          try {
            await db.cache.delete(draftKey);
          } catch (cacheErr) {
            // Mostrar erro ao user em vez de log silencioso
            setError("Falha ao limpar draft. Por favor, recarregue a página.");
            setIsSubmitting(false);
            return;
          }
          // Usar mensagem do i18n para online submission
          setShowConfirmation(true);
        } else {
          setError(result.error.message ?? "Erro ao submeter questionário");
          setIsSubmitting(false);
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Erro ao submeter questionário";
      setError(errorMsg);
      setIsSubmitting(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  const sessionLabel = `${formatSessionType(sessionType)} ${formatDate(sessionDate)}`;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-foreground">
        Questionário — {sessionLabel}
      </h1>

      {/* Help text sub-14 — só quando existe (AC #3) */}
      {copy.helpText && (
        <p className="text-sm text-[var(--color-ink-2,theme(colors.gray.600))]">
          {copy.helpText}
        </p>
      )}

      {/* 5 sliders de dimensão — copy vem do i18n (Story 4.3) */}
      <div className="flex flex-col gap-6">
        {copy.dimensions.map((dim) => (
          <FatigueSlider
            key={dim.key}
            id={`slider-${dim.key}`}
            label={dim.label}
            minLabel={dim.minLabel}
            maxLabel={dim.maxLabel}
            min={1}
            max={5}
            value={values[dim.key]}
            onChange={(v) => handleChange(dim.key, v)}
            disabled={isSubmitting}
            ageGroup={ageGroup}
          />
        ))}

        {/* sRPE — só na fase post (AC #5) */}
        {phase === "post" && (
          <FatigueSlider
            id="slider-srpe"
            label="Esforço percebido da sessão (sRPE)"
            minLabel="Muito fácil"
            maxLabel="Máximo esforço"
            min={1}
            max={10}
            value={values.srpe_value}
            onChange={(v) => handleChange("srpe_value", v)}
            disabled={isSubmitting}
          />
        )}
      </div>

      {/* Mensagem de erro */}
      {error && (
        <p role="alert" className="text-sm text-[var(--signal-alert-ink,theme(colors.red.600))]">
          {error}
        </p>
      )}

      {/* Botão Submeter — copy adaptado ao grupo etário (AC #2, Story 4.3) */}
      <button
        type="button"
        disabled={!allSet || isSubmitting}
        onClick={() => void handleSubmit()}
        className="min-h-[44px] min-w-[44px] w-full rounded-lg bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-sm transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? copy.submittingLabel : copy.submitLabel}
      </button>

      {/* Confirmação (AC #4) — uso de confirmationMessage dinâmica para offline */}
      {showConfirmation && (
        <CalmConfirmation
          message={confirmationMessage || copy.confirmationMessage}
          onDismiss={() => {
            void (async () => {
              try {
                await router.push("/hoje");
              } catch (err) {
                console.error("[navigation] Failed to navigate to /hoje:", err);
                // Fallback: reload page
                window.location.href = "/hoje";
              }
            })();
          }}
        />
      )}
    </div>
  );
}
