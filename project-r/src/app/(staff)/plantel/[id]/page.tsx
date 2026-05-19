import { notFound } from "next/navigation";
import dynamicImport from "next/dynamic";
import Link from "next/link";
import { Suspense } from "react";
import { format, differenceInYears, addDays, parseISO } from "date-fns";
import { pt } from "date-fns/locale";
import { ChevronLeft, Pencil, CircleDashed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CalmConfirmation } from "@/components/ui/calm-confirmation";
import { SemaforoBadge } from "@/components/ui/semaforo-badge";
import { PlayerPhoto } from "@/components/ui/player-photo";
import { PlayerMetricsChart } from "@/components/ui/player-metrics-chart";
import { AddMetricSheet } from "@/components/ui/add-metric-sheet";
import { MarkInactiveSheet } from "@/components/ui/mark-inactive-sheet";
import { getPlayer } from "@/lib/actions/players";
import { getPlayerMetrics } from "@/lib/actions/metrics";

const ArchivePlayerDialog = dynamicImport(() =>
  import("./archive-player-dialog").then(m => ({ default: m.ArchivePlayerDialog }))
);
const ReactivatePlayerDialog = dynamicImport(() =>
  import("./reactivate-player-dialog").then(m => ({ default: m.ReactivatePlayerDialog }))
);
const InvitePlayerSheet = dynamicImport(() =>
  import("./invite-player-sheet").then(m => ({ default: m.InvitePlayerSheet }))
);
const ResendInviteButton = dynamicImport(() =>
  import("./resend-invite-button").then(m => ({ default: m.ResendInviteButton }))
);

export const dynamic = "force-dynamic";

// 5 seasons ≈ 5 × 275 days = 1375 days
const FIVE_SEASONS_DAYS = 5 * 275;

function calculateAnonymizationDate(archivedAt: string): Date {
  // Parse ISO string (archived_at from DB is always UTC timestamptz)
  // Format for PT-PT locale happens at render time in the UI
  return addDays(parseISO(archivedAt), FIVE_SEASONS_DAYS);
}

const AGE_GROUP_LABELS: Record<string, string> = {
  u14: "Sub-14",
  u15: "Sub-15",
  u17: "Sub-17",
  u19: "Sub-19",
  senior: "Sénior",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return { title: "Jogador" };
}

