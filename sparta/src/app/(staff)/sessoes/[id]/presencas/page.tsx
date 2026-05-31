import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { StickyHeader } from "@/components/patterns/StickyHeader";
import { AttendancePanel } from "./attendance-panel";
import {
  getPlayersForAttendance,
  getSessionAttendances,
} from "@/lib/actions/attendance";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AttendancePage({ params }: PageProps) {
  const { id: sessionId } = await params;

  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, club_id")
    .eq("id", user.id)
    .single();

  if (
    !profile ||
    !profile.club_id ||
    (profile.role !== "coach" && profile.role !== "analyst")
  ) {
    redirect("/login");
  }

  const { data: session } = await supabase
    .from("sessions")
    .select("id, club_id, type, scheduled_at")
    .eq("id", sessionId)
    .eq("club_id", profile.club_id)
    .single();

  if (!session) {
    redirect("/sessoes");
  }

  const [playersResult, attendancesResult] = await Promise.all([
    getPlayersForAttendance(sessionId),
    getSessionAttendances(sessionId),
  ]);

  const players = playersResult.ok ? playersResult.data : [];
  const existingAttendances = attendancesResult.ok
    ? attendancesResult.data
    : [];

  return (
    <main id="main-content" className="flex flex-col min-h-screen">
      <StickyHeader title="Presenças" backHref={`/sessoes/${sessionId}`} />
      <AttendancePanel
        players={players}
        existingAttendances={existingAttendances}
        sessionId={sessionId}
      />
    </main>
  );
}
