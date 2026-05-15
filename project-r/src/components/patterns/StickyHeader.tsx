interface StickyHeaderProps {
  title: string;
  meta?: string;
}

export function StickyHeader({ title, meta }: StickyHeaderProps) {
  return (
    <header
      className="sticky top-0 z-sticky border-b border-gray-200 bg-white px-4 py-3 sm:px-6"
      role="banner"
    >
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        {meta && <p className="text-sm text-gray-600">{meta}</p>}
      </div>
    </header>
  );
}
