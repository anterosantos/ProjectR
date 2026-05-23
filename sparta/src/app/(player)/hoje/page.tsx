import { redirect } from "next/navigation";
import { Calendar } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { getSessionsForClub } from "@/lib/actions/sessions";
import { StickyHeader } from "@/components/patterns/StickyHeader";
import { EmptyState } from "@/components/ui/empty-state";
import { SessionCard } from "@/components/ui/session-card";

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

  const result = await getSessionsForClub({
    from: now.toISOString(),
    to: sevenDaysLater.toISOString(),
    status: "scheduled",
  });

  const nextSession = result.ok ? (result.data?.[0] ?? null) : null;

  return (
    <>
      <StickyHeader title="Hoje" />
      <main id="main-content">
        <div className="px-4 py-6 sm:px-6 space-y-4">
          {nextSession ? (
            <>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Próxima sessão
              </h2>
              <SessionCard session={nextSession} userRole={profile.role} />
            </>
          ) : (
            <EmptyState
              icon={<Calendar className="h-8 w-8 text-muted-foreground" />}
              title="Sem sessões nos próximos 7 dias"
              description="Não há sessões agendadas para os próximos 7 dias."
            />
          )}
          {/* TODO Epic 4: CTA questionário de fadiga */}
        </div>
      </main>
    </>
  );
}
