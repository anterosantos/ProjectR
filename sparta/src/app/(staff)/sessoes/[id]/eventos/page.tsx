import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getMatchEventsForSession } from "@/lib/actions/events";
import { isEditWindowOpen } from "@/lib/utils/match-events";
import { StickyHeader } from "@/components/patterns/StickyHeader";
import { EventsReviewPanel } from "./events-review-panel";
import { z } from "zod";

export const metadata = { title: "Revisão de eventos" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EventsReviewPage({ params }: PageProps) {
  const { id } = await params;

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
    .select("id, club_id, scheduled_at, duration_min")
    .eq("id", id)
    .eq("club_id", profile.club_id)
    .single();

  if (!session) {
    redirect("/sessoes");
  }

  const { data: settings } = await supabase
    .from("notification_settings")
    .select("event_edit_window_hours")
    .eq("club_id", profile.club_id)
    .maybeSingle();

  const settingsSchema = z.object({ event_edit_window_hours: z.number().int().min(1).max(168) });
  const validSettings = settingsSchema.safeParse(settings);
  const windowHours = validSettings.success ? validSettings.data.event_edit_window_hours : 24;
  const withinWindow = isEditWindowOpen(session.scheduled_at, session.duration_min ?? 90, windowHours);

  const eventsResult = await getMatchEventsForSession(id);
  const events = eventsResult.ok ? eventsResult.data : [];

  return (
    <div className="flex flex-col min-h-screen">
      <StickyHeader title="Revisão de eventos" backHref={`/sessoes/${id}`} />
      <main className="flex-1 p-4">
        <EventsReviewPanel
          events={events}
          sessionId={id}
          isWithinEditWindow={withinWindow}
        />
      </main>
    </div>
  );
}
