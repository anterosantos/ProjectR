import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";

interface StickyHeaderProps {
  title: string;
  meta?: string;
  backHref?: string;
}

export function StickyHeader({ title, meta, backHref }: StickyHeaderProps) {
  return (
    <header
      className="sticky top-0 z-sticky border-b border-border bg-card px-4 py-3 sm:px-6"
      role="banner"
    >
      <div className="flex items-center gap-2">
        {backHref && (
          <Link
            href={backHref}
            aria-label="Voltar"
            className="flex items-center text-muted-foreground hover:text-foreground"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </Link>
        )}
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
          {meta && <p className="text-sm text-muted-foreground">{meta}</p>}
        </div>
      </div>
    </header>
  );
}
