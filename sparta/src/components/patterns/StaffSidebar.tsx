"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertCircle,
  Calendar,
  Users,
  Settings,
  BarChart3,
  TrendingUp,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const NAV_CONFIG: Record<"coach" | "analyst", NavItem[]> = {
  coach: [
    { label: "Prontidão", href: "/prontidao", icon: AlertCircle },
    { label: "Calendário", href: "/calendario", icon: Calendar },
    { label: "Plantel", href: "/plantel", icon: Users },
    { label: "Configurações", href: "/configuracoes", icon: Settings },
  ],
  analyst: [
    { label: "Sessões", href: "/sessoes", icon: BarChart3 },
    { label: "Plantel", href: "/plantel", icon: Users },
    { label: "Tendências", href: "/tendencias", icon: TrendingUp },
    { label: "Configurações", href: "/configuracoes", icon: Settings },
  ],
};

interface StaffSidebarProps {
  role: "coach" | "analyst";
}

export function StaffSidebar({ role }: StaffSidebarProps) {
  const pathname = usePathname();
  const navItems = NAV_CONFIG[role];

  const isActive = (href: string) => {
    const segment = `/${pathname.split("/")[1] ?? ""}`;
    return segment === href;
  };

  return (
    <aside
      className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-border bg-card"
      aria-label="Navegação principal"
    >
      {/* Logo / Brand */}
      <div className="flex h-16 items-center gap-2 px-6 border-b border-border">
        <Shield className="h-6 w-6 text-primary" aria-hidden="true" />
        <span className="text-lg font-bold tracking-tight text-foreground">
          SPARTA
        </span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5 flex-shrink-0",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Role badge at bottom */}
      <div className="px-4 py-4 border-t border-border">
        <span className="text-xs text-muted-foreground capitalize">
          {role === "coach" ? "Treinador" : "Analista"}
        </span>
      </div>
    </aside>
  );
}
