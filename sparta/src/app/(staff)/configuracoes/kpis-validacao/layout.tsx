import type { ReactNode } from "react";

export const metadata = {
  title: "KPIs de Validação — SPARTA",
};

export const dynamic = "force-dynamic";

export default function KpisValidacaoLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
