import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Calendar } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { getSessionsForClub } from "@/lib/actions/sessions";
import { getCurrentSeason } from "@/lib/actions/seasons";
import { StickyHeader } from "@/components/patterns/StickyHeader";
import { SeasonToggle } from "@/components/patterns/SeasonToggle";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { CalendarViewToggle } from "@/components/ui/calendar-view-toggle";
import { CalendarWeekView } from "@/components/ui/calendar-week-view";
import { CalendarMonthView } from "@/components/ui/calendar-month-view";
import {
  format,
  startOfWeek,

  startOfDay,
  endOfDay,
  addDays,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { pt } from "date-fns/locale";
import type { Session } from "@/lib/schemas/sessions";

export const metadata = { title: "Calendário" };

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams?: Promise<{ cumulativo?: string; vista?: string }>;
}) {
  const params = await searchParams;
  const isCumulative = params?.cumulativo === "true";
  const vista = params?.vista === "mes" ? "mes" : "semana";

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

  if (!profile || !["coach", "analyst"].includes(profile.role ?? "")) {
    redirect("/");
  }

  let sessions: Session[];

  if (isCumulative) {
    const result = await getSessionsForClub();
    if (!result.ok) {
      throw new Error(`Erro ao carregar sessões: ${result.error.message}`);
    }
    sessions = result.data
      .slice()
      .sort(
        (a, b) =>
          new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()
      );
  } else {
    const seasonResult = await getCurrentSeason();
    const seasonId = seasonResult.ok ? (seasonResult.data?.id ?? undefined) : undefined;

    const result = await getSessionsForClub(seasonId ? { season_id: seasonId } : undefined);
    if (!result.ok) {
      throw new Error(`Erro ao carregar sessões: ${result.error.message}`);
    }
    sessions = result.data;
  }

  const isCoach = profile.role === "coach";
  const today = new Date();

  // Week data for DayChipStrip
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);
    const daySessions = sessions.filter((s) => {
      const d = new Date(s.scheduled_at);
      return d >= dayStart && d <= dayEnd;
    });
    return { date: date.toISOString(), sessions: daySessions };
  });

  // Next 7 days sessions
  const next7End = addDays(today, 7);
  const next7Sessions = sessions
    .filter((s) => {
      const d = new Date(s.scheduled_at);
      return d >= startOfDay(today) && d <= endOfDay(next7End);
    })
    .sort(
      (a, b) =>
        new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
    );

  // Month data for MonthGrid
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const monthSessions = sessions.filter((s) => {
    const d = new Date(s.scheduled_at);
    return d >= monthStart && d <= monthEnd;
  });

  const monthLabel = format(today, "MMMM yyyy", { locale: pt });

  return (
    <main id="main-content">
      <StickyHeader title="Calendário" />
      <div className="px-4 py-6 sm:px-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <SeasonToggle isCumulative={isCumulative} />
          <CalendarViewToggle />
          {isCoach && (
            <Button asChild variant="primary">
              <Link href="/calendario/nova">
                <Plus className="mr-1 h-4 w-4" />
                Nova sessão
              </Link>
            </Button>
          )}
        </div>

        {sessions.length === 0 ? (
          <EmptyState
            icon={<Calendar className="h-8 w-8 text-muted-foreground" />}
            title="Sem sessões"
            description={
              isCoach
                ? "Crie a primeira sessão para começar o calendário."
                : "Ainda não há sessões agendadas."
            }
          />
        ) : vista === "semana" ? (
          <CalendarWeekView
            weekDays={weekDays}
            next7Sessions={next7Sessions}
            isCoach={isCoach}
          />
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-mono uppercase text-ink-3 capitalize">{monthLabel}</p>
            <CalendarMonthView
              monthSessions={monthSessions}
              next7Sessions={next7Sessions}
              month={monthStart.toISOString()}
            />
          </div>
        )}
      </div>
    </main>
  );
}
