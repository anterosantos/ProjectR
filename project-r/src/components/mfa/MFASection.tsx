"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MFAEnrollment } from "./MFAEnrollment";
import { MFAStatus } from "./MFAStatus";

interface ActiveFactor {
  id: string;
}

type MFAState =
  | { kind: "loading" }
  | { kind: "not-enrolled" }
  | { kind: "enrolled"; factor: ActiveFactor }
  | { kind: "error" };

async function fetchMFAState(): Promise<MFAState> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) return { kind: "error" };
    const verified = data?.totp?.find((f) => f.status === "verified") ?? null;
    if (verified) {
      return { kind: "enrolled", factor: { id: verified.id } };
    }
    return { kind: "not-enrolled" };
  } catch {
    return { kind: "error" };
  }
}

export function MFASection() {
  const [state, setState] = useState<MFAState>({ kind: "loading" });

  useEffect(() => {
    fetchMFAState().then(setState);
  }, []);

  const reload = () => {
    setState({ kind: "loading" });
    fetchMFAState().then(setState);
  };

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">
        Autenticação Multi-Fator (MFA)
      </h2>
      <p className="text-sm text-gray-600">
        Protege a tua conta com um segundo fator de autenticação (TOTP).
        Precisarás de uma aplicação como Google Authenticator, Authy ou Microsoft
        Authenticator.
      </p>

      {state.kind === "loading" && (
        <p className="text-sm text-gray-400">A verificar estado do MFA...</p>
      )}

      {state.kind === "error" && (
        <p className="text-sm text-red-600">
          Não foi possível verificar o estado do MFA. Recarrega a página.
        </p>
      )}

      {state.kind === "not-enrolled" && (
        <MFAEnrollment onSuccess={reload} />
      )}

      {state.kind === "enrolled" && (
        <MFAStatus factorId={state.factor.id} onDisabled={reload} />
      )}
    </section>
  );
}
