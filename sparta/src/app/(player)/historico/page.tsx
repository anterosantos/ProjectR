import { redirect } from "next/navigation";
import { parseISO, format } from "date-fns";
import { pt } from "date-fns/locale";
import { ClipboardListIcon } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { StickyHeader } from "@/components/patterns/StickyHeader";
import { EmptyState } from "@/components/ui/empty-state";
import { getFatigueCopy } from "@/lib/i18n/pt-PT/fatigue";

export const metadata = {
  title: "Histórico",
};

type FatigueRow = {
  id: string;
  phase: string;
  dim_energy: number;
  dim_focus: number;
  dim_sleep: number;
  dim_soreness: number;
  dim_mood: number;
  srpe_value: number | null;
  submitted_at: string;
};

/** Format a date string for player display: "7 mai., 14:30" */
function formatSubmittedAt(isoString: string): string {
  try {
    const date = parseISO(isoString);
    if (isNaN(date.getTime())) return "Data inválida";
    const datePart = format(date, "d MMM.", { locale: pt });
    const timePart = format(date, "HH:mm", { locale: pt });
    return `${datePart} ${timePart}`;
  } catch {
    return "Data inválida";
  }
}

/** Translate internal phase value to PT-PT display label */
function phaseLabel(phase: string): string {
  if (phase === "pre") return "Pré-sessão";
  if (phase === "post") return "Pós-sessão";
  // Unknown phase values (e.g. future DB enum additions) render as "—"
  // to avoid exposing internal data model terminology to the player (P4).
  return "—";
}

export default async function HistoricoPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Verify the user is a player (redirect staff who somehow reach this page)
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "player") {
    redirect("/");
  }

  // Get player record to resolve age_group for dimension labels and player_id for query scoping.
  // Selecting `id` enables the defence-in-depth filter on fatigue_responses (P2).
  const { data: player } = await supabase
    .from("players")
    .select("id, age_group")
    .eq("profile_id", user.id)
    .maybeSingle();

  const ageGroup = player?.age_group;
  const copy = getFatigueCopy(ageGroup);

  // Query fatigue_responses — RLS "player_sees_own" policy scopes to this player automatically.
  // Defence-in-depth: also filter by player_id at the application level (P2).
  // If no player record exists for this profile, skip the query entirely (no responses possible).
  // Only raw fields are fetched. NO derived metrics (acwr, readiness_snapshots, etc.) — AC #3.
  // Player reads their OWN raw submissions — no audit logging required (Story 4.6, FR26).
  // auditedRead() is for staff reading other players' data (Story 3.11), not player self-reads.
  let rows: FatigueRow[] = [];
  if (player?.id) {
    // eslint-disable-next-line custom/no-direct-health-data-read -- player reads own raw fatigue data via RLS + explicit player_id filter; no staff audit needed
    const { data: responses } = await supabase
      .from("fatigue_responses")
      .select(
        "id, phase, dim_energy, dim_focus, dim_sleep, dim_soreness, dim_mood, srpe_value, submitted_at"
      )
      .eq("player_id", player.id)
      .order("submitted_at", { ascending: false });

    rows = (responses ?? []) as FatigueRow[];
  }

  return (
    <>
      <StickyHeader title="Histórico" />
      <main className="px-4 py-6 sm:px-6" id="main-content">
        {/* Mediated data copy — UX-DR38, AC #3 */}
        <p className="mb-6 text-sm text-muted-foreground" data-testid="mediated-copy">
          As tuas respostas. O treinador é quem interpreta como conjunto.
        </p>

        {rows.length === 0 ? (
          <EmptyState
            icon={<ClipboardListIcon className="h-8 w-8 text-muted-foreground" aria-hidden="true" />}
            title="Sem respostas ainda"
            description="As tuas respostas aos questionários de fadiga aparecerão aqui depois do primeiro registo."
          />
        ) : (
          <div className="overflow-x-auto" role="region" aria-label="Histórico de respostas de fadiga">
            <table
              role="table"
              className="w-full border-collapse text-sm"
              aria-label="Respostas de fadiga por sessão"
            >
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th scope="col" className="py-3 pr-4 text-left font-medium text-gray-700">
                    Data
                  </th>
                  <th scope="col" className="py-3 pr-4 text-left font-medium text-gray-700">
                    Fase
                  </th>
                  {copy.dimensions.map((dim) => (
                    <th
                      key={dim.key}
                      scope="col"
                      className="py-3 pr-4 text-left font-medium text-gray-700"
                    >
                      {dim.label}
                    </th>
                  ))}
                  <th scope="col" className="py-3 text-left font-medium text-gray-700">
                    sRPE
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                  >
                    <td className="py-3 pr-4 text-gray-900 whitespace-nowrap">
                      {formatSubmittedAt(row.submitted_at)}
                    </td>
                    <td className="py-3 pr-4 text-gray-600">
                      {phaseLabel(row.phase)}
                    </td>
                    {/* Dimension cells driven by copy.dimensions — stays in sync with headers (P3) */}
                    {copy.dimensions.map((dim) => (
                      <td key={dim.key} className="py-3 pr-4 tabular-nums text-gray-900">
                        {row[dim.key]}
                      </td>
                    ))}
                    <td className="py-3 tabular-nums text-gray-500">
                      {row.phase === "post" && row.srpe_value != null
                        ? row.srpe_value
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
