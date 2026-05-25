/**
 * loading.tsx — Skeleton para /prontidao enquanto os dados carregam.
 *
 * AC #6: FCP ≤ 1.5s — esqueleto visual antes dos dados (UX-DR44, NFR58)
 */

export default function ProntidaoLoading() {
  return (
    <div className="flex flex-col px-4 py-6 sm:px-6 animate-pulse">
      {/* Header skeleton */}
      <div className="h-7 w-32 bg-muted rounded mb-2" />
      <div className="h-4 w-48 bg-muted rounded mb-6" />

      {/* Aggregate numbers skeleton */}
      <div className="flex items-center justify-around bg-muted/30 rounded-lg p-4 mb-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <div className="h-12 w-10 bg-muted rounded" />
            <div className="h-3 w-14 bg-muted rounded" />
          </div>
        ))}
      </div>

      {/* Position groups skeleton */}
      {[0, 1, 2].map((group) => (
        <div key={group} className="mb-6">
          <div className="h-5 w-24 bg-muted rounded mb-3" />
          {[0, 1, 2].map((row) => (
            <div
              key={row}
              className="flex items-center justify-between px-4 py-3"
            >
              <div className="h-4 w-6 bg-muted rounded" />
              <div className="h-4 flex-1 mx-3 bg-muted rounded" />
              <div className="h-7 w-20 bg-muted rounded-full" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
