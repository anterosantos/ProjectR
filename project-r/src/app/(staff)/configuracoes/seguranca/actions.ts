"use server";

import { createServerClient } from "@/lib/supabase/server";

export async function disableMFAAction(
  password: string,
  factorId: string
): Promise<{ success: boolean; error?: string }> {
  if (!password) {
    return { success: false, error: "Password obrigatória" };
  }
  if (!factorId) {
    return { success: false, error: "Fator MFA inválido" };
  }

  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { success: false, error: "Sessão inválida" };
  }

  // Re-authenticate to confirm identity before disabling MFA
  const { error: reAuthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  });

  if (reAuthError) {
    // Return generic message to avoid leaking whether the error was auth vs other
    return { success: false, error: "Password incorreta" };
  }

  const { error: unenrollError } = await supabase.auth.mfa.unenroll({
    factorId,
  });

  if (unenrollError) {
    return { success: false, error: "Falha ao desativar MFA. Tenta novamente." };
  }

  return { success: true };
}
