/**
 * Página do questionário de fadiga — Story 4.2
 *
 * Rota: /questionario/[sessionId]/[phase]
 * Grupo: (player) — herda layout com BottomTabNav
 *
 * Nota sobre params: Next.js 15 usa Promise<Params> — sempre await params.
 * Ver AGENTS.md ("This is NOT the Next.js you know").
 *
 * Nota sobre <main id="main-content">: o layout (player) já envolve em
 * <main id="main-content">. A página de /hoje replica este padrão (nested main)
 * por quirk histórico — seguimos o mesmo para consistência. Não corrigir em 4.2.
 *
 * Nota de simplificação (Story 4.2): só verifica status='scheduled'.
 * A janela temporal X/Y minutos pré/pós sessão será implementada em Story 4.8.
 */

import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getSessionById } from "@/lib/actions/sessions";
import { FatigueQuestionnaire } from "@/components/ui/fatigue-questionnaire";
import { StickyHeader } from "@/components/patterns/StickyHeader";

type Params = { sessionId: string; phase: string };

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function QuestionarioPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { sessionId, phase } = await params;

  // Guard: phase (AC #1)
  if (phase !== "pre" && phase !== "post") redirect("/hoje");

  // Guard: UUID format (AC #1)
  if (!UUID_REGEX.test(sessionId)) redirect("/hoje");

  // Autenticação
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Verificar role de player (AC #1)
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "player") redirect("/hoje");

  // Obter registo do jogador (AC #1)
  // Usa o cliente regular — RLS permite ao jogador ler os seus próprios dados
  // (mesmo padrão de Story 4.1 / submitFatigueResponse)
  const { data: player } = await supabase
    .from("players")
    .select("id, age_group")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!player) redirect("/hoje");

  // Derivar grupo etário para adaptação linguística (Story 4.3, AC #1)
  // u14 ou u15 → versão simplificada sub-14; qualquer outro → senior
  const ageGroup: "senior" | "u14" =
    player.age_group === "u14" || player.age_group === "u15" ? "u14" : "senior";

  // Verificar sessão: existe, pertence ao clube, status='scheduled' (AC #1)
  const sessionResult = await getSessionById(sessionId);
  if (!sessionResult.ok) {
    console.error("[questionario] getSessionById failed:", sessionResult.error);
    redirect("/hoje");
  }
  if (sessionResult.data.status !== "scheduled") {
    console.error("[questionario] session status is not 'scheduled':", sessionResult.data.status);
    redirect("/hoje");
  }
  const session = sessionResult.data;

  return (
    <>
      <StickyHeader title="Questionário de fadiga" backHref="/hoje" />
      <main id="main-content">
        <div className="px-4 py-6 sm:px-6">
          <FatigueQuestionnaire
            sessionId={sessionId}
            sessionType={session.type}
            sessionDate={session.scheduled_at}
            phase={phase as "pre" | "post"}
            playerId={player.id}
            ageGroup={ageGroup}
          />
        </div>
      </main>
    </>
  );
}
