import { Suspense } from "react";
import { PlayerPhoto } from "@/components/ui/player-photo";
import type { PlayerProfileHeader as PlayerProfileHeaderData } from "@/lib/actions/player-profile";

const AGE_GROUP_LABELS: Record<string, string> = {
  u14: "Sub-14",
  u15: "Sub-15",
  u17: "Sub-17",
  u19: "Sub-19",
  senior: "Sénior",
};

interface PlayerProfileHeaderProps {
  player: PlayerProfileHeaderData;
}

export function PlayerProfileHeader({ player }: PlayerProfileHeaderProps) {
  const ageLabel = AGE_GROUP_LABELS[player.age_group] ?? player.age_group;
  const posLabel = [player.primary_position, ...player.alt_positions].filter(Boolean).join(", ") || "—";

  return (
    <div className="flex items-start gap-4 mb-6">
      <Suspense fallback={<div className="h-16 w-16 rounded-full bg-neutral-100 flex-shrink-0" />}>
        <PlayerPhoto photoPath={player.photo_path} fullName={player.full_name} size="lg" />
      </Suspense>
      <div>
        <h1 className="text-xl font-semibold text-foreground">{player.full_name}</h1>
        <p className="text-sm text-muted-foreground">
          #{player.jersey_num} · {ageLabel}
        </p>
        <p className="text-sm text-muted-foreground">{posLabel}</p>
      </div>
    </div>
  );
}
