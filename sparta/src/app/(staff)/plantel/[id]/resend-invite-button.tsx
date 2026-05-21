"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { resendPlayerInvite } from "@/lib/actions/players";

interface ResendInviteButtonProps {
  playerId: string;
}

export function ResendInviteButton({ playerId }: ResendInviteButtonProps) {
  const [isPending, startTransition] = useTransition();

  async function handleResend() {
    startTransition(async () => {
      const result = await resendPlayerInvite({ playerId });
      if (!result.ok) {
        // Error is displayed via server action error handling
        // The page may show an error message from the server action
        console.error("Failed to resend invite:", result.error.message);
      }
      // Se ok: resendPlayerInvite faz redirect() — componente não continua
    });
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={handleResend}
      disabled={isPending}
    >
      {isPending ? "A reenviar…" : "Re-enviar convite"}
    </Button>
  );
}
