"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CheckCircle,
  Clock,
  BarChart3,
  AlertCircle,
  Calendar,
  Users,
  Settings,
  TrendingUp,
} from "lucide-react";

type TabConfig = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

interface BottomTabNavProps {
  role: "player" | "coach" | "analyst";
}

const TAB_CONFIG: Record<"player" | "coach" | "analyst", TabConfig[]> = {
  player: [
    { label: "Hoje", href: "/hoje", icon: CheckCircle },
    { label: "Histórico", href: "/historico", icon: Clock },
    { label: "Eu", href: "/configuracoes", icon: Settings },
  ],
  coach: [
    { label: "Prontidão", href: "/prontidao", icon: AlertCircle },
    { label: "Calendário", href: "/calendario", icon: Calendar },
    { label: "Plantel", href: "/plantel", icon: Users },
    { label: "Tendências", href: "/tendencias", icon: TrendingUp },
    { label: "Eu", href: "/configuracoes", icon: Settings },
  ],
  analyst: [
    { label: "Sessões", href: "/sessoes", icon: BarChart3 },
    { label: "Plantel", href: "/plantel", icon: Users },
    { label: "Tendências", href: "/tendencias", icon: TrendingUp },
    { label: "Eu", href: "/configuracoes", icon: Settings },
  ],
};

export function BottomTabNav({ role }: BottomTabNavProps) {
  if (!(role in TAB_CONFIG)) {
    throw new Error(`Invalid role prop: ${role}. Expected 'player', 'coach', or 'analyst'.`);
  }

  const pathname = usePathname();
  const tabs = TAB_CONFIG[role];

  const getCurrentTab = (href: string) => {
    // Extract the route prefix for comparison
    const pathPrefix = pathname.split("/")[1] ?? "";
    const hrefPrefix = href.split("/")[1] ?? "";
    return `/${pathPrefix}` === href;
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 border-t border-border bg-card lg:hidden"
      aria-label="Navegação principal"
    >
      <div className="flex justify-around">
        {tabs.map((tab) => {
          const isActive = getCurrentTab(tab.href);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-col items-center justify-center flex-1 py-3 px-2 min-h-[60px] hover:bg-muted"
              aria-current={isActive ? "page" : undefined}
            >
              <Icon
                className={`h-6 w-6 mb-1 ${
                  isActive ? "text-foreground" : "text-muted-foreground"
                }`}
              />
              <span
                className={`text-2xs text-center ${
                  isActive ? "text-foreground font-semibold" : "text-muted-foreground"
                }`}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
