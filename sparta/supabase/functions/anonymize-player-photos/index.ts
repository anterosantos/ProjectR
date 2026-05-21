import { createClient } from "https://esm.sh/@supabase/supabase-js@2.46.0";

// 5 seasons ≈ 5 × 275 days = 1375 days in milliseconds
const FIVE_SEASONS_MS = 5 * 275 * 24 * 60 * 60 * 1000;

const handler = async (_req: Request): Promise<Response> => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response("Missing environment variables", { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const cutoffDate = new Date(Date.now() - FIVE_SEASONS_MS).toISOString();

  const { data: players, error } = await supabase
    .from("players")
    .select("id, club_id, photo_path")
    .eq("is_archived", true)
    .not("photo_path", "is", null)
    .lte("archived_at", cutoffDate);

  if (error) {
    return new Response(`Error fetching players: ${error.message}`, { status: 500 });
  }

  let deleted = 0;
  let skipped = 0;
  let failed = 0;

  for (const player of players ?? []) {
    if (!player.photo_path) {
      console.log(`Skipping player ${player.id}: no photo_path`);
      skipped++;
      continue;
    }

    const { error: deleteError } = await supabase.storage
      .from("player-photos")
      .remove([player.photo_path]);

    if (deleteError && !deleteError.message.toLowerCase().includes("not found")) {
      console.error(`Failed to delete photo for player ${player.id} at ${player.photo_path}: ${deleteError.message}`);
      failed++;
    } else {
      console.log(`Deleted photo for player ${player.id} at ${player.photo_path}`);
      deleted++;
    }
  }

  console.log(`Photo anonymization completed: deleted=${deleted}, skipped=${skipped}, failed=${failed}`);

  return new Response(
    JSON.stringify({ deleted, skipped, failed }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
};

export default handler;
