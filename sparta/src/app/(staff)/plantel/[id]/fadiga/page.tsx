import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FatigueTabs } from "@/components/domain/FatigueTabs";
import { getPlayerFatigueData } from "@/lib/actions/fatigue-staff";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return { title: `Fadiga — Jogador ${id}` };
}

/**
 * /plantel/[id]/fadiga — Staff-only page showing 28-day fatigue data for a player.
 *
 * AC #1: Role validation (coach/analyst) + club_id match via getPlayerFatigueData()
 * AC #2: auditedRead() inside action — fire-and-forget audit_logs entry
 * AC #5: Tabs "Gráfico" / "Tabela" rendered by FatigueTabs client component
 * AC #7: Empty state handled inside FatigueChart / FatigueTable
 * AC #8: aria-label on panels, tablist, keyboard-accessible tabs
 */
export default async function PlayerFadigaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const result = await getPlayerFatigueData(id);

  // Returns 404 for both not-found and unauthorized (AC #1 — avoid revealing resource existence)
  if (!result.ok) {
    notFound();
  }

  const { responses, sessions, playerName, playerId } = result.data;

  return (
    <div className="px-4 py-6 sm:px-6 max-w-lg">
      {/* Back navigation */}
      <div className="mb-6 flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/plantel/${id}`}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            {playerName}
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Fadiga</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Últimos 28 dias · {responses.length === 0 ? "sem respostas" : `${responses.length} respostas`}
        </p>
      </div>

      {/* Tabs + Chart/Table + Filters (client component) */}
      <FatigueTabs
        playerId={playerId}
        playerName={playerName}
        responses={responses}
        sessions={sessions}
      />
    </div>
  );
}
