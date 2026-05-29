import { describe, it, expect, beforeEach } from "vitest";
import { useMatchSession } from "@/lib/stores/match-session";
import type { MatchLineupRow } from "@/lib/stores/match-session";

const mockPlayer: MatchLineupRow = {
  id: "01920a4b-c8d3-7000-9c4e-000000000001",
  session_id: "01920a4b-c8d3-7000-9c4e-000000000002",
  player_id: "01920a4b-c8d3-7000-9c4e-000000000003",
  name: "João Silva",
  jersey_number: 7,
  position: "Ponta de Lança",
  age_group: "Senior",
  processing_restricted: false,
  role: "starter",
};

const mockPlayer2: MatchLineupRow = {
  id: "01920a4b-c8d3-7000-9c4e-000000000004",
  session_id: "01920a4b-c8d3-7000-9c4e-000000000002",
  player_id: "01920a4b-c8d3-7000-9c4e-000000000005",
  name: "Pedro Santos",
  jersey_number: 10,
  position: "Avançado",
  age_group: "Senior",
  processing_restricted: false,
  role: "starter",
};

describe("useMatchSession", () => {
  beforeEach(() => {
    useMatchSession.setState({
      selectedPlayer: null,
      selectedAction: null,
      lastActionPolarity: null,
    });
  });

  it("initializes with null values", () => {
    const state = useMatchSession.getState();
    expect(state.selectedPlayer).toBeNull();
    expect(state.selectedAction).toBeNull();
  });

  it("setSelectedPlayer updates the selected player", () => {
    useMatchSession.getState().setSelectedPlayer(mockPlayer);
    expect(useMatchSession.getState().selectedPlayer).toEqual(mockPlayer);
  });

  it("setSelectedAction updates the selected action", () => {
    useMatchSession.getState().setSelectedAction("ball_loss");
    expect(useMatchSession.getState().selectedAction).toBe("ball_loss");
  });

  it("clearSelection resets both player and action to null", () => {
    useMatchSession.getState().setSelectedPlayer(mockPlayer);
    useMatchSession.getState().setSelectedAction("ball_loss");

    useMatchSession.getState().clearSelection();

    expect(useMatchSession.getState().selectedPlayer).toBeNull();
    expect(useMatchSession.getState().selectedAction).toBeNull();
  });

  it("can switch between different players", () => {
    useMatchSession.getState().setSelectedPlayer(mockPlayer);
    expect(useMatchSession.getState().selectedPlayer).toEqual(mockPlayer);

    useMatchSession.getState().setSelectedPlayer(mockPlayer2);
    expect(useMatchSession.getState().selectedPlayer).toEqual(mockPlayer2);
  });

  it("can switch between different actions", () => {
    useMatchSession.getState().setSelectedAction("ball_loss");
    expect(useMatchSession.getState().selectedAction).toBe("ball_loss");

    useMatchSession.getState().setSelectedAction("ball_recovery");
    expect(useMatchSession.getState().selectedAction).toBe("ball_recovery");
  });

  it("can be used to read selectedPlayer via store", () => {
    useMatchSession.getState().setSelectedPlayer(mockPlayer);
    const state = useMatchSession.getState();
    expect(state.selectedPlayer).toEqual(mockPlayer);
  });

  it("can be used to read selectedAction via store", () => {
    useMatchSession.getState().setSelectedAction("pass_completed");
    const state = useMatchSession.getState();
    expect(state.selectedAction).toBe("pass_completed");
  });

  it("allows setting player to null", () => {
    useMatchSession.getState().setSelectedPlayer(mockPlayer);
    useMatchSession.getState().setSelectedPlayer(null);
    expect(useMatchSession.getState().selectedPlayer).toBeNull();
  });

  it("allows setting action to null", () => {
    useMatchSession.getState().setSelectedAction("ball_loss");
    useMatchSession.getState().setSelectedAction(null);
    expect(useMatchSession.getState().selectedAction).toBeNull();
  });

  it("maintains both player and action state independently", () => {
    useMatchSession.getState().setSelectedPlayer(mockPlayer);
    useMatchSession.getState().setSelectedAction("ball_loss");

    const state = useMatchSession.getState();
    expect(state.selectedPlayer).toEqual(mockPlayer);
    expect(state.selectedAction).toBe("ball_loss");

    // Change player doesn't affect action
    useMatchSession.getState().setSelectedPlayer(mockPlayer2);
    expect(useMatchSession.getState().selectedAction).toBe("ball_loss");
  });

  it("clearAction limpa selectedAction mas mantém selectedPlayer", () => {
    useMatchSession.getState().setSelectedPlayer(mockPlayer);
    useMatchSession.getState().setSelectedAction("ball_loss");
    useMatchSession.getState().clearAction("negative");

    expect(useMatchSession.getState().selectedPlayer).toEqual(mockPlayer);
    expect(useMatchSession.getState().selectedAction).toBeNull();
    expect(useMatchSession.getState().lastActionPolarity).toBe("negative");
  });

  it("clearAction sem polarity mantém lastActionPolarity anterior", () => {
    useMatchSession.getState().clearAction("positive");
    useMatchSession.getState().setSelectedAction("ball_recovery");
    useMatchSession.getState().clearAction();

    expect(useMatchSession.getState().lastActionPolarity).toBe("positive");
  });

  it("clearSelection limpa tudo incluindo lastActionPolarity", () => {
    useMatchSession.getState().setSelectedPlayer(mockPlayer);
    useMatchSession.getState().setSelectedAction("ball_loss");
    useMatchSession.getState().clearAction("negative");
    useMatchSession.getState().clearSelection();

    expect(useMatchSession.getState().selectedPlayer).toBeNull();
    expect(useMatchSession.getState().selectedAction).toBeNull();
    expect(useMatchSession.getState().lastActionPolarity).toBeNull();
  });
});
