/**
 * /prontidao — Painel de Prontidão (Staff only, default: lista por posição).
 *
 * AC #1: Server Component; importa ReadinessPanel; EmptyState quando sem sessão
 * AC #6: Fetch server-side; skeleton em loading.tsx
 */

import { ReadinessPanel } from "@/components/domain/readiness/readiness-panel";
import { ReadinessPanelEmptyState } from "@/components/domain/readiness/readiness-panel-empty-state";
import {
  getUpcomingSession,
  getReadinessPanelData,
  refreshUpcomingReadiness,
} from "@/lib/actions/readiness";

export const metadata = {
  title: "Prontidão",
};

export const dynamic = "force-dynamic";

export default async function ProntidaoPage() {
  // Fetch next scheduled session within 7 days
  const sessionResult = await getUpcomingSession();

  // No session (or auth error) → EmptyState
  if (!sessionResult.ok || !sessionResult.data) {
    return (
      <div className="px-4 py-6 sm:px-6">
        {/* P-20: Breadcrumb "Prontidão" — Story 1.9 pattern */}
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground mb-1">
          <ol className="flex items-center gap-2">
            <li aria-current="page" className="text-foreground font-medium">Prontidão</li>
          </ol>
        </nav>
        <h1 className="text-xl font-semibold text-foreground mb-6">Prontidão</h1>
        <ReadinessPanelEmptyState />
      </div>
    );
  }

  const { sessionId, scheduledAt } = sessionResult.data;

  // Recalculate snapshots on every page load so data stays fresh
  await refreshUpcomingReadiness(sessionId);

  // Fetch enriched player readiness data
  const panelResult = await getReadinessPanelData(sessionId);

  if (!panelResult.ok) {
    // P-21: lançar erro para que error.tsx o trate (antes: EmptyState mascarava erros de DB)
    throw new Error(panelResult.error.message ?? "Erro ao carregar dados de prontidão");
  }

  const { players } = panelResult.data;

  // Format date for display
  const sessionDate = new Date(scheduledAt).toLocaleDateString("pt-PT", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex flex-col">
      {/* Page header + P-20: Breadcrumb */}
      <div className="px-4 pt-6 pb-2 sm:px-6">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground mb-1">
          <ol className="flex items-center gap-2">
            <li aria-current="page" className="text-foreground font-medium">Prontidão</li>
          </ol>
        </nav>
        <h1 className="text-xl font-semibold text-foreground">Prontidão</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Próxima sessão: {sessionDate} · {players.length} jogadores
        </p>
      </div>

      {/* Panel (Client Component — toggle + drill-down) */}
      <ReadinessPanel
        players={players}
        history={panelResult.data.history}
        sessionId={sessionId}
        scheduledAt={scheduledAt}
        view="list"
      />
    </div>
  );
}
