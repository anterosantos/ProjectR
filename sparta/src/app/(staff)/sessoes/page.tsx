import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Calendar } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { getSessionsForClub } from "@/lib/actions/sessions";
import { getCurrentSeason } from "@/lib/actions/seasons";
import { StickyHeader } from "@/components/patterns/StickyHeader";
import { SeasonToggle } from "@/components/patterns/SeasonToggle";
import { SessionTypeFilter } from "@/components/patterns/SessionTypeFilter";
import type { SessionTypeFilterValue } from "@/components/patterns/SessionTypeFilter";
import { EmptyState } from "@/components/ui/empty-state";
import { SessionCard } from "@/components/ui/session-card";
import { Button } from "@/components/ui/button";
import { format, startOfWeek, endOfWeek, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { pt } from "date-fns/locale";
import type { Session } from "@/lib/schemas/sessions";

export const metadata = { title: "Sessões" };

function groupSessionsByWeek(
  sessions: Session[]
): Array<{ weekLabel: string; sessions: Session[]; isCurrentWeek: boolean }> {
  const weekOrder: string[] = [];
  const weekLabels = new Map<string, string>();
  const weekSessions = new Map<string, Session[]>();
  const now = new Date();

  for (const session of sessions) {
    const date = new Date(session.scheduled_at);
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
    const key = weekStart.toISOString();

    if (!weekSessions.has(key)) {
      weekOrder.push(key);
      weekLabels.set(
        key,
        `${format(weekStart, "d MMM", { locale: pt })} – ${format(weekEnd, "d MMM", { locale: pt })}`
      );
      weekSessions.set(key, []);
    }
    weekSessions.get(key)!.push(session);
  }

  return weekOrder.map((key) => {
    const weekStart = new Date(key);
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const isCurrentWeek = isWithinInterval(now, {
      start: startOfDay(weekStart),
      end: endOfDay(weekEnd),
    });
    return {
      weekLabel: weekLabels.get(key) ?? "",
      sessions: weekSessions.get(key) ?? [],
      isCurrentWeek,
    };
  });
}

export default async function SessoesPage({
  searchParams,
}: {
  searchParams?: Promise<{ cumulativo?: string; tipo?: string }>;
}) {
  const params = await searchParams;
  const isCumulative = params?.cumulativo === "true";
  const tipoParam = params?.tipo;

  const activeFilter: SessionTypeFilterValue =
    tipoParam === "training" ? "training"
    : tipoParam === "matches" ? "matches"
    : "all";

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

  if (!profile || profile.role !== "analyst") {
    redirect("/");
  }

  const seasonResult = await getCurrentSeason();
  const seasonId =
    !isCumulative && seasonResult.ok ? (seasonResult.data?.id ?? undefined) : undefined;

  let sessions: Session[];

  if (activeFilter === "matches") {
    const result = await getSessionsForClub(seasonId ? { season_id: seasonId } : undefined);
    if (!result.ok) {
      throw new Error(`Erro ao carregar sessões: ${result.error.message}`);
    }
    sessions = result.data.filter(
      (s) => s.type === "match" || s.type === "friendly"
    );
  } else {
    const result = await getSessionsForClub(
      seasonId
        ? { season_id: seasonId, type: activeFilter === "training" ? "training" : undefined }
        : activeFilter === "training"
          ? { type: "training" }
          : undefined
    );
    if (!result.ok) {
      throw new Error(`Erro ao carregar sessões: ${result.error.message}`);
    }
    sessions = result.data;
  }

  if (isCumulative) {
    sessions = sessions
      .slice()
      .sort(
        (a, b) =>
          new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()
      );
  }

  const weeks = groupSessionsByWeek(sessions);

  return (
    <main id="main-content">
      <StickyHeader title="Sessões" />
      <div className="px-4 py-6 sm:px-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <SeasonToggle isCumulative={isCumulative} />
          <Button asChild variant="primary">
            <Link href="/sessoes/nova">
              <Plus className="mr-1 h-4 w-4" />
              Registar sessão
            </Link>
          </Button>
        </div>

        <SessionTypeFilter activeFilter={activeFilter} />

        {sessions.length === 0 ? (
          <EmptyState
            icon={<Calendar className="h-8 w-8 text-muted-foreground" />}
            title="Sem sessões"
            description="Ainda não há sessões que correspondam ao filtro."
          />
        ) : (
          <div className="space-y-6">
            {weeks.map(({ weekLabel, sessions: weekSessions, isCurrentWeek }) => (
              <section key={weekLabel}>
                <h2
                  className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  {...(isCurrentWeek ? { "aria-current": "date" } : {})}
                >
                  {weekLabel}
                </h2>
                <div className="space-y-2">
                  {weekSessions.map((session) => (
                    <SessionCard key={session.id} session={session} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
