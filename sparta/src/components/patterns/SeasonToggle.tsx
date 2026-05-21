"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface SeasonToggleProps {
  isCumulative: boolean;
}

export function SeasonToggle({ isCumulative }: SeasonToggleProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function toggle() {
    const params = new URLSearchParams(searchParams.toString());
    if (isCumulative) {
      params.delete("cumulativo");
    } else {
      params.set("cumulativo", "true");
    }
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex gap-2" role="group" aria-label="Filtro de época">
      <button
        type="button"
        onClick={isCumulative ? toggle : undefined}
        aria-pressed={!isCumulative}
        className={`min-h-[44px] rounded-full px-4 text-sm font-medium transition-colors ${
          !isCumulative
            ? "bg-foreground text-background"
            : "bg-muted text-muted-foreground hover:bg-muted/80"
        }`}
      >
        Época actual
      </button>
      <button
        type="button"
        onClick={!isCumulative ? toggle : undefined}
        aria-pressed={isCumulative}
        className={`min-h-[44px] rounded-full px-4 text-sm font-medium transition-colors ${
          isCumulative
            ? "bg-foreground text-background"
            : "bg-muted text-muted-foreground hover:bg-muted/80"
        }`}
      >
        Cumulativo
      </button>
    </div>
  );
}
