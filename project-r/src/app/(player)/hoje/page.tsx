import { StickyHeader } from "@/components/patterns/StickyHeader";

export const metadata = {
  title: "Hoje",
};

export default function HojePage() {
  return (
    <>
      <StickyHeader title="Hoje" />
      <div className="px-4 py-6 sm:px-6">
        {/* Content placeholder for player home screen */}
        <p className="text-gray-600">Conteúdo será adicionado em histórias futuras.</p>
      </div>
    </>
  );
}
