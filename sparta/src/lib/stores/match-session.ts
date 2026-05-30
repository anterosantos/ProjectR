"use client";

import { create } from "zustand";
import type { MATCH_ACTIONS, MATCH_ZONES } from "@/lib/schemas/match-events";

export type MatchAction = (typeof MATCH_ACTIONS)[number];
export type ActionPolarity = "positive" | "negative";

export interface MatchLineupRow {
  id: string;
  session_id: string;
  player_id: string;
  name: string;
  jersey_number: number;
  position: string;
  age_group: string;
  processing_restricted: boolean;
  role: "starter" | "bench" | "convocado_only";
}

export interface RecentEventEntry {
  id: string;
  action: MatchAction;
  zone: (typeof MATCH_ZONES)[number];
  jersey_number: number;
  occurred_at: string; // ISO string
}

interface MatchSessionState {
  selectedPlayer: MatchLineupRow | null;
  selectedAction: MatchAction | null;
  lastActionPolarity: ActionPolarity | null;
  recentEvents: RecentEventEntry[];
  setSelectedPlayer: (player: MatchLineupRow | null) => void;
  setSelectedAction: (action: MatchAction | null) => void;
  clearAction: (polarity?: ActionPolarity) => void;
  clearSelection: () => void;
  addRecentEvent: (entry: RecentEventEntry) => void;
  removeRecentEvent: (id: string) => void;
  setRecentEvents: (entries: RecentEventEntry[]) => void;
  clearRecentEvents: () => void;
}

export const useMatchSession = create<MatchSessionState>((set) => ({
  selectedPlayer: null,
  selectedAction: null,
  lastActionPolarity: null,
  recentEvents: [],
  setSelectedPlayer: (player) => set({ selectedPlayer: player }),
  setSelectedAction: (action) => set({ selectedAction: action }),
  clearAction: (polarity) =>
    set((s) => ({
      selectedAction: null,
      lastActionPolarity: polarity ?? s.lastActionPolarity,
    })),
  clearSelection: () =>
    set({ selectedPlayer: null, selectedAction: null, lastActionPolarity: null }),
  addRecentEvent: (entry) =>
    set((s) => ({
      recentEvents: [entry, ...s.recentEvents].slice(0, 6),
    })),
  removeRecentEvent: (id) =>
    set((s) => ({
      recentEvents: s.recentEvents.filter((e) => e.id !== id),
    })),
  setRecentEvents: (entries) => set({ recentEvents: entries.slice(0, 6) }),
  clearRecentEvents: () => set({ recentEvents: [] }),
}));

// Optimized selectors to prevent unnecessary re-renders
export const useSelectedPlayer = () =>
  useMatchSession((s) => s.selectedPlayer);
export const useSelectedAction = () =>
  useMatchSession((s) => s.selectedAction);
export const useLastActionPolarity = () =>
  useMatchSession((s) => s.lastActionPolarity);
export const useRecentEvents = () =>
  useMatchSession((s) => s.recentEvents);
