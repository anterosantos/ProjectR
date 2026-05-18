"use client";

import { useState, useEffect } from "react";

export type SeasonView = "current" | "cumulative";

const STORAGE_KEY = "season_view";

export function useSeasonView(): [SeasonView, (view: SeasonView) => void] {
  const [view, setView] = useState<SeasonView>("current");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "current" || stored === "cumulative") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional SSR-safe localStorage sync: server renders "current", effect updates after hydration to avoid mismatch
      setView(stored);
    }
  }, []);

  function setAndPersist(v: SeasonView) {
    setView(v);
    try {
      localStorage.setItem(STORAGE_KEY, v);
    } catch (e) {
      console.warn("localStorage unavailable, view preference not persisted", e);
    }
  }

  return [view, setAndPersist];
}
