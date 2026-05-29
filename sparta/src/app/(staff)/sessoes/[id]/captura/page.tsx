import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MatchEventCapture } from "@/components/domain/match-event-capture/match-event-capture";
import { requireStaffRole } from "@/lib/actions/auth";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function MatchCapturePage({ params }: PageProps) {
  const { id: sessionId } = await params;

  // Require staff role (coach/analyst)
  const authResult = await requireStaffRole();
  if (!authResult.ok) {
    redirect("/login");
  }

  // Verify session exists and belongs to the club
  const supabase = await createServerClient();
  const { data: session, error } = await supabase
    .from("sessions")
    .select("id, club_id, type")
    .eq("id", sessionId)
    .eq("club_id", authResult.data.clubId)
    .single();

  if (error || !session) {
    redirect("/sessoes");
  }

  // Render the match event capture UI
  return (
    <div className="w-full h-screen">
      <MatchEventCapture sessionId={sessionId} />
    </div>
  );
}
