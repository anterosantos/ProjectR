import { Metadata } from "next";
import { BarChart2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadDashboard } from "@/components/domain/LoadDashboard";
import { getCumulativeLoadData } from "@/lib/actions/load";

export const metadata: Metadata = {
  title: "Carga Acumulada — SPARTA",
};

export default async function TendenciasCargaPage() {
  const result = await getCumulativeLoadData();

  if (!result.ok) {
    return (
      <div className="container-responsive py-8 sm:py-12">
        <EmptyState
          icon={<BarChart2 className="h-8 w-8 text-muted-foreground" aria-hidden="true" />}
          title="Erro ao carregar dados"
          description={result.error.message}
        />
      </div>
    );
  }

  const { players, currentSeason } = result.data;

  if (!currentSeason) {
    return (
      <div className="container-responsive py-8 sm:py-12">
        <EmptyState
          icon={<BarChart2 className="h-8 w-8 text-muted-foreground" aria-hidden="true" />}
          title="Sem época atual configurada"
          description="Configura em /configuracoes/epocas."
        />
      </div>
    );
  }

  const hasLoadData = players.some((p) => p.currentSeasonLoad > 0);

  if (players.length > 0 && !hasLoadData) {
    return (
      <div className="container-responsive py-8 sm:py-12">
        <EmptyState
          icon={<BarChart2 className="h-8 w-8 text-muted-foreground" aria-hidden="true" />}
          title="Sem dados de carga para esta época"
          description="Nenhum jogador tem sessões com sRPE registadas nesta época."
        />
      </div>
    );
  }

  return (
    <div className="container-responsive py-8 sm:py-12">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Carga Acumulada</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Carga sRPE acumulada por jogador para a época atual
          </p>
        </div>

        <LoadDashboard players={players} currentSeason={currentSeason} />
      </div>
    </div>
  );
}
