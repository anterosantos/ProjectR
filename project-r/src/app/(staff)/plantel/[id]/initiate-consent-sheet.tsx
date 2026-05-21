"use client";

import { useState, useTransition } from "react";
import { AlertCircle } from "lucide-react";
import { DrillDownSheet } from "@/components/ui/drill-down-sheet";
import { Button } from "@/components/ui/button";
import { initiateParentalConsent } from "@/lib/actions/consent";

interface InitiateConsentSheetProps {
  playerId: string;
}

export function InitiateConsentSheet({ playerId }: InitiateConsentSheetProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await initiateParentalConsent({ playerId, parentEmail: email });
      if (result.ok) {
        setSuccess(true);
        setTimeout(() => {
          setOpen(false);
          window.location.reload();
        }, 1500);
      } else {
        setError(result.error.message);
      }
    });
  }

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Iniciar consentimento
      </Button>

      <DrillDownSheet open={open} onOpenChange={setOpen}>
        <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-6">
          <h2 className="text-base font-semibold mb-2">Consentimento parental RGPD</h2>
          <p className="text-sm text-muted-foreground">
            Será enviado um email ao encarregado de educação com um link para dar o consentimento.
          </p>
          <div className="space-y-1">
            <label htmlFor="parent-email" className="block text-sm font-medium">
              Email do encarregado de educação *
            </label>
            <input
              id="parent-email"
              type="email"
              required
              placeholder="encarregado@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
              aria-invalid={!!error}
            />
          </div>

          {error && (
            <p className="text-sm text-signal-alert flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {error}
            </p>
          )}
          {success && (
            <p className="text-sm text-signal-ok">Email de consentimento enviado.</p>
          )}

          <div className="flex gap-3">
            <Button type="submit" className="flex-1" disabled={isPending || success}>
              {isPending ? "A enviar…" : "Enviar pedido"}
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
