import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SemaforoBadge } from "@/components/ui/semaforo-badge";
import { PlayerPhoto } from "@/components/ui/player-photo";
import { getPlayers } from "@/lib/actions/players";
import { AGE_GROUPS } from "@/lib/schemas/players";
import { PlantelEmptyState } from "./plantel-empty-state";

export const metadata = {
  title: "Plantel",
};

const AGE_GROUP_LABELS: Record<string, string> = {
  u14: "Sub-14",
  u15: "Sub-15",
  u17: "Sub-17",
  u19: "Sub-19",
  senior: "Sénior",
};

export default async function PlantelPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const showInactive = view === "inativos";

  const result = await getPlayers(showInactive ? { showInactive: true } : undefined);

  if (!result.ok) {
    return (
      <div className="px-4 py-6 sm:px-6">
        <p className="text-sm text-signal-alert">Erro ao carregar plantel. Tenta novamente.</p>
      </div>
    );
  }

  const grouped = result.data;
  const hasPlayers = AGE_GROUPS.some((g) => (grouped[g]?.length ?? 0) > 0);

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">
          Plantel{showInactive ? " — Inativos" : ""}
        </h1>
        <Button asChild size="sm">
          <Link href="/plantel/novo">
            <Plus className="h-4 w-4" />
            Adicionar
          </Link>
        </Button>
      </div>

      <div className="mb-4">
        {showInactive ? (
          <Button asChild variant="ghost" size="sm">
            <Link href="/plantel">← Ver activos</Link>
          </Button>
        ) : (
          <Button asChild variant="ghost" size="sm">
            <Link href="/plantel?view=inativos">Ver inativos</Link>
          </Button>
        )}
      </div>

      {!hasPlayers ? (
        <PlantelEmptyState />
      ) : (
        <div className="space-y-6">
          {AGE_GROUPS.map((group) => {
            const players = grouped[group] ?? [];
            if (players.length === 0) return null;

            return (
              <section key={group} aria-labelledby={`group-${group}`}>
                <h2
                  id={`group-${group}`}
                  className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground"
                >
                  {AGE_GROUP_LABELS[group] ?? group}
                </h2>
                <ul className="divide-y divide-border rounded-lg border border-border bg-background">
                  {players.map((player) => {
                    const primaryPos = player.positions.find((p) => p.is_primary);
                    return (
                      <li key={player.id}>
                        <Link
                          href={`/plantel/${player.id}`}
                          className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors"
                        >
                          <Suspense
                            fallback={<div className="h-8 w-8 rounded-full bg-neutral-100" />}
                          >
                            <PlayerPhoto
                              photoPath={player.photo_path}
                              fullName={player.full_name}
                              size="sm"
                            />
                          </Suspense>
                          <span className="w-8 text-center text-sm font-mono font-medium text-muted-foreground">
                            {player.jersey_num}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {player.full_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {primaryPos?.position ?? "—"}
                            </p>
                          </div>
                          {showInactive ? (
                            <span className="text-xs text-muted-foreground rounded bg-muted px-2 py-0.5">
                              Inactivo
                            </span>
                          ) : (
                            <SemaforoBadge state="neutral" size="sm" />
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
