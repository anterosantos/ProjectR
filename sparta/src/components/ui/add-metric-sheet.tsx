"use client";

import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { DrillDownSheet } from "@/components/ui/drill-down-sheet";
import { CalmConfirmation } from "@/components/ui/calm-confirmation";
import { Button } from "@/components/ui/button";
import { addPlayerMetric } from "@/lib/actions/metrics";
import type { PlayerMetricCreate } from "@/lib/schemas/metrics";

// Local form schema accepts datetime-local format (no timezone suffix)
const MetricFormSchema = z
  .object({
    player_id: z.string().uuid(),
    weight_kg: z.number().min(30, "Mínimo 30 kg").max(150, "Máximo 150 kg").optional(),
    height_cm: z.number().min(100, "Mínimo 100 cm").max(220, "Máximo 220 cm").optional(),
    recorded_at: z.string().min(1, "Data obrigatória"),
  })
  .refine(
    (data) => data.weight_kg !== undefined || data.height_cm !== undefined,
    { message: "Preenche pelo menos peso ou altura", path: ["weight_kg"] }
  );

type MetricFormValues = z.infer<typeof MetricFormSchema>;

interface AddMetricSheetProps {
  playerId: string;
  lastWeight?: number | null;
  lastHeight?: number | null;
  onSuccess?: () => void;
}

export function AddMetricSheet({ playerId, lastWeight, lastHeight, onSuccess }: AddMetricSheetProps) {
  const [open, setOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const defaultRecordedAt = format(new Date(), "yyyy-MM-dd'T'HH:mm");

  const form = useForm<MetricFormValues>({
    resolver: zodResolver(MetricFormSchema),
    defaultValues: {
      player_id: playerId,
      weight_kg: lastWeight ?? undefined,
      height_cm: lastHeight ?? undefined,
      recorded_at: defaultRecordedAt,
    },
  });

  // eslint-disable-next-line
  const handleSubmit = form.handleSubmit(async (data: MetricFormValues) => {
    form.clearErrors("root");

    const metricData: PlayerMetricCreate = {
      player_id: data.player_id,
      weight_kg: data.weight_kg,
      height_cm: data.height_cm,
      recorded_at: new Date(data.recorded_at).toISOString(),
    };

    const result = await addPlayerMetric(metricData);
    if (!isMounted.current) return;

    if (result.ok) {
      setOpen(false);
      setShowSuccess(true);
      form.reset({
        player_id: playerId,
        weight_kg: data.weight_kg,
        height_cm: data.height_cm,
        recorded_at: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      });
      onSuccess?.();
    } else {
      form.setError("root", { message: result.error.message });
    }
  });

  return (
    <>
      {showSuccess && (
        <CalmConfirmation
          message="Leitura registada"
          onDismiss={() => setShowSuccess(false)}
        />
      )}

      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Adicionar leitura
      </Button>

      <DrillDownSheet open={open} onOpenChange={setOpen}>
        <h2 className="text-base font-semibold mb-4">Nova leitura</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Peso (kg)</label>
            <input
              type="number"
              step="0.01"
              min="30"
              max="150"
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="ex: 72.50"
              {...form.register("weight_kg", { valueAsNumber: true })}
            />
            {form.formState.errors.weight_kg && (
              <p className="text-xs text-destructive">
                {form.formState.errors.weight_kg.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Altura (cm)</label>
            <input
              type="number"
              step="0.01"
              min="100"
              max="220"
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="ex: 178.00"
              {...form.register("height_cm", { valueAsNumber: true })}
            />
            {form.formState.errors.height_cm && (
              <p className="text-xs text-destructive">
                {form.formState.errors.height_cm.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Data da leitura</label>
            <input
              type="datetime-local"
              className="w-full rounded border px-3 py-2 text-sm"
              {...form.register("recorded_at")}
            />
            {form.formState.errors.recorded_at && (
              <p className="text-xs text-destructive">
                {form.formState.errors.recorded_at.message}
              </p>
            )}
          </div>

          {form.formState.errors.root && (
            <p className="text-xs text-destructive">
              {form.formState.errors.root.message}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              type="submit"
              className="flex-1"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? "A guardar…" : "Guardar"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </DrillDownSheet>
    </>
  );
}