export default async function PlayerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; updated?: string; reativado?: string; invited?: string; resent?: string }>;
}) {
  const { id } = await params;
  const { created, updated, reativado, invited, resent } = await searchParams;

  const result = await getPlayer(id);
  if (!result.ok) notFound();

  const player = result.data;

  const metricsResult = await getPlayerMetrics(player.id);
  const metrics = metricsResult.ok ? metricsResult.data : [];
  if (!metricsResult.ok) {
    console.error(
      `Failed to load metrics for player ${player.id}:`,
      metricsResult.error
    );
  }
  const showCreated = created === "1";
  const showUpdated = updated === "1";
  const showReativado = reativado === "1";

  const birthDate = new Date(player.birthdate);
  const age = differenceInYears(new Date(), birthDate);
  const formattedBirthdate = format(birthDate, "d 'de' MMMM 'de' yyyy", {
    locale: pt,
  });

  const primaryPos = player.positions.find((p) => p.is_primary);
  const altPositions = [...player.positions]
    .filter((p) => !p.is_primary)
    .sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="px-4 py-6 sm:px-6 max-w-lg">
      {showCreated && <CalmConfirmation message="Jogador adicionado" />}
      {showUpdated && <CalmConfirmation message="Jogador actualizado" />}
      {showReativado && <CalmConfirmation message="Jogador reactivado" />}
      {invited === "1" && <CalmConfirmation message="Convite enviado" />}
      {resent === "1" && <CalmConfirmation message="Convite reenviado" />}

      <div className="mb-6 flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/plantel">
            <ChevronLeft className="h-4 w-4" />
            Plantel
          </Link>
        </Button>
      </div>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Suspense
              fallback={<div className="h-24 w-24 rounded-lg bg-neutral-100" />}
            >
              <div className="rounded-lg overflow-hidden">
                {player.full_name === "[anonimizado]" && !player.photo_path ? (
                  <div className="h-24 w-24 flex items-center justify-center rounded-lg bg-neutral-100">
                    <CircleDashed className="h-12 w-12 text-muted-foreground" aria-label="Foto removida por anonimização" />
                  </div>
                ) : (
                  <PlayerPhoto
                    photoPath={player.photo_path}
                    fullName={player.full_name}
                    size="lg"
                  />
                )}
              </div>
            </Suspense>
            <div>
              <h1 className="text-xl font-semibold text-foreground">{player.full_name}</h1>
              <p className="text-sm text-muted-foreground">
                #{player.jersey_num} · {AGE_GROUP_LABELS[player.age_group] ?? player.age_group}
              </p>
            </div>
          </div>
          <SemaforoBadge state="neutral" />
        </div>

        {/* Badge de inactivo */}
        {!player.is_active && (
          <div className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            <span className="font-medium">Inactivo</span>
            {player.inactive_reason && (
              <span className="ml-2">— {player.inactive_reason}</span>
            )}
          </div>
        )}

        {/* Metadados de arquivo e anonimização */}
        {player.is_archived && player.archived_at && (
          <div className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            {player.full_name === "[anonimizado]" ? (
              <span>
                Anonimizado em{" "}
                <span className="font-medium">
                  {format(new Date(player.updated_at), "d 'de' MMMM 'de' yyyy", { locale: pt })}
                </span>
              </span>
            ) : (
              <span>
                Será anonimizado em{" "}
                <span className="font-medium">
                  {format(calculateAnonymizationDate(player.archived_at), "d 'de' MMMM 'de' yyyy", { locale: pt })}
                </span>
              </span>
            )}
          </div>
        )}

        {/* Info */}
        <dl className="divide-y divide-border rounded-lg border border-border bg-background">
          <div className="flex items-center justify-between px-4 py-3">
            <dt className="text-sm text-muted-foreground">Data de nascimento</dt>
            <dd className="text-sm font-medium text-foreground">
              {formattedBirthdate} ({age} anos)
            </dd>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <dt className="text-sm text-muted-foreground">Posição primária</dt>
            <dd className="text-sm font-medium text-foreground">
              {primaryPos?.position ?? "—"}
            </dd>
          </div>
          {altPositions.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3">
              <dt className="text-sm text-muted-foreground">Posições alternativas</dt>
              <dd className="text-sm font-medium text-foreground">
                {altPositions.map((p) => p.position).join(", ")}
              </dd>
            </div>
          )}
        </dl>

        {/* Actions */}
        <div className="flex gap-3">
          <Button asChild size="sm" className="flex-1">
            <Link href={`/plantel/${player.id}/editar`}>
              <Pencil className="h-4 w-4" />
              Editar
            </Link>
          </Button>
          {player.is_active ? (
            <MarkInactiveSheet playerId={player.id} playerName={player.full_name} />
          ) : (
            <ReactivatePlayerDialog playerId={player.id} playerName={player.full_name} />
          )}
          <ArchivePlayerDialog playerId={player.id} playerName={player.full_name} />
        </div>

        {/* Métricas físicas */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Métricas físicas</h2>
            <AddMetricSheet playerId={player.id} />
          </div>
          <PlayerMetricsChart metrics={metrics} />
        </section>

        {/* Acesso à app */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Acesso à app</h2>
          {player.invite_sent_at ? (
            <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <div>
                <p className="text-sm text-muted-foreground">Convite enviado em</p>
                <p className="text-sm font-medium">
                  {format(new Date(player.invite_sent_at), "d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: pt })}
                </p>
              </div>
              <ResendInviteButton playerId={player.id} />
            </div>
          ) : (
            <InvitePlayerSheet playerId={player.id} ageGroup={player.age_group} />
          )}
        </section>
      </div>
    </div>
  );
}
