import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Calendar } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { getSessionsForClub } from "@/lib/actions/sessions";
import { StickyHeader } from "@/components/patterns/StickyHeader";
import { EmptyState } from "@/components/ui/empty-state";
import { SessionCard } from "@/components/ui/session-card";
import { Button } from "@/components/ui/button";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { pt } from "date-fns/locale";
import type { Session } from "@/lib/schemas/sessions";

export const metadata = { title: "Calendário" };

function groupSessionsByWeek(
  sessions: Session[]
): Array<{ weekLabel: string; sessions: Session[] }> {
  const weekOrder: string[] = [];
  const weekLabels = new Map<string, string>();
  const weekSessions = new Map<string, Session[]>();

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

  return weekOrder.map((key) => ({
    weekLabel: weekLabels.get(key) ?? "",
    sessions: weekSessions.get(key) ?? [],
  }));
}

export default async function CalendarioPage() {
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

  const result = await getSessionsForClub();
  if (!result.ok) {
    throw new Error(`Erro ao carregar sessões: ${result.error.message}`);
  }

  const sessions = result.data;
  const isCoach = profile.role === "coach";
  const weeks = groupSessionsByWeek(sessions);

  return (
    <main id="main-content">
      <StickyHeader title="Calendário" />
      <div className="px-4 py-6 sm:px-6 space-y-6">
        {isCoach && (
          <div className="flex justify-end">
            <Button asChild variant="primary">
              <Link href="/calendario/nova">
                <Plus className="mr-1 h-4 w-4" />
                Nova sessão
              </Link>
            </Button>
          </div>
        )}

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
        ) : (
          <div className="space-y-6">
            {weeks.map(({ weekLabel, sessions: weekSessions }) => (
              <section key={weekLabel}>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
