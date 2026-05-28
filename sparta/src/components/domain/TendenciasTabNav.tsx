"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/tendencias/fadiga", label: "Fadiga" },
  { href: "/tendencias/carga", label: "Carga" },
];

export function TendenciasTabNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Secções de tendências" className="flex gap-1 border-b px-4">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={pathname === tab.href ? "page" : undefined}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            pathname === tab.href
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
