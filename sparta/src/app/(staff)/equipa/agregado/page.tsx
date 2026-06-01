import { Metadata } from "next";
import { LayoutDashboard } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { TeamAggregateDashboard } from "@/components/domain/TeamAggregateDashboard";
import { getTeamAggregateData } from "@/lib/actions/team-aggregate";

export const metadata: Metadata = {
  title: "Equipa Agregada — SPARTA",
};

export default async function EquipaAgregadoPage() {
  const result = await getTeamAggregateData();

  if (!result.ok) {
    return (
      <div className="container py-8 sm:py-12">
        <EmptyState
          icon={
            <LayoutDashboard
              className="h-8 w-8 text-muted-foreground"
              aria-hidden="true"
            />
          }
          title="Erro ao carregar dados"
          description={result.error.message}
        />
      </div>
    );
  }

  return (
    <div className="container py-8 sm:py-12">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            Equipa Agregada
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Métricas agregadas do plantel — fadiga, presenças e performance
          </p>
        </div>
        <TeamAggregateDashboard data={result.data} />
      </div>
    </div>
  );
}
