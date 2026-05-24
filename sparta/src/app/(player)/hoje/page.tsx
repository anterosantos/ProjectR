import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getSessionsForClub } from "@/lib/actions/sessions";
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
        <TodayPageContent nextSession={nextSession} userRole={profile.role} />
      </main>
    </>
  );
}
