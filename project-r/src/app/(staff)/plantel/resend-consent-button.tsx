"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { resendConsentEmail } from "@/lib/actions/consent";

export function ResendConsentButton({ playerId }: { playerId: string }) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  function handleClick() {
    setFeedback(null);
    startTransition(async () => {
      const result = await resendConsentEmail(playerId);
      if (result.ok) {
        setFeedback({ type: "success", message: "Email reenviado" });
      } else {
        const msg =
          result.error.code === "rate_limited"
            ? result.error.message
            : "Falha ao reenviar — tenta novamente";
        setFeedback({ type: "error", message: msg });
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="ghost"
        onClick={handleClick}
        disabled={isPending}
        aria-busy={isPending}
      >
        {isPending ? "A enviar…" : "Reenviar manualmente"}
      </Button>
      {feedback && (
        <span
          role="status"
          className={
            feedback.type === "success"
              ? "text-xs text-signal-ok"
              : "text-xs text-signal-alert"
          }
        >
          {feedback.message}
        </span>
      )}
    </div>
  );
}
