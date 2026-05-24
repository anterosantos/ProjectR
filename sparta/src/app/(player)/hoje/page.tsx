import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getSessionsForClub } from "@/lib/actions/sessions";
import { getSessionFatigueStatus } from "@/lib/actions/fatigue";
import { StickyHeader } from "@/components/patterns/StickyHeader";
import { TodayPageContent } from "@/components/app/today-page-content";

export const metadata = { title: "Hoje" };

export default async function HojePage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "player") {
    redirect("/");
  }

  const now = new Date();
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // AC #2 + AC #3 — Query sessões (próxima e recente)
  const [result, recentResult] = await Promise.all([
    getSessionsForClub({
      from: now.toISOString(),
      to: sevenDaysLater.toISOString(),
      status: "scheduled",
    }),
    getSessionsForClub({
      from: twentyFourHoursAgo.toISOString(),
      to: now.toISOString(),
      // Sem filtro de status — aceitar 'scheduled' e 'completed'
    }),
  ]);

  const nextSession = result.ok ? (result.data?.[0] ?? null) : null;

  let recentSession = null;
  if (recentResult.ok && (recentResult.data ?? []).length > 0) {
    // Filtrar para excluir 'cancelled' e sessões com scheduled_at >= now (limite estrito < now)
    // Nota: getSessionsForClub usa lte no limite superior — excluir a fronteira exacta para
    // evitar que uma sessão apareça simultaneamente em "Próxima sessão" e "Sessão recente".
    const nowMs = now.getTime();
    const recentSessions = (recentResult.data ?? []).filter(
      (s) =>
        s.status !== "cancelled" &&
        new Date(s.scheduled_at).getTime() < nowMs
    );
    // Pegar a mais recente (query ordenada ascending — último elemento = mais recente)
    if (recentSessions.length > 0) {
      recentSession = recentSessions[recentSessions.length - 1] ?? null;
    }
  }

  // AC #2 — Chamar getSessionFatigueStatus em paralelo para ambas as sessões
  const [nextFatigueStatus, recentFatigueStatus] = await Promise.all([
    nextSession ? getSessionFatigueStatus(nextSession.id) : Promise.resolve(null),
    recentSession ? getSessionFatigueStatus(recentSession.id) : Promise.resolve(null),
  ]);

  // Derivar props para TodayPageContent
  const nextSessionAnswered = nextFatigueStatus?.ok ? nextFatigueStatus.data.pre : false;
  const recentPostAnswered = recentFatigueStatus?.ok ? recentFatigueStatus.data.post : false;
  const recentPreAnswered = recentFatigueStatus?.ok ? recentFatigueStatus.data.pre : false;

  // AC #3 — "Tudo em dia" se houver sessão recente com AMBAS as fases respondidas
  const allDoneToday =
    recentSession !== null && recentPreAnswered && recentPostAnswered;

  // Secção recente visível apenas se post por responder
  const showRecentSession = recentSession !== null && !recentPostAnswered;

  return (
    <>
      <StickyHeader title="Hoje" />
      <main id="main-content">
        <TodayPageContent
          nextSession={nextSession}
          nextSessionAnswered={nextSessionAnswered}
          recentSession={showRecentSession ? recentSession : null}
          allDoneToday={allDoneToday}
          userRole={profile.role}
        />
      </main>
    </>
  );
}
