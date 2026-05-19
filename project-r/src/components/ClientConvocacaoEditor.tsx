"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LineupToggle } from "@/components/patterns/LineupToggle";
import { submitLineup } from "@/lib/actions/lineups";

export interface Session {
  id: string;
  type: "training" | "match" | "friendly";
  scheduled_at: string;
  duration_min: number;
}

export interface PlayerWithConsent {
  id: string;
  full_name: string;
  jersey_num: number;
  positions?: Array<{ position: string; is_primary: boolean }>;
  parental_consent_status?: string;
}

export interface MatchLineup {
  player_id: string;
  role: "starter" | "bench" | "convocado_only";
  shirt_num: number | null;
}

interface ClientConvocacaoEditorProps {
  session: Session;
  existing: MatchLineup[];
  readOnly: boolean;
  playersByPosition: Record<string, PlayerWithConsent[]>;
}

interface LineupSelection {
  [playerId: string]: "starter" | "bench" | null;
}

export function ClientConvocacaoEditor({
  session,
  existing,
  readOnly,
  playersByPosition,
}: ClientConvocacaoEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selections, setSelections] = useState<LineupSelection>(() => {
    const map: LineupSelection = {};
    existing.forEach((lineup) => {
      if (lineup.role === "starter" || lineup.role === "bench") {
        map[lineup.player_id] = lineup.role;
      }
    });
    return map;
  });

  const [shirtNumbers, setShirtNumbers] = useState<Record<string, number | null>>(() => {
    const map: Record<string, number | null> = {};
    existing.forEach((lineup) => {
      if (lineup.role === "starter") {
        map[lineup.player_id] = lineup.shirt_num ?? null;
      }
    });
    return map;
  });

  const starterCount = Object.values(selections).filter(
    (v) => v === "starter"
  ).length;
  const benchCount = Object.values(selections).filter(
    (v) => v === "bench"
  ).length;

  const canSubmit = starterCount === 11 && !readOnly && !isPending;

  async function handleSubmit() {
    const players = Object.entries(selections)
      .filter(([, role]) => role)
      .map(([playerId, role]) => ({
        playerId,
        role: role as "starter" | "bench",
        shirtNum: role === "starter" ? shirtNumbers[playerId] ?? null : null,
      }));

    startTransition(async () => {
      try {
        const result = await submitLineup({
          sessionId: session.id,
          players,
        });

        if (!result.ok) {
          // Toast error
          console.error("Erro ao guardar convocatória:", result.error);
          return;
        }

        // Success
        router.push(`/sessoes/${session.id}?toast=lineup-saved`);
      } catch (error) {
        console.error("Erro ao comunicar com servidor:", error);
      }
    });
  }

  return (
    <div className="flex flex-col min-h-screen">
      <div className="sticky top-12 bg-card border-b border-gray-200 px-4 py-3 sm:px-6 z-40">
        <p
          aria-live="polite"
          aria-atomic="true"
          className="text-sm font-medium text-gray-900"
        >
          {starterCount} / 11 titulares · {benchCount} suplentes
        </p>
      </div>

      <div className="flex-1">
        {Object.entries(playersByPosition).map(([position, positionPlayers]) => (
          <section key={position} className="border-b border-gray-200">
            <h2 className="sticky top-24 z-30 bg-gray-50 border-b border-gray-200 px-4 py-2 sm:px-6 text-sm font-semibold text-gray-700 uppercase tracking-wider">
              {position}
            </h2>
            <div>
              {positionPlayers.map((player) => (
                <LineupToggle
                  key={player.id}
                  player={player}
                  selected={selections[player.id] || null}
                  onChange={(role, shirtNum) => {
                    setSelections((prev) => ({ ...prev, [player.id]: role }));
                    if (role === "starter") {
                      setShirtNumbers((prev) => ({ ...prev, [player.id]: shirtNum ?? null }));
                    } else if (role === null) {
                      setShirtNumbers((prev) => {
                        const updated = { ...prev };
                        delete updated[player.id];
                        return updated;
                      });
                    }
                  }}
                  parentalConsentConfirmed={
                    player.parental_consent_status === "confirmed"
                  }
                  disabled={readOnly}
                  shirtNum={shirtNumbers[player.id] ?? null}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {!readOnly && (
        <div className="border-t border-gray-200 bg-white px-4 py-4 sm:px-6 flex gap-3">
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1"
          >
            {isPending ? "Guardando..." : "Guardar convocatória"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => router.back()}
            disabled={isPending}
            className="flex-1"
          >
            Cancelar
          </Button>
        </div>
      )}

      {readOnly && (
        <div className="border-t border-gray-200 bg-gray-50 px-4 py-4 sm:px-6">
          <p className="text-sm text-gray-600 font-medium">
            Convocatória fechada após apito final
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Para registar substituições, consulte Epic 6 (futuro)
          </p>
        </div>
      )}
    </div>
  );
}
