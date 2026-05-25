"use client";

/**
 * error.tsx — Error boundary para /prontidao (Story 1.10 pattern).
 *
 * Mostrado quando getUpcomingSession() ou getReadinessPanelData() lançam excepção.
 */

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ProntidaoError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to error monitoring (future: integrate with logger)
    console.error("[ProntidaoError]", error.message);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <h2 className="text-lg font-semibold text-foreground mb-2">
        Erro ao carregar o painel
      </h2>
      <p className="text-sm text-muted-foreground mb-6">
        Não foi possível carregar os dados de prontidão. Tenta novamente.
      </p>
      <Button variant="primary" onClick={reset}>
        Tentar novamente
      </Button>
    </div>
  );
}
