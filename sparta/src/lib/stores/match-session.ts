"use client";

import { create } from "zustand";
import type { MATCH_ACTIONS } from "@/lib/schemas/match-events";

export type MatchAction = (typeof MATCH_ACTIONS)[number];

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

interface MatchSessionState {
  selectedPlayer: MatchLineupRow | null;
  selectedAction: MatchAction | null;
  setSelectedPlayer: (player: MatchLineupRow | null) => void;
  setSelectedAction: (action: MatchAction | null) => void;
  clearSelection: () => void;
}

export const useMatchSession = create<MatchSessionState>((set) => ({
  selectedPlayer: null,
  selectedAction: null,
  setSelectedPlayer: (player) => set({ selectedPlayer: player }),
  setSelectedAction: (action) => set({ selectedAction: action }),
  clearSelection: () => set({ selectedPlayer: null, selectedAction: null }),
}));

// Optimized selectors to prevent unnecessary re-renders
export const useSelectedPlayer = () =>
  useMatchSession((s) => s.selectedPlayer);
export const useSelectedAction = () =>
  useMatchSession((s) => s.selectedAction);
