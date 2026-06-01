import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProfileTabs } from "./ProfileTabs";

// Mock all tab child components to avoid fetching data in tests
vi.mock("./FadigaTab", () => ({ FadigaTab: () => <div>FadigaTab</div> }));
vi.mock("./CargaAcwrTab", () => ({ CargaAcwrTab: () => <div>CargaAcwrTab</div> }));
vi.mock("./MetricasFisicasTab", () => ({ MetricasFisicasTab: () => <div>MetricasFisicasTab</div> }));
vi.mock("./PresencasTab", () => ({ PresencasTab: () => <div>PresencasTab</div> }));
vi.mock("./EstatisticasTab", () => ({ EstatisticasTab: () => <div>EstatisticasTab</div> }));
vi.mock("./DecisoesTab", () => ({ DecisoesTab: () => <div>DecisoesTab</div> }));

const PLAYER_ID = "player-uuid-1";
const STORAGE_KEY = `sparta-profile-tab-${PLAYER_ID}`;

describe("ProfileTabs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset sessionStorage using the per-player key
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
  });

  it("renderiza 6 tabs com labels correctas", () => {
    render(<ProfileTabs playerId={PLAYER_ID} isCumulative={false} />);

    expect(screen.getByRole("tab", { name: "Fadiga" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Carga & ACWR" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Métricas físicas" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Presenças" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Estatísticas" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Decisões data-driven" })).toBeInTheDocument();
  });

  it("renderiza tab Fadiga activa por omissão", () => {
    render(<ProfileTabs playerId={PLAYER_ID} isCumulative={false} />);

    const tab = screen.getByRole("tab", { name: "Fadiga" });
    expect(tab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("FadigaTab")).toBeInTheDocument();
  });

  it("muda para tab Presenças ao clicar", () => {
    render(<ProfileTabs playerId={PLAYER_ID} isCumulative={false} />);

    fireEvent.click(screen.getByRole("tab", { name: "Presenças" }));

    expect(screen.getByRole("tab", { name: "Presenças" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("PresencasTab")).toBeInTheDocument();
  });

  it("renderiza tablist com aria-label", () => {
    render(<ProfileTabs playerId={PLAYER_ID} isCumulative={false} />);
    expect(screen.getByRole("tablist")).toHaveAttribute("aria-label", "Secções do perfil do jogador");
  });

  it("cada tab tem aria-controls apontando para o seu panel", () => {
    render(<ProfileTabs playerId={PLAYER_ID} isCumulative={false} />);
    const tab = screen.getByRole("tab", { name: "Fadiga" });
    expect(tab).toHaveAttribute("aria-controls", "profile-panel-fadiga");
  });

  it("lazy loading: apenas renderiza o conteúdo da tab activa", () => {
    render(<ProfileTabs playerId={PLAYER_ID} isCumulative={false} />);

    // Fadiga is active, others should not be rendered
    expect(screen.getByText("FadigaTab")).toBeInTheDocument();
    expect(screen.queryByText("CargaAcwrTab")).not.toBeInTheDocument();
    expect(screen.queryByText("PresencasTab")).not.toBeInTheDocument();
  });

  it("ao mudar de tab, o conteúdo anterior é desmontado e o novo é montado", () => {
    render(<ProfileTabs playerId={PLAYER_ID} isCumulative={false} />);

    // Initially Fadiga
    expect(screen.getByText("FadigaTab")).toBeInTheDocument();

    // Switch to Estatísticas
    fireEvent.click(screen.getByRole("tab", { name: "Estatísticas" }));
    expect(screen.queryByText("FadigaTab")).not.toBeInTheDocument();
    expect(screen.getByText("EstatisticasTab")).toBeInTheDocument();
  });
});
