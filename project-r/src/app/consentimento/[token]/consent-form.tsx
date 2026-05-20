"use client";

import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { submitConsentDecision } from "./actions";

interface Props {
  token: string;
  playerName: string;
  policyBody: string;
  tokenExpiresAt?: string;
}

export function ConsentForm({ token, playerName, policyBody, tokenExpiresAt }: Props) {
  const expiresAt = tokenExpiresAt
    ? new Date(tokenExpiresAt).toLocaleDateString("pt-PT")
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Pedido de consentimento parental</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Para autorizar o acesso de <strong>{playerName}</strong> à plataforma, leia a política
          abaixo e confirme o seu consentimento.
        </p>
        {expiresAt && (
          <p className="text-xs text-muted-foreground mt-1">
            Este link é válido até {expiresAt}.
          </p>
        )}
      </div>

      <div className="prose prose-sm max-w-none border rounded-md p-4 max-h-96 overflow-y-auto bg-surface">
        <ReactMarkdown>{policyBody}</ReactMarkdown>
      </div>

      <form action={submitConsentDecision} className="flex flex-col gap-3">
        <input type="hidden" name="token" value={token} />
        <Button type="submit" name="action" value="confirm" className="w-full">
          Confirmo o consentimento
        </Button>
        <Button
          type="submit"
          name="action"
          value="withdraw"
          variant="ghost"
          className="w-full"
        >
          Recusar
        </Button>
      </form>
    </div>
  );
}
