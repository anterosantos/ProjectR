import { CheckCircle, AlertCircle, BarChart2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { getDecisionKpiData } from "@/lib/actions/decisions";
import { DECISION_KIND_LABELS, DECISION_KINDS } from "@/lib/types/decisions";

export const metadata = {
  title: "KPIs de Validação — SPARTA",
};

export const dynamic = "force-dynamic";

export default async function KpisValidacaoPage() {
  const result = await getDecisionKpiData();

  if (!result.ok) {
    throw new Error(result.error.message ?? "Erro ao carregar KPIs");
  }

  const rows = result.data;

  return (
    <div className="px-4 py-6 sm:px-6 max-w-4xl mx-auto">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground mb-1">
        <ol className="flex items-center gap-2">
          <li>
            <a href="/configuracoes" className="hover:text-foreground">Configurações</a>
          </li>
          <li aria-hidden="true">›</li>
          <li aria-current="page" className="text-foreground font-medium">KPIs de Validação</li>
        </ol>
      </nav>

      <h1 className="text-xl font-semibold text-foreground mb-1">KPIs de Validação</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Contagens de decisões data-driven por mês · Meta: ≥ 1 decisão por mês
      </p>

      {rows.length === 0 ? (
        <EmptyState
          icon={<BarChart2 className="h-8 w-8 text-muted-foreground" />}
          title="Nenhuma decisão registada ainda."
          description="As decisões marcadas no Painel de Prontidão aparecerão aqui."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-3 py-2.5 text-left font-medium text-foreground">Mês</th>
                <th className="px-3 py-2.5 text-center font-medium text-foreground">Total</th>
                {DECISION_KINDS.map((kind) => (
                  <th
                    key={kind}
                    className="px-3 py-2.5 text-center font-medium text-foreground whitespace-nowrap"
                  >
                    {DECISION_KIND_LABELS[kind]}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-center font-medium text-foreground">Meta</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const metAtGoal = row.total >= 1;
                const [year, month] = row.month.split("-");
                const monthLabel = new Date(
                  Number(year ?? 0),
                  Number(month ?? 1) - 1,
                  1
                ).toLocaleDateString("pt-PT", {
                  month: "long",
                  year: "numeric",
                });

                return (
                  <tr key={row.month} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-2.5 text-foreground capitalize">{monthLabel}</td>
                    <td className="px-3 py-2.5 text-center font-medium text-foreground">
                      {row.total}
                    </td>
                    {DECISION_KINDS.map((kind) => (
                      <td key={kind} className="px-3 py-2.5 text-center text-muted-foreground">
                        {row.byKind[kind] ?? 0}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-center">
                      {metAtGoal ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          aria-label="Meta atingida"
                        >
                          <CheckCircle className="h-3 w-3" aria-hidden="true" />
                          Meta atingida
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                          aria-label="Meta não atingida"
                        >
                          <AlertCircle className="h-3 w-3" aria-hidden="true" />
                          Meta não atingida
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
