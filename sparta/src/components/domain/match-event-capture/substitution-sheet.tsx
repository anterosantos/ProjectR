"use client";

import { useState, useEffect } from "react";
import {
  getMatchLineupForSubs,
  registerSubstitution,
  type SubstitutionLineupRow,
} from "@/lib/actions/substitutions";

interface SubstitutionSheetProps {
  sessionId: string;
  scheduledAt: string;
  isOpen: boolean;
  onClose: () => void;
  onSubstitutionSuccess?: () => void;
}

export function SubstitutionSheet({
  sessionId,
  scheduledAt,
  isOpen,
  onClose,
  onSubstitutionSuccess,
}: SubstitutionSheetProps) {
  const [starters, setStarters] = useState<SubstitutionLineupRow[]>([]);
  const [bench, setBench] = useState<SubstitutionLineupRow[]>([]);
  const [selectedOut, setSelectedOut] = useState<string | null>(null);
  const [selectedIn, setSelectedIn] = useState<string | null>(null);
  const [minute, setMinute] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const elapsed = Date.now() - new Date(scheduledAt).getTime();
    const computedMinute = Math.min(120, Math.max(0, Math.round(elapsed / 60_000)));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: resets minute to elapsed time at moment of open
    setMinute(computedMinute);
    setSelectedOut(null);
    setSelectedIn(null);
    setError(null);

    const controller = new AbortController();
    getMatchLineupForSubs(sessionId).then((res) => {
      if (controller.signal.aborted) return;
      if (res.ok) {
        setStarters(res.data.starters);
        setBench(res.data.bench);
      }
    });
    return () => controller.abort();
  }, [isOpen, sessionId, scheduledAt]);

  const handleConfirm = async () => {
    if (!selectedOut || !selectedIn || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    const result = await registerSubstitution(sessionId, selectedOut, selectedIn, minute);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    onSubstitutionSuccess?.();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sub-sheet-title"
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => !isSubmitting && onClose()}
      />
      <div className="relative w-full bg-white dark:bg-slate-900 rounded-t-xl shadow-2xl p-4 max-h-[80vh] overflow-y-auto">
        <h2 id="sub-sheet-title" className="text-lg font-semibold mb-4">
          Substituição
        </h2>

        {/* Minuto */}
        <div className="flex items-center gap-3 mb-4">
          <label htmlFor="sub-minute" className="text-sm font-medium">
            Minuto
          </label>
          <input
            id="sub-minute"
            type="number"
            min={0}
            max={120}
            value={minute}
            onChange={(e) =>
              setMinute(Math.min(120, Math.max(0, Number(e.target.value))))
            }
            className="w-20 border rounded-md px-2 py-1 text-sm text-center dark:bg-slate-800 dark:border-slate-700"
          />
        </div>

        {/* Duas colunas: Sai / Entra */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Sai */}
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">
              Sai
            </p>
            {starters.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 py-2">
                Sem jogadores em campo
              </p>
            ) : (
              starters.map((p) => (
                <button
                  key={p.player_id}
                  type="button"
                  onClick={() => setSelectedOut(p.player_id)}
                  aria-pressed={selectedOut === p.player_id}
                  className={`w-full text-left px-3 py-2 rounded-md mb-1 text-sm min-h-[44px] ${
                    selectedOut === p.player_id
                      ? "bg-red-100 dark:bg-red-900/30 border border-red-400"
                      : "bg-slate-100 dark:bg-slate-800"
                  }`}
                >
                  #{p.jersey_number} {p.name}
                </button>
              ))
            )}
          </div>

          {/* Entra */}
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">
              Entra
            </p>
            {bench.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 py-2">
                Sem jogadores no banco
              </p>
            ) : (
              bench.map((p) => (
                <button
                  key={p.player_id}
                  type="button"
                  onClick={() => setSelectedIn(p.player_id)}
                  aria-pressed={selectedIn === p.player_id}
                  className={`w-full text-left px-3 py-2 rounded-md mb-1 text-sm min-h-[44px] ${
                    selectedIn === p.player_id
                      ? "bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-400"
                      : "bg-slate-100 dark:bg-slate-800"
                  }`}
                >
                  #{p.jersey_number} {p.name}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Erro */}
        {error && (
          <div className="p-3 mb-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Botões */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedOut || !selectedIn || isSubmitting}
            className="flex-1 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-md py-2 text-sm font-medium disabled:opacity-50 min-h-[44px]"
          >
            {isSubmitting ? "A registar..." : "Confirmar Substituição"}
          </button>
          <button
            type="button"
            onClick={() => !isSubmitting && onClose()}
            className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 rounded-md bg-slate-100 dark:bg-slate-800 min-h-[44px]"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
