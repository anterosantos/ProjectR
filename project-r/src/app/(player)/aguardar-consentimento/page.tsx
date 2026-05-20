import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getPlayerConsentStatus } from "@/lib/actions/consent";
import { maskEmail } from "@/lib/utils/mask-email";
import { ResendButton } from "./resend-button";

export const metadata: Metadata = { title: "A aguardar consentimento" };

export default async function AguardarConsentimentoPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const consent = await getPlayerConsentStatus(user.id);
  if (!consent || consent.status !== "pending") redirect("/hoje");

  const expiresDate = new Date(consent.token_expires_at);
  const expiresAt = isNaN(expiresDate.getTime())
    ? "data inválida"
    : expiresDate.toLocaleDateString("pt-PT");

  const parentEmailMasked = consent.parent_email
    ? maskEmail(consent.parent_email)
    : "email não disponível";

  return (
    <main id="main-content" className="flex flex-col items-center justify-center min-h-screen gap-6 px-4">
      <div className="max-w-sm w-full space-y-4 text-center">
        <h1 className="text-xl font-semibold">A aguardar consentimento</h1>
        <p className="text-sm text-muted-foreground">
          O teu encarregado de educação ainda precisa de confirmar os teus dados.
        </p>
        <p className="text-sm">
          Foi enviado um email para{" "}
          <span className="font-medium">{parentEmailMasked}</span>.
        </p>
        <p className="text-xs text-muted-foreground">
          O link de confirmação é válido até {expiresAt}.
        </p>
        <ResendButton />
      </div>
    </main>
  );
}
