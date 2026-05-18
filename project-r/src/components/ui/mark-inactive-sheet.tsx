"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DrillDownSheet } from "@/components/ui/drill-down-sheet";
import { Button } from "@/components/ui/button";
import { markPlayerInactive } from "@/lib/actions/players";
import { MarkInactiveSchema, type MarkInactive } from "@/lib/schemas/players";

interface MarkInactiveSheetProps {
  playerId: string;
  playerName: string;
}

export function MarkInactiveSheet({ playerId, playerName }: MarkInactiveSheetProps) {
  const [open, setOpen] = useState(false);

  const form = useForm<MarkInactive>({
    resolver: zodResolver(MarkInactiveSchema),
    defaultValues: { playerId, inactive_reason: "" },
  });

  async function onSubmit(data: MarkInactive) {
    const result = await markPlayerInactive({
      ...data,
      inactive_reason: data.inactive_reason || undefined,
    });
    if (!result.ok) {
      form.setError("root", { message: result.error.message });
    }
    // On success: markPlayerInactive calls redirect("/plantel")
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Marcar inactivo
      </Button>

      <DrillDownSheet open={open} onOpenChange={setOpen}>
        <h2 className="text-base font-semibold mb-4">Marcar {playerName} como inactivo</h2>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Motivo (opcional)</label>
            <textarea
              rows={3}
              maxLength={200}
              className="w-full rounded border px-3 py-2 text-sm resize-none"
              placeholder="ex: lesão no joelho, retorno previsto em Jun"
              {...form.register("inactive_reason")}
            />
            {form.formState.errors.inactive_reason && (
              <p className="text-xs text-destructive">
                {form.formState.errors.inactive_reason.message}
              </p>
            )}
          </div>

          {form.formState.errors.root && (
            <p className="text-xs text-destructive">{form.formState.errors.root.message}</p>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "A guardar…" : "Confirmar"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      </DrillDownSheet>
    </>
  );
}
