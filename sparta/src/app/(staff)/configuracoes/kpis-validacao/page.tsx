import { getDecisionKpiData } from "@/lib/actions/decisions-server";
import { KpisContent } from "./kpis-content";

export default async function KpisValidacaoPage() {
  const result = await getDecisionKpiData();
  const rows = result.ok ? result.data : [];
  return <KpisContent rows={rows} />;
}
