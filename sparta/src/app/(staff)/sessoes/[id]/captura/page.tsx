import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MatchEventCapture } from "@/components/domain/match-event-capture/match-event-capture";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function MatchCapturePage({ params }: PageProps) {
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

  // Verify session exists and belongs to the club
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, club_id, type")
    .eq("id", sessionId)
    .eq("club_id", profile.club_id)
    .single();

  if (sessionError || !session) {
    redirect("/sessoes");
  }

  return (
    <div className="w-full h-screen">
      <MatchEventCapture sessionId={sessionId} />
    </div>
  );
}
