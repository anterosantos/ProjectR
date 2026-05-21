import type { Metadata } from "next";
import { createServerClient } from "@/lib/supabase/server";
import { PolicyContent } from "./policy-content";

export const metadata: Metadata = {
  title: "Política de Privacidade",
};

export default async function PoliticaPrivacidadePage() {
  const supabase = await createServerClient();

  const { data: policy } = await supabase
    .from("privacy_policies")
    .select("body_full_md, body_u14_md")
    .eq("is_current", true)
    .single();

  if (!policy) {
    return (
      <main id="main-content" className="max-w-prose mx-auto px-4 py-8">
        <p className="text-muted-foreground">
          Política de privacidade não disponível.
        </p>
      </main>
    );
  }

  // Detetar se jogador sub-14/sub-15
  let isU14 = false;
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("age_group")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (!playerError && (player?.age_group === "u14" || player?.age_group === "u15")) {
      isU14 = true;
    }
  }

  const content = isU14 ? policy.body_u14_md : policy.body_full_md;

  return (
    <main id="main-content" className="max-w-prose mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-6">Política de Privacidade</h1>
      <PolicyContent content={content} isU14={isU14} />
    </main>
  );
}
