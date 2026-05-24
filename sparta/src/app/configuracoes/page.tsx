import Link from "next/link";
import { BellIcon, CalendarDaysIcon, ChevronRightIcon } from "lucide-react";
import { StickyHeader } from "@/components/patterns/StickyHeader";

export const metadata = {
  title: "Configurações",
};

export default function ConfiguracoesPage() {
  return (
    <main id="main-content">
      <StickyHeader title="Configurações" />
      <div className="px-4 py-6 sm:px-6">
        <ul className="space-y-2">
          <li>
            <Link
              href="/configuracoes/epocas"
              className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <CalendarDaysIcon className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">Épocas</span>
              </div>
              <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
            </Link>
          </li>
          <li>
            <Link
              href="/configuracoes/notificacoes"
              className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <BellIcon className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">Notificações</span>
              </div>
              <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
            </Link>
          </li>
        </ul>
      </div>
    </main>
  );
}
