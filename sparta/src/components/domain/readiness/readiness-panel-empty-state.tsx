"use client";

/**
 * ReadinessPanelEmptyState — Client Component para EmptyState com navegação.
 *
 * AC #1: Renderizado quando nenhuma sessão agendada nos próximos 7 dias (UX-DR8)
 */

import { useRouter } from "next/navigation";
import { Calendar } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export function ReadinessPanelEmptyState() {
  const router = useRouter();

  return (
    <EmptyState
      icon={<Calendar className="size-12 text-muted-foreground" aria-hidden="true" />}
      title="Sem sessão agendada nas próximas 7 dias"
      description="Cria uma para ver o painel"
      cta={{
        label: "Criar Sessão",
        onClick: () => router.push("/calendario/nova"),
      }}
    />
  );
}
