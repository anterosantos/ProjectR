"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { disableMFAAction } from "@/app/configuracoes/seguranca/actions";

const disableSchema = z.object({
  password: z.string().min(1, "Password obrigatória"),
});

type DisableFormData = z.infer<typeof disableSchema>;

interface MFAStatusProps {
  factorId: string;
  onDisabled: () => void;
}

type View = "status" | "confirm";

export function MFAStatus({ factorId, onDisabled }: MFAStatusProps) {
  const [view, setView] = useState<View>("status");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DisableFormData>({
    resolver: zodResolver(disableSchema),
  });

  const handleDisable = async (values: DisableFormData) => {
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await disableMFAAction(values.password, factorId);
      if (!result.success) {
        setError(result.error ?? "Erro ao desativar MFA.");
        return;
      }
      setSuccess(true);
      reset();
      setTimeout(() => {
        onDisabled();
      }, 1500);
    } catch {
      setError("Erro inesperado. Tenta novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <Alert variant="success">
        <AlertDescription>MFA desativado com sucesso</AlertDescription>
      </Alert>
    );
  }

  if (view === "confirm") {
    return (
      <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm text-gray-700">
          Para desativar o MFA, confirma a tua password atual.
        </p>
        <form onSubmit={handleSubmit(handleDisable)} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div>
            <label
              htmlFor="disable-password"
              className="block text-sm font-medium text-gray-700"
            >
              Password atual
            </label>
            <input
              id="disable-password"
              type="password"
              autoComplete="current-password"
              {...register("password")}
              className="mt-1 block w-full appearance-none rounded-lg border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
              disabled={isSubmitting}
              aria-describedby={errors.password ? "disable-pwd-error" : undefined}
            />
            {errors.password && (
              <p id="disable-pwd-error" className="mt-1 text-xs text-red-600">
                {errors.password.message}
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <Button type="submit" variant="destructive" disabled={isSubmitting}>
              {isSubmitting ? "A desativar..." : "Confirmar desativação"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={isSubmitting}
              onClick={() => {
                setView("status");
                setError(null);
                reset();
              }}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
          Ativo
        </span>
        <span className="text-sm text-gray-700">
          Autenticação multi-fator ativada
        </span>
      </div>
      <Button
        variant="ghost"
        onClick={() => setView("confirm")}
      >
        Desativar MFA
      </Button>
    </div>
  );
}
