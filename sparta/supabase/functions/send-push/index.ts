// @ts-nocheck — Deno Edge Function: Deno global não existe no tsconfig do Next.js
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------

interface PushKeys {
  p256dh: string;
  auth: string;
}

function isValidPushKeys(keys: unknown): keys is PushKeys {
  if (!keys || typeof keys !== "object") return false;
  const k = keys as Record<string, unknown>;
  return typeof k["p256dh"] === "string" && typeof k["auth"] === "string" &&
    k["p256dh"].length > 0 && k["auth"].length > 0;
}

// ---------------------------------------------------------------------------
// HTTP status extraction from web-push errors
// ---------------------------------------------------------------------------

function extractHttpStatus(err: unknown): number {
  if (!err || typeof err !== "object") return 0;
  // web-push sets statusCode on the error object
  const e = err as Record<string, unknown>;
  if (typeof e["statusCode"] === "number") return e["statusCode"];
  // Fallback: parse from message (e.g. "Received unexpected response code 410")
  if (typeof e["message"] === "string") {
    const match = (e["message"] as string).match(/\b(4\d{2}|5\d{2})\b/);
    if (match?.[1] !== undefined) return parseInt(match[1], 10);
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

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
    // D1 fix: limpar rows 'processing' bloqueadas há > 10 min antes de começar
    const { data: staleCount } = await supabase.rpc(
      "reset_stale_processing_notifications",
      { stale_minutes: 10 }
    );
    if (staleCount && staleCount > 0) {
      console.warn(`[send-push] reset ${staleCount} stale 'processing' rows to 'failed'`);
    }

    // D1 fix: usar claim_push_notifications RPC com FOR UPDATE SKIP LOCKED
    // para prevenir duplo envio em execuções sobrepostas do cron de 5 min.
    const { data: notifications, error: queryError } = await supabase.rpc(
      "claim_push_notifications",
      { batch_size: 50 }
    );

    if (queryError) {
      console.error("[send-push] claim_push_notifications failed:", queryError);
      return new Response(
        JSON.stringify({ error: "Failed to claim notifications", details: queryError }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("[send-push] claimed notifications for processing:", notifications?.length ?? 0);

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const notif of notifications ?? []) {
      // P2 fix: usar maybeSingle() — .single() lançaria erro se perfil tiver
      // múltiplas subscrições ativas; agora retorna null em caso de múltiplos rows.
      const { data: subscription, error: subError } = await supabase
        .from("push_subscriptions")
        .select("id, endpoint, keys_json, is_active")
        .eq("profile_id", notif.profile_id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subError || !subscription) {
        // Sem subscrição ativa → marcar como skipped
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

      // P7 fix: validar shape de keys_json antes de passar ao webpush
      // keys_json tem tipo estruturado em DB mas pode chegar como string serializada
      const rawKeys = typeof subscription.keys_json === "string"
        ? (() => { try { return JSON.parse(subscription.keys_json); } catch { return null; } })()
        : subscription.keys_json;

      if (!isValidPushKeys(rawKeys)) {
        console.warn(`[send-push] invalid keys_json for subscription ${subscription.id} — deactivating`);
        await supabase
          .from("push_subscriptions")
          .update({ is_active: false })
          .eq("endpoint", subscription.endpoint);
        await supabase
          .from("notification_log")
          .update({ status: "failed", error_message: "Invalid push keys" })
          .eq("id", notif.id);
        failed++;
        continue;
      }

      // Build notification payload (opaque — no health data per NFR21 / GDPR Art. 9)
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

      try {
        // Send push notification
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: rawKeys,
          },
          JSON.stringify(payload)
        );

        // Success: update status and sent_at
        const { error: updateError } = await supabase
          .from("notification_log")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
          })
          .eq("id", notif.id);

        if (updateError) {
          console.warn(`[send-push] failed to update status to sent (${notif.id}):`, updateError);
          failed++;
        } else {
          sent++;
          console.log(`[send-push] sent notification ${notif.id}`);
        }
      } catch (pushError: unknown) {
        // P5 fix: extrair statusCode de forma estruturada (web-push expõe statusCode)
        // P5 fix: tratar 404 igual a 410 — endpoint permanentemente desaparecido
        const statusCode = extractHttpStatus(pushError);

        if (statusCode === 410 || statusCode === 404) {
          // P6 fix: desativar por endpoint (não por ID) — cobre todos os rows com o mesmo endpoint
          const { error: deactivateError } = await supabase
            .from("push_subscriptions")
            .update({ is_active: false })
            .eq("endpoint", subscription.endpoint);

          if (deactivateError) {
            console.warn(`[send-push] failed to deactivate subscription by endpoint:`, deactivateError);
          }

          const { error: updateError } = await supabase
            .from("notification_log")
            .update({
              status: "failed",
              error_message: `${statusCode} Gone`,
            })
            .eq("id", notif.id);

          if (updateError) {
            console.warn(`[send-push] failed to update status for ${statusCode} (${notif.id}):`, updateError);
          }
          console.log(`[send-push] subscription ${statusCode} — deactivated endpoint: ${subscription.endpoint}`);
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
            console.warn(`[send-push] failed to update status for transient error (${notif.id}):`, updateError);
          }
          console.warn(`[send-push] push error for ${notif.id} (status ${statusCode}):`, errorMsg);
        }
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
    // P3 fix: o catch externo não pode atualizar notification_log (não sabemos qual notif falhou).
    // O claim_push_notifications já transitou as rows para 'processing';
    // o reset_stale_processing_notifications do próximo run irá repô-las a 'failed' após 10 min.
    console.error("[send-push] unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export default handler;
