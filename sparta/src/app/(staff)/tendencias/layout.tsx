import { TendenciasTabNav } from "@/components/domain/TendenciasTabNav";

export default function TendenciasLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <TendenciasTabNav />
      {children}
    </div>
  );
}
