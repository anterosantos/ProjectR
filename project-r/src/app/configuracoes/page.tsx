import { StickyHeader } from "@/components/patterns/StickyHeader";

export const metadata = {
  title: "Configurações",
};

export default function ConfiguracoesPage() {
  return (
    <main id="main-content">
      <StickyHeader title="Configurações" />
      <div className="px-4 py-6 sm:px-6">
        {/* Content placeholder for settings */}
        <p className="text-gray-600">Conteúdo será adicionado em histórias futuras.</p>
      </div>
    </main>
  );
}
