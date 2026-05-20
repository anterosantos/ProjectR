"use client";

import { useState } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { AlertCircle, Plus, Trash2, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlayerCreateSchema, POSITIONS, AGE_GROUPS } from "@/lib/schemas/players";
import type { PlayerCreate } from "@/lib/schemas/players";
import { createPlayer } from "@/lib/actions/players";

const AGE_GROUP_LABELS: Record<string, string> = {
  u14: "Sub-14",
  u15: "Sub-15",
  u17: "Sub-17",
  u19: "Sub-19",
  senior: "Sénior",
};

export default function NovoJogadorPage() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const form = useForm<PlayerCreate>({
    resolver: zodResolver(PlayerCreateSchema),
    mode: "onBlur",
    defaultValues: {
      fullName: "",
      birthdate: "",
      jerseyNum: undefined,
      ageGroup: undefined,
      positions: [{ position: "", isPrimary: true, sortOrder: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "positions",
  });

  const watchedAgeGroup = useWatch({ control: form.control, name: "ageGroup" });
  const showParentEmail = watchedAgeGroup === "u14" || watchedAgeGroup === "u15";

  const errors = form.formState.errors;

  async function onSubmit(data: PlayerCreate) {
    setServerError(null);
    setIsPending(true);
    try {
      const result = await createPlayer(data);
      if (!result.ok) {
        if (result.error.code === "conflict") {
          form.setError("jerseyNum", {
            message: "Camisola já usada neste clube",
          });
        } else {
          setServerError(result.error.message);
        }
        setIsPending(false);
      }
      // On success: createPlayer calls redirect() — component unmounts
    } catch {
      setServerError("Erro inesperado. Tenta novamente.");
      setIsPending(false);
    }
  }

  return (
    <div className="px-4 py-6 sm:px-6 max-w-lg">
      <div className="mb-6 flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/plantel">
            <ChevronLeft className="h-4 w-4" />
            Plantel
          </Link>
        </Button>
        <h1 className="text-xl font-semibold text-foreground">Novo Jogador</h1>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-5">
        {serverError && (
          <div className="flex items-start gap-2 rounded-lg border border-signal-alert/30 bg-signal-alert/5 px-3 py-2 text-sm text-signal-alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {serverError}
          </div>
        )}

        {/* Nome completo */}
        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-foreground mb-1">
            Nome completo <span aria-hidden="true">*</span>
          </label>
          <input
            id="fullName"
            type="text"
            autoComplete="name"
            aria-describedby={errors.fullName ? "fullName-error" : undefined}
            aria-invalid={!!errors.fullName}
            {...form.register("fullName")}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 aria-invalid:border-signal-alert"
            placeholder="Ex: João Silva"
            disabled={isPending}
          />
          {errors.fullName && (
            <p id="fullName-error" className="mt-1 flex items-center gap-1 text-xs text-signal-alert">
              <AlertCircle className="h-3 w-3" />
              {errors.fullName.message}
            </p>
          )}
        </div>

        {/* Data de nascimento */}
        <div>
          <label htmlFor="birthdate" className="block text-sm font-medium text-foreground mb-1">
            Data de nascimento <span aria-hidden="true">*</span>
          </label>
          <input
            id="birthdate"
            type="date"
            aria-describedby={errors.birthdate ? "birthdate-error" : undefined}
            aria-invalid={!!errors.birthdate}
            {...form.register("birthdate")}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 aria-invalid:border-signal-alert"
            disabled={isPending}
          />
          {errors.birthdate && (
            <p id="birthdate-error" className="mt-1 flex items-center gap-1 text-xs text-signal-alert">
              <AlertCircle className="h-3 w-3" />
              {errors.birthdate.message}
            </p>
          )}
        </div>

        {/* Camisola */}
        <div>
          <label htmlFor="jerseyNum" className="block text-sm font-medium text-foreground mb-1">
            Número de camisola <span aria-hidden="true">*</span>
          </label>
          <input
            id="jerseyNum"
            type="number"
            min="1"
            max="99"
            aria-describedby={errors.jerseyNum ? "jerseyNum-error" : undefined}
            aria-invalid={!!errors.jerseyNum}
            {...form.register("jerseyNum", { valueAsNumber: true })}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 aria-invalid:border-signal-alert"
            placeholder="Ex: 10"
            disabled={isPending}
          />
          {errors.jerseyNum && (
            <p id="jerseyNum-error" className="mt-1 flex items-center gap-1 text-xs text-signal-alert">
              <AlertCircle className="h-3 w-3" />
              {errors.jerseyNum.message}
            </p>
          )}
        </div>

        {/* Escalão */}
        <div>
          <label htmlFor="ageGroup" className="block text-sm font-medium text-foreground mb-1">
            Escalão <span aria-hidden="true">*</span>
          </label>
          <select
            id="ageGroup"
            aria-describedby={errors.ageGroup ? "ageGroup-error" : undefined}
            aria-invalid={!!errors.ageGroup}
            {...form.register("ageGroup")}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 aria-invalid:border-signal-alert"
            disabled={isPending}
          >
            <option value="">Seleccionar escalão</option>
            {AGE_GROUPS.map((g) => (
              <option key={g} value={g}>
                {AGE_GROUP_LABELS[g] ?? g}
              </option>
            ))}
          </select>
          {errors.ageGroup && (
            <p id="ageGroup-error" className="mt-1 flex items-center gap-1 text-xs text-signal-alert">
              <AlertCircle className="h-3 w-3" />
              {errors.ageGroup.message}
            </p>
          )}
        </div>

        {/* Email do Encarregado de Educação (apenas para u14/u15) */}
        {showParentEmail && (
          <div>
            <label htmlFor="parentEmail" className="block text-sm font-medium text-foreground mb-1">
              Email do Encarregado de Educação
            </label>
            <input
              id="parentEmail"
              type="email"
              autoComplete="email"
              aria-describedby={errors.parentEmail ? "parentEmail-error" : "parentEmail-desc"}
              aria-invalid={!!errors.parentEmail}
              {...form.register("parentEmail")}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 aria-invalid:border-signal-alert"
              placeholder="Ex: encarregado@mail.com"
              disabled={isPending}
            />
            <p id="parentEmail-desc" className="mt-1 text-xs text-muted-foreground">
              Necessário para iniciar o consentimento parental RGPD.
            </p>
            {errors.parentEmail && (
              <p id="parentEmail-error" className="mt-1 flex items-center gap-1 text-xs text-signal-alert">
                <AlertCircle className="h-3 w-3" />
                {errors.parentEmail.message}
              </p>
            )}
          </div>
        )}

        {/* Posições */}
        <div>
          <p className="block text-sm font-medium text-foreground mb-2">
            Posições <span aria-hidden="true">*</span>
          </p>
          <div className="space-y-2">
            {fields.map((field, index) => {
              const positionError = errors.positions?.[index]?.position;
              return (
                <div key={field.id} className="flex items-center gap-2">
                  <div className="flex-1">
                    <select
                      aria-label={index === 0 ? "Posição primária" : `Posição alternativa ${index}`}
                      aria-invalid={!!positionError}
                      {...form.register(`positions.${index}.position`)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 aria-invalid:border-signal-alert"
                      disabled={isPending}
                    >
                      <option value="">
                        {index === 0 ? "Posição primária" : "Posição alternativa"}
                      </option>
                      {POSITIONS.map((pos) => (
                        <option key={pos} value={pos}>
                          {pos}
                        </option>
                      ))}
                    </select>
                    {positionError && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-signal-alert">
                        <AlertCircle className="h-3 w-3" />
                        {positionError.message}
                      </p>
                    )}
                  </div>
                  {index === 0 ? (
                    <span className="text-xs text-muted-foreground w-16 text-center">Primária</span>
                  ) : (
                    <button
                      type="button"
                      aria-label={`Remover posição alternativa ${index}`}
                      onClick={() => remove(index)}
                      disabled={isPending}
                      className="p-2 text-muted-foreground hover:text-signal-alert transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {fields.length < 5 && (
            <button
              type="button"
              onClick={() =>
                append({ position: "", isPrimary: false, sortOrder: fields.length })
              }
              disabled={isPending}
              className="mt-2 flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Adicionar posição alternativa
            </button>
          )}

          {errors.positions && !Array.isArray(errors.positions) && (
            <p className="mt-1 flex items-center gap-1 text-xs text-signal-alert">
              <AlertCircle className="h-3 w-3" />
              {errors.positions.message ?? errors.positions.root?.message}
            </p>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={isPending} className="flex-1">
            {isPending ? "A guardar..." : "Adicionar jogador"}
          </Button>
          <Button asChild variant="ghost" disabled={isPending}>
            <Link href="/plantel">Cancelar</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
