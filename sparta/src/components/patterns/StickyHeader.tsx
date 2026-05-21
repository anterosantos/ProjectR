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
      className="sticky top-0 z-sticky border-b border-gray-200 bg-white px-4 py-3 sm:px-6"
      role="banner"
    >
      <div className="flex items-center gap-2">
        {backHref && (
          <Link
            href={backHref}
            aria-label="Voltar"
            className="flex items-center text-gray-500 hover:text-gray-900"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </Link>
        )}
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
          {meta && <p className="text-sm text-gray-600">{meta}</p>}
        </div>
      </div>
    </header>
  );
}
