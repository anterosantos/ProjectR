"use client";

import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export function PlantelEmptyState() {
  const router = useRouter();
  return (
    <EmptyState
      icon={<UserPlus className="h-8 w-8 text-muted-foreground" />}
      title="Sem jogadores ainda"
      description="Começa por registar o primeiro jogador"
      cta={{
        label: "Adicionar jogador",
        onClick: () => router.push("/plantel/novo"),
      }}
    />
  );
}
