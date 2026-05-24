import { createClient } from "@supabase/supabase-js";

const handler = async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  console.log("[schedule-session-pushes] env check:", {
    hasSupabaseUrl: !!supabaseUrl,
    hasServiceRoleKey: !!serviceRoleKey,
  });

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: "Missing environment variables" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Query sessions scheduled within 24h from now
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const { data: sessions, error: sessionsError } = await supabase
      .from("sessions")
      .select("id, club_id, scheduled_at, duration_min")
      .eq("status", "scheduled")
      .gte("scheduled_at", now.toISOString())
      .lte("scheduled_at", tomorrow.toISOString());

    if (sessionsError) {
      console.error("[schedule-session-pushes] sessions query failed:", sessionsError);
      return new Response(
        JSON.stringify({ error: "Failed to query sessions", details: sessionsError }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("[schedule-session-pushes] found sessions:", sessions?.length ?? 0);

    let totalEnqueued = 0;
    let totalSkipped = 0;

    // Process each session
    if (sessions && sessions.length > 0) {
      for (const session of sessions) {
        // Fetch notification settings for this club
        const { data: settings, error: settingsError } = await supabase
          .from("notification_settings")
          .select("pre_minutes, post_minutes, is_enabled")
          .eq("club_id", session.club_id)
          .single();

        if (settingsError && settingsError.code !== "PGRST116") {
          console.warn(
            `[schedule-session-pushes] settings fetch failed for club ${session.club_id}:`,
            settingsError
          );
          continue;
        }

        // Default settings if not found
        const preMinutes = settings?.pre_minutes ?? 30;
        const postMinutes = settings?.post_minutes ?? 30;
        const isEnabled = settings?.is_enabled ?? true;

        if (!isEnabled) {
          console.log(`[schedule-session-pushes] notifications disabled for club ${session.club_id}`);
          continue;
        }

        // Query all active, non-restricted players with active subscriptions in this club
        const { data: subscriptions, error: subsError } = await supabase
          .from("push_subscriptions")
          .select(
            `
            id,
            profile_id,
            is_active,
            profiles!inner(
              id,
              club_id
            ),
            players!inner(
              id,
              club_id,
              processing_restricted
            )
          `
          )
          .eq("is_active", true)
          .eq("club_id", session.club_id)
          .eq("players.processing_restricted", false);

        if (subsError) {
          console.warn(
            `[schedule-session-pushes] subscriptions fetch failed for session ${session.id}:`,
            subsError
          );
          continue;
        }

        console.log(
          `[schedule-session-pushes] session ${session.id}: found ${subscriptions?.length ?? 0} active subscriptions`
        );

        // Prepare notification_log rows
        const notificationRows: Array<{
          club_id: string;
          profile_id: string;
          session_id: string;
          kind: string;
          scheduled_for: string;
          status: string;
        }> = [];

        const sessionTime = new Date(session.scheduled_at);
        const preTime = new Date(sessionTime.getTime() - preMinutes * 60 * 1000);
        const sessionEndTime = new Date(
          sessionTime.getTime() + (session.duration_min ?? 90) * 60 * 1000
        );
        const postTime = new Date(sessionEndTime.getTime() + postMinutes * 60 * 1000);

        // Skip if times are in the past
        const skipPre = preTime <= now;
        const skipPost = postTime <= now;

        for (const sub of subscriptions ?? []) {
          if (!skipPre) {
            notificationRows.push({
              club_id: session.club_id,
              profile_id: sub.profile_id,
              session_id: session.id,
              kind: "fatigue_pre",
              scheduled_for: preTime.toISOString(),
              status: "scheduled",
            });
          }

          if (!skipPost) {
            notificationRows.push({
              club_id: session.club_id,
              profile_id: sub.profile_id,
              session_id: session.id,
              kind: "fatigue_post",
              scheduled_for: postTime.toISOString(),
              status: "scheduled",
            });
          }
        }

        // Bulk upsert with idempotency (ON CONFLICT DO NOTHING)
        if (notificationRows.length > 0) {
          const { error: upsertError } = await supabase
            .from("notification_log")
            .upsert(notificationRows, { onConflict: "profile_id,session_id,kind" });

          if (upsertError) {
            console.warn(
              `[schedule-session-pushes] upsert failed for session ${session.id}:`,
              upsertError
            );
            totalSkipped += notificationRows.length;
          } else {
            totalEnqueued += notificationRows.length;
            console.log(
              `[schedule-session-pushes] session ${session.id}: enqueued ${notificationRows.length} notifications`
            );
          }
        } else {
          console.log(
            `[schedule-session-pushes] session ${session.id}: no subscriptions or times in past`
          );
          totalSkipped += (subscriptions?.length ?? 0) * 2;
        }
      }
    }

    const response = {
      event: "schedule_session_pushes",
      sessions_processed: sessions?.length ?? 0,
      enqueued: totalEnqueued,
      skipped: totalSkipped,
    };

    console.log("[schedule-session-pushes] completed:", response);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[schedule-session-pushes] unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export default handler;
