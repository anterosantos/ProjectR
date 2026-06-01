import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlayerProfileHeader } from "./PlayerProfileHeader";
import { ProfileTabs } from "./ProfileTabs";
import { getPlayerProfileHeader } from "@/lib/actions/player-profile";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return { title: `Perfil — Jogador ${id}` };
}

/**
 * /plantel/[id]/perfil — Perfil consolidado do jogador (staff-only).
 *
 * AC #1: Header + 6 tabs navegáveis (Fadiga, Carga & ACWR, Métricas físicas, Presenças, Estatísticas, Decisões)
 * AC #8: Acesso bloqueado para o próprio jogador via STAFF_ONLY_ROUTES_404 middleware (Story 4.6)
 * AC #9: Header carregado server-side (FCP ≤ 1s), tabs lazy-loaded client-side
 * AC #10: axe zero violations — tablist + role=tabpanel + aria-labelledby
 */
export default async function PlayerPerfilPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ cumulativo?: string }>;
}) {
  const { id } = await params;
  const resolved = await searchParams;
  const isCumulative = resolved?.cumulativo === "true";

  const result = await getPlayerProfileHeader(id);

  if (!result.ok) {
    notFound();
  }

  const player = result.data;

  return (
    <div className="px-4 py-6 sm:px-6 max-w-3xl mx-auto">
      {/* Back navigation */}
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/plantel/${id}`}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            {player.full_name}
          </Link>
        </Button>
      </div>

      {/* Player header — always loaded server-side */}
      <PlayerProfileHeader player={player} />

      {/* 6-tab profile client component — lazy loads data per active tab */}
      <ProfileTabs playerId={id} isCumulative={isCumulative} />
    </div>
  );
}
