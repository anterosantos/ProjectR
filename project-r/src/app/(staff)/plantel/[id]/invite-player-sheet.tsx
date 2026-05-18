"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle } from "lucide-react";
import { DrillDownSheet } from "@/components/ui/drill-down-sheet";
import { Button } from "@/components/ui/button";
import { InvitePlayerSchema } from "@/lib/schemas/players";
import type { InvitePlayer } from "@/lib/schemas/players";
import { invitePlayer } from "@/lib/actions/players";

interface InvitePlayerSheetProps {
  playerId: string;
  ageGroup: string;
}

export function InvitePlayerSheet({ playerId, ageGroup }: InvitePlayerSheetProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<InvitePlayer>({
    resolver: zodResolver(InvitePlayerSchema),
    defaultValues: { playerId, email: "" },
    mode: "onBlur",
  });

  async function onSubmit(data: InvitePlayer) {
    startTransition(async () => {
      const result = await invitePlayer(data);
      if (!result.ok) {
        if (result.error.code === "email_conflict" || result.error.code === "email_in_use") {
          form.setError("email", { message: result.error.message });
        } else {
          form.setError("root", { message: result.error.message });
        }
      }
      // Se ok: invitePlayer faz redirect() — componente não continua
    });
  }

  const isMinor = ageGroup === "u14" || ageGroup === "u15";

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Convidar jogador
      </Button>

      <DrillDownSheet open={open} onOpenChange={setOpen}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-4 pb-6">
          <h2 className="text-base font-semibold mb-2">Convidar jogador</h2>
          {isMinor && (
            <p className="text-sm text-signal-alert">
              Confirma o consentimento parental antes de convidar jogadores sub-14 ou sub-15.
            </p>
          )}
          <div className="space-y-1">
            <label htmlFor="email" className="block text-sm font-medium">Email do jogador *</label>
            <input
              id="email"
              type="email"
              placeholder="jogador@email.com"
              className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
              {...form.register("email")}
              aria-invalid={!!form.formState.errors.email}
              aria-describedby={form.formState.errors.email ? "email-error" : undefined}
            />
            {form.formState.errors.email && (
              <p id="email-error" className="text-sm text-signal-alert flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {form.formState.errors.email.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              O jogador receberá um email para definir a sua password
            </p>
          </div>

          {form.formState.errors.root && (
            <p className="text-sm text-signal-alert flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {form.formState.errors.root.message}
            </p>
          )}

          <input type="hidden" {...form.register("playerId")} />
          <div className="flex gap-3">
            <Button type="submit" className="flex-1" disabled={isPending}>
              {isPending ? "A enviar…" : "Enviar convite"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
          </div>
        </form>
      </DrillDownSheet>
    </>
  );
}
