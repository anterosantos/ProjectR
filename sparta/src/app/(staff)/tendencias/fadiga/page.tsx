import { Metadata } from "next";
import { TrendingDown } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { TrendsDashboard } from "@/components/domain/TrendsDashboard";
import { getFatigueTrendsData } from "@/lib/actions/trends";

export const metadata: Metadata = {
  title: "Tendências de Fadiga — SPARTA",
};

export default async function TendenciasFadigaPage() {
  const result = await getFatigueTrendsData();

  if (!result.ok) {
    return (
      <div className="container py-8 sm:py-12">
        <EmptyState
          icon={<TrendingDown className="h-8 w-8 text-muted-foreground" aria-hidden="true" />}
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
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Tendências de Fadiga</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Visualize as tendências de fadiga de 4 semanas para todos os jogadores ativos
          </p>
        </div>

        <TrendsDashboard players={result.data.players} />
      </div>
    </div>
  );
}
