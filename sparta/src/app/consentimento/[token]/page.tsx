import type { Metadata } from "next";
import { AlertCircle, CheckCircle, Clock, XCircle } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import {
  getConsentByToken,
  type ConsentTokenResult,
  type ConsentTokenState,
} from "@/lib/actions/consent";
import { ConsentForm } from "./consent-form";

export const metadata: Metadata = { title: "Confirmação de consentimento parental" };

export const dynamic = "force-dynamic";

async function getConsentState(token: string): Promise<ConsentTokenResult> {
  try {
    return await getConsentByToken(token);
  } catch {
    return { state: "invalid" };
  }
}

const STATE_CONFIG: Record<
  Exclude<ConsentTokenState, "valid">,
  { title: string; description: string; icon: React.ReactNode }
> = {
  expired: {
    title: "Link expirado",
    description:
      "O link de consentimento expirou ao fim de 90 dias. Contacte o clube para receber um novo pedido.",
    icon: <Clock className="h-8 w-8 text-muted-foreground" />,
  },
  confirmed: {
    title: "Consentimento já confirmado",
    description:
      "O consentimento parental já foi registado. O seu educando pode aceder à plataforma.",
    icon: <CheckCircle className="h-8 w-8 text-muted-foreground" />,
  },
  withdrawn: {
    title: "Consentimento recusado",
    description:
      "O consentimento foi recusado. O acesso do seu educando permanece bloqueado. Contacte o clube se mudou de ideias.",
    icon: <XCircle className="h-8 w-8 text-muted-foreground" />,
  },
  invalid: {
    title: "Link inválido",
    description:
      "Este link não é válido. Verifique se copiou o link completo do email.",
    icon: <AlertCircle className="h-8 w-8 text-muted-foreground" />,
  },
};

export default async function ConsentimentoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getConsentState(token);

  if (data.state !== "valid") {
    const config = STATE_CONFIG[data.state];
    return (
      <main id="main-content" className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-sm w-full">
          <EmptyState
            icon={config.icon}
            title={config.title}
            description={config.description}
          />
        </div>
      </main>
    );
  }

  return (
    <main id="main-content" className="max-w-prose mx-auto px-4 py-8">
      <ConsentForm
        token={token}
        playerName={data.playerName ?? "o seu educando"}
        policyBody={data.policyBody ?? ""}
        tokenExpiresAt={data.tokenExpiresAt}
      />
    </main>
  );
}
