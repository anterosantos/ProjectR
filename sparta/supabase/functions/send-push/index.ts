import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const handler = async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const siteUrl = Deno.env.get("SITE_URL") ?? "https://sparta-webapp.vercel.app";

  console.log("[send-push] env check:", {
    hasSupabaseUrl: !!supabaseUrl,
    hasServiceRoleKey: !!serviceRoleKey,
    hasVapidPublicKey: !!vapidPublicKey,
    hasVapidPrivateKey: !!vapidPrivateKey,
  });

  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
    return new Response(
      JSON.stringify({ error: "Missing environment variables" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // Configure web-push with VAPID keys
  webpush.setVapidDetails(siteUrl, vapidPublicKey, vapidPrivateKey);

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const now = new Date();

    // Query up to 50 scheduled notifications ready to send
    const { data: notifications, error: queryError } = await supabase
      .from("notification_log")
      .select("*")
      .eq("status", "scheduled")
      .lte("scheduled_for", now.toISOString())
      .order("scheduled_for", { ascending: true })
      .limit(50);

    if (queryError) {
      console.error("[send-push] query failed:", queryError);
      return new Response(
        JSON.stringify({ error: "Failed to query notifications", details: queryError }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("[send-push] processing notifications:", notifications?.length ?? 0);

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const notif of notifications ?? []) {
      try {
        // Fetch active push subscription for this profile
        const { data: subscription, error: subError } = await supabase
          .from("push_subscriptions")
          .select("id, endpoint, keys_json, is_active")
          .eq("profile_id", notif.profile_id)
          .eq("is_active", true)
          .single();

        if (subError || !subscription?.is_active) {
          // No active subscription, mark as skipped
          const { error: updateError } = await supabase
            .from("notification_log")
            .update({ status: "skipped" })
            .eq("id", notif.id);

          if (updateError) {
            console.warn(`[send-push] failed to mark as skipped (${notif.id}):`, updateError);
          }
          skipped++;
          continue;
        }

        // Build notification payload (opaque — no health data)
        const bodyText =
          notif.kind === "fatigue_pre"
            ? "Sessão daqui a pouco — abre o app"
            : "Sessão concluída — responde ao questionário";

        const payload = {
          title: "SPARTA",
          body: bodyText,
          tag: "fatigue-notification",
          data: {
            deepLink: `/questionario/${notif.session_id}/${notif.kind === "fatigue_pre" ? "pre" : "post"}`,
          },
        };

        // Send push notification
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: subscription.keys_json,
            },
            JSON.stringify(payload)
          );

          // Success: update status and sent_at
          const { error: updateError } = await supabase
            .from("notification_log")
            .update({
              status: "sent",
              sent_at: now.toISOString(),
            })
            .eq("id", notif.id);

          if (updateError) {
            console.warn(`[send-push] failed to update status (${notif.id}):`, updateError);
            failed++;
          } else {
            sent++;
            console.log(`[send-push] sent notification ${notif.id}`);
          }
        } catch (pushError: unknown) {
          // Handle push service errors
          const statusCode =
            pushError instanceof Error && pushError.message.includes("410")
              ? 410
              : pushError instanceof Error && pushError.message.includes("404")
                ? 404
                : 0;

          if (statusCode === 410) {
            // 410 Gone: subscription expired, deactivate it
            const { error: deactivateError } = await supabase
              .from("push_subscriptions")
              .update({ is_active: false })
              .eq("id", subscription.id);

            if (deactivateError) {
              console.warn(`[send-push] failed to deactivate subscription:`, deactivateError);
            }

            const { error: updateError } = await supabase
              .from("notification_log")
              .update({
                status: "failed",
                error_message: "410 Gone",
              })
              .eq("id", notif.id);

            if (updateError) {
              console.warn(`[send-push] failed to update status for 410:`, updateError);
            }
            console.log(`[send-push] subscription 410 Gone, deactivated: ${subscription.id}`);
          } else {
            // Transient error: mark as failed but don't deactivate
            const errorMsg = pushError instanceof Error ? pushError.message : "Unknown error";
            const { error: updateError } = await supabase
              .from("notification_log")
              .update({
                status: "failed",
                error_message: errorMsg.substring(0, 255),
              })
              .eq("id", notif.id);

            if (updateError) {
              console.warn(`[send-push] failed to update status for error:`, updateError);
            }
            console.warn(`[send-push] push error for ${notif.id}:`, errorMsg);
          }
          failed++;
        }
      } catch (loopError: unknown) {
        console.error(`[send-push] unexpected error processing notification:`, loopError);
        failed++;
      }
    }

    const response = {
      event: "send_push",
      processed: notifications?.length ?? 0,
      sent,
      failed,
      skipped,
    };

    console.log("[send-push] completed:", response);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[send-push] unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export default handler;
