import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { format, differenceInYears } from "date-fns";
import { pt } from "date-fns/locale";
import { ChevronLeft, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CalmConfirmation } from "@/components/ui/calm-confirmation";
import { SemaforoBadge } from "@/components/ui/semaforo-badge";
import { PlayerPhoto } from "@/components/ui/player-photo";
import { getPlayer } from "@/lib/actions/players";
import { ArchivePlayerDialog } from "./archive-player-dialog";

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
  const { id } = await params;
  const result = await getPlayer(id);
  if (!result.ok) return { title: "Jogador" };
  return { title: result.data.full_name };
}

export default async function PlayerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; updated?: string }>;
}) {
  const { id } = await params;
  const { created, updated } = await searchParams;

  const result = await getPlayer(id);
  if (!result.ok) notFound();

  const player = result.data;
  const showCreated = created === "1";
  const showUpdated = updated === "1";

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
                <PlayerPhoto
                  photoPath={player.photo_path}
                  fullName={player.full_name}
                  size="lg"
                />
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
          <ArchivePlayerDialog playerId={player.id} playerName={player.full_name} />
        </div>
      </div>
    </div>
  );
}
