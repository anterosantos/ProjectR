"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { DrillDownSheet } from "@/components/ui/drill-down-sheet";
import { Button } from "@/components/ui/button";
import { createSeason, updateSeason } from "@/lib/actions/seasons";
import {
  SeasonCreateSchema,
  SeasonUpdateSchema,
  type Season,
} from "@/lib/schemas/seasons";

// Use z.input<> to match zodResolver's expected input types (handles .default())
type SeasonCreateInput = z.input<typeof SeasonCreateSchema>;
type SeasonUpdateInput = z.input<typeof SeasonUpdateSchema>;

// ─── Create Form ──────────────────────────────────────────────────────────────

interface SeasonFormCreateProps {
  mode: "create";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function SeasonCreateForm({ open, onOpenChange }: SeasonFormCreateProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<SeasonCreateInput>({
    resolver: zodResolver(SeasonCreateSchema),
    defaultValues: { name: "", startDate: "", endDate: "", setAsCurrent: false },
  });

  function onSubmit(data: SeasonCreateInput) {
    startTransition(async () => {
      const result = await createSeason({
        name: data.name,
        startDate: data.startDate,
        endDate: data.endDate,
        setAsCurrent: data.setAsCurrent ?? false,
      });
      if (!result.ok) {
        form.setError("root", { message: result.error.message });
        return;
      }
      onOpenChange(false);
      router.push("/configuracoes/epocas?criada=1");
      router.refresh();
    });
  }

  return (
    <DrillDownSheet open={open} onOpenChange={onOpenChange}>
      <h2 className="text-base font-semibold mb-4">Nova época</h2>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="season-name" className="text-sm font-medium">
            Nome
          </label>
          <input
            id="season-name"
            type="text"
            maxLength={50}
            placeholder="ex: 2026/27"
            className="w-full rounded border px-3 py-2 text-sm"
            {...form.register("name")}
          />
          {form.formState.errors.name && (
            <p className="text-xs text-destructive">
              {form.formState.errors.name.message}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="season-start-date" className="text-sm font-medium">
            Data de início
          </label>
          <input
            id="season-start-date"
            type="date"
            className="w-full rounded border px-3 py-2 text-sm"
            {...form.register("startDate")}
          />
          {form.formState.errors.startDate && (
            <p className="text-xs text-destructive">
              {form.formState.errors.startDate.message}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="season-end-date" className="text-sm font-medium">
            Data de fim
          </label>
          <input
            id="season-end-date"
            type="date"
            className="w-full rounded border px-3 py-2 text-sm"
            {...form.register("endDate")}
          />
          {form.formState.errors.endDate && (
            <p className="text-xs text-destructive">
              {form.formState.errors.endDate.message}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="setAsCurrent"
            className="h-4 w-4"
            {...form.register("setAsCurrent")}
          />
          <label htmlFor="setAsCurrent" className="text-sm">
            Definir como época atual
          </label>
        </div>

        {form.formState.errors.root && (
          <p className="text-xs text-destructive">
            {form.formState.errors.root.message}
          </p>
        )}

        <div className="flex gap-2 pt-2">
          <Button type="submit" className="flex-1" disabled={isPending}>
            {isPending ? "A guardar…" : "Criar época"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </DrillDownSheet>
  );
}

// ─── Edit Form ────────────────────────────────────────────────────────────────

interface SeasonFormEditProps {
  mode: "edit";
  season: Season;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function SeasonEditForm({ open, onOpenChange, season }: SeasonFormEditProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<SeasonUpdateInput>({
    resolver: zodResolver(SeasonUpdateSchema),
    defaultValues: {
      id: season.id,
      name: season.name,
      startDate: season.start_date,
      endDate: season.end_date,
      setAsCurrent: season.is_current,
    },
  });

  function onSubmit(data: SeasonUpdateInput) {
    startTransition(async () => {
      const result = await updateSeason({
        id: data.id,
        name: data.name,
        startDate: data.startDate,
        endDate: data.endDate,
        setAsCurrent: data.setAsCurrent ?? false,
      });
      if (!result.ok) {
        form.setError("root", { message: result.error.message });
        return;
      }
      onOpenChange(false);
      router.push("/configuracoes/epocas?actualizada=1");
      router.refresh();
    });
  }

  return (
    <DrillDownSheet open={open} onOpenChange={onOpenChange}>
      <h2 className="text-base font-semibold mb-4">Editar época</h2>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="season-name" className="text-sm font-medium">
            Nome
          </label>
          <input
            id="season-name"
            type="text"
            maxLength={50}
            placeholder="ex: 2026/27"
            className="w-full rounded border px-3 py-2 text-sm"
            {...form.register("name")}
          />
          {form.formState.errors.name && (
            <p className="text-xs text-destructive">
              {form.formState.errors.name.message}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="season-start-date" className="text-sm font-medium">
            Data de início
          </label>
          <input
            id="season-start-date"
            type="date"
            className="w-full rounded border px-3 py-2 text-sm"
            {...form.register("startDate")}
          />
          {form.formState.errors.startDate && (
            <p className="text-xs text-destructive">
              {form.formState.errors.startDate.message}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="season-end-date" className="text-sm font-medium">
            Data de fim
          </label>
          <input
            id="season-end-date"
            type="date"
            className="w-full rounded border px-3 py-2 text-sm"
            {...form.register("endDate")}
          />
          {form.formState.errors.endDate && (
            <p className="text-xs text-destructive">
              {form.formState.errors.endDate.message}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="setAsCurrent"
            className="h-4 w-4"
            {...form.register("setAsCurrent")}
          />
          <label htmlFor="setAsCurrent" className="text-sm">
            Definir como época atual
          </label>
        </div>

        {form.formState.errors.root && (
          <p className="text-xs text-destructive">
            {form.formState.errors.root.message}
          </p>
        )}

        <div className="flex gap-2 pt-2">
          <Button type="submit" className="flex-1" disabled={isPending}>
            {isPending ? "A guardar…" : "Actualizar"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </DrillDownSheet>
  );
}

// ─── Public Component ─────────────────────────────────────────────────────────

type Props = SeasonFormCreateProps | SeasonFormEditProps;

export function SeasonForm(props: Props) {
  if (props.mode === "edit") {
    return <SeasonEditForm {...props} />;
  }
  return <SeasonCreateForm {...props} />;
}
