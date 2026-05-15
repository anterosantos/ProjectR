import { StickyHeader } from "@/components/patterns/StickyHeader";

export const metadata = {
  title: "Histórico",
};

export default function HistoricoPage() {
  return (
    <>
      <StickyHeader title="Histórico" />
      <div className="px-4 py-6 sm:px-6">
        {/* Content placeholder for player history */}
        <p className="text-gray-600">Conteúdo será adicionado em histórias futuras.</p>
      </div>
    </>
  );
}
