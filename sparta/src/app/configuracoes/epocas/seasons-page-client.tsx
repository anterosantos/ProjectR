"use client";

import { useState } from "react";
import { CalendarDaysIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SeasonForm } from "./season-form";
import type { Season } from "@/lib/schemas/seasons";

interface SeasonsPageClientProps {
  seasons: Season[];
}

export function SeasonsPageClient({ seasons }: SeasonsPageClientProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editSeason, setEditSeason] = useState<Season | null>(null);

  if (seasons.length === 0) {
    return (
      <>
        <EmptyState
          icon={<CalendarDaysIcon className="h-8 w-8 text-muted-foreground" />}
          title="Sem épocas"
          description="Crie a primeira época para começar a organizar os dados por temporada."
          cta={{ label: "Nova época", onClick: () => setCreateOpen(true) }}
        />
        <SeasonForm
          mode="create"
          open={createOpen}
          onOpenChange={setCreateOpen}
        />
      </>
    );
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {seasons.length} {seasons.length === 1 ? "época" : "épocas"}
        </p>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          Nova época
        </Button>
      </div>

      <ul className="space-y-2">
        {seasons.map((season) => (
          <li
            key={season.id}
            className="flex items-center justify-between rounded-lg border px-4 py-3"
          >
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{season.name}</span>
                {season.is_current && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                    Atual
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {season.start_date} — {season.end_date}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditSeason(season)}
            >
              Editar
            </Button>
          </li>
        ))}
      </ul>

      <SeasonForm
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      {editSeason && (
        <SeasonForm
          mode="edit"
          season={editSeason}
          open={!!editSeason}
          onOpenChange={(open) => {
            if (!open) setEditSeason(null);
          }}
        />
      )}
    </>
  );
}
