import { notFound, redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getSessionById } from "@/lib/actions/sessions";
import { StickyHeader } from "@/components/patterns/StickyHeader";
import {
  ClientConvocacaoEditor,
  type Session,
  type PlayerWithConsent,
} from "@/components/ClientConvocacaoEditor";
import { getLineupForSession } from "@/lib/actions/lineups";

export const metadata = { title: "Convocatória" };

interface PlayerForLineup extends PlayerWithConsent {
  parental_consent_status?: string;
}

export default async function ConvocatoriaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("club_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || !["coach", "analyst"].includes(profile.role ?? "")) {
    redirect("/");
  }

  // Load session
  const sessionResult = await getSessionById(id);
  if (!sessionResult.ok) {
    if (sessionResult.error.code === "not_found") notFound();
    throw new Error(sessionResult.error.message);
  }

  const session = sessionResult.data;

  // Redirect if training session
  if (session.type === "training") {
    redirect(`/sessoes/${id}?toast=training-no-lineup`);
  }

  // Check if lineup is locked (after scheduled_at + duration_min)
  const scheduledTime = new Date(session.scheduled_at).getTime();
  const durationMs = session.duration_min * 60 * 1000;
  const lockTime = scheduledTime + durationMs;
  // eslint-disable-next-line react-hooks/purity
  const isLocked = lockTime < Date.now();

  // Load existing lineup
  const lineupResult = await getLineupForSession(id);
  const existingLineups = lineupResult.ok ? lineupResult.data : [];

  // Load players for the club, including parental consent status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playersTable = (supabase.from as any)("players");
  const { data: playersData, error: playersError } = await playersTable
    .select(
      "id, full_name, jersey_num, is_archived, is_active, positions(position, is_primary), parental_consents(status)"
    )
    .eq("club_id", profile.club_id)
    .eq("is_archived", false)
    .eq("is_active", true)
    .order("full_name");

  if (playersError) {
    throw new Error(`Erro ao carregar jogadores: ${playersError.message}`);
  }

  // Transform and group players by position
  interface PlayerDataRow {
    id: string;
    full_name: string;
    jersey_num: number;
    is_archived: boolean;
    is_active: boolean;
    positions: Array<{ position: string; is_primary: boolean }>;
    parental_consents: Array<{ status: string }> | null;
  }

  const players: PlayerForLineup[] = (playersData ?? []).map((p: PlayerDataRow) => ({
    id: p.id,
    full_name: p.full_name,
    jersey_num: p.jersey_num,
    positions: p.positions || [],
    parental_consent_status:
      (p.parental_consents && p.parental_consents[0]?.status) || undefined,
  }));

  const playersByPosition: Record<string, PlayerForLineup[]> = {};

  // Position order (GK, DEF, MID, FWD)
  const POSITION_ORDER: Record<string, number> = {
    GK: 0,
    DEF: 1,
    MID: 2,
    FWD: 3,
  };

  const DEFAULT_POSITION_ORDER = 999;

  // Group players by primary position
  for (const player of players) {
    const primaryPosition =
      player.positions?.find((p: { position: string; is_primary: boolean }) => p.is_primary)?.position || "Indefinido";

    if (!playersByPosition[primaryPosition]) {
      playersByPosition[primaryPosition] = [];
    }
    playersByPosition[primaryPosition]!.push(player);
  }

  // Sort position sections by POSITION_ORDER
  const sortedPositionEntries = Object.entries(playersByPosition).sort(
    ([posA], [posB]) => {
      const orderA = POSITION_ORDER[posA] ?? DEFAULT_POSITION_ORDER;
      const orderB = POSITION_ORDER[posB] ?? DEFAULT_POSITION_ORDER;
      return orderA - orderB;
    }
  );

  const sortedPlayersByPosition: Record<string, PlayerForLineup[]> = {};
  for (const [pos, players] of sortedPositionEntries) {
    sortedPlayersByPosition[pos] = players;
  }

  const editorSession: Session = {
    id: session.id,
    type: session.type as "match" | "friendly",
    scheduled_at: session.scheduled_at,
    duration_min: session.duration_min,
  };

  return (
    <main id="main-content" className="flex flex-col min-h-screen">
      <StickyHeader title="Convocatória" backHref={`/sessoes/${id}`} />
      <ClientConvocacaoEditor
        session={editorSession}
        existing={existingLineups}
        readOnly={isLocked || profile.role === "analyst"}
        playersByPosition={sortedPlayersByPosition}
      />
    </main>
  );
}
