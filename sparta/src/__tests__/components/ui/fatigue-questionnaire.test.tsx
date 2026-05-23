/**
 * Tests for FatigueQuestionnaire (Story 4.2)
 *
 * fake-indexeddb/auto DEVE ser o primeiro import para interceptar
 * as APIs de IndexedDB antes do Dexie ser importado.
 */
import "fake-indexeddb/auto";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { axe } from "vitest-axe";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/actions/fatigue", () => ({
  submitFatigueResponse: vi.fn(),
}));

vi.mock("@/lib/uuid", () => ({
  newId: vi.fn().mockReturnValue("0190a000-0000-7000-a000-000000000001"),
}));

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
}));

// ─── Imports após mocks ───────────────────────────────────────────────────────

import { FatigueQuestionnaire, type FatigueQuestionnaireProps } from "@/components/ui/fatigue-questionnaire";
import { submitFatigueResponse } from "@/lib/actions/fatigue";
import { db } from "@/lib/outbox/db";

// ─── Constantes ───────────────────────────────────────────────────────────────

const SESSION_ID = "550e8400-e29b-41d4-a716-446655440001";
const PLAYER_ID = "650e8400-e29b-41d4-a716-446655440002";

const BASE_PROPS: FatigueQuestionnaireProps = {
  sessionId: SESSION_ID,
  sessionType: "training",
  sessionDate: "2026-05-23T16:00:00.000Z",
  phase: "pre",
  playerId: PLAYER_ID,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Renderiza e aguarda que o useEffect inicial (db.cache.get) complete */
async function renderAndSettle(props: FatigueQuestionnaireProps = BASE_PROPS) {
  render(<FatigueQuestionnaire {...props} />);
  // Flush o efeito assíncrono de mount (db.cache.get → setValues com id)
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

/** Define todos os 5 sliders obrigatórios */
async function setAllRequiredSliders(value = "3") {
  const sliders = screen.getAllByRole("slider");
  await act(async () => {
    for (let i = 0; i < 5; i++) {
      fireEvent.change(sliders[i]!, { target: { value } });
    }
  });
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(async () => {
  await db.cache.clear();
  vi.clearAllMocks();
  mockPush.mockClear();
});

afterEach(() => {
  // Garantir que os timers são sempre restaurados
  vi.useRealTimers();
});

// ─── Renderização ─────────────────────────────────────────────────────────────

describe("FatigueQuestionnaire — renderização", () => {
  it("renderiza o h1 com contexto da sessão", async () => {
    await renderAndSettle();
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toBeInTheDocument();
    expect(h1.textContent).toMatch(/questionário/i);
  });

  it("renderiza os 5 sliders de dimensão na fase pre", async () => {
    await renderAndSettle();
    const sliders = screen.getAllByRole("slider");
    expect(sliders).toHaveLength(5);
  });

  it("renderiza 6 sliders na fase post (inclui sRPE)", async () => {
    await renderAndSettle({ ...BASE_PROPS, phase: "post" });
    const sliders = screen.getAllByRole("slider");
    expect(sliders).toHaveLength(6);
  });

  it("NÃO renderiza slider de sRPE na fase pre", async () => {
    await renderAndSettle({ ...BASE_PROPS, phase: "pre" });
    expect(screen.queryByText(/sRPE/i)).not.toBeInTheDocument();
  });

  it("renderiza labels das 5 dimensões em PT-PT", async () => {
    await renderAndSettle();
    expect(screen.getByText("Energia muscular")).toBeInTheDocument();
    expect(screen.getByText("Concentração")).toBeInTheDocument();
    expect(screen.getByText("Sono")).toBeInTheDocument();
    expect(screen.getByText("Desconforto físico")).toBeInTheDocument();
    expect(screen.getByText("Estado emocional")).toBeInTheDocument();
  });

  it("renderiza botão 'Submeter'", async () => {
    await renderAndSettle();
    expect(
      screen.getByRole("button", { name: /submeter/i })
    ).toBeInTheDocument();
  });
});

// ─── Botão Submeter — estado disabled ─────────────────────────────────────────

describe("FatigueQuestionnaire — botão Submeter", () => {
  it("botão está desactivado quando nenhum slider está definido", async () => {
    await renderAndSettle();
    const btn = screen.getByRole("button", { name: /submeter/i });
    expect(btn).toBeDisabled();
  });

  it("botão está desactivado com apenas 4 dimensões definidas", async () => {
    await renderAndSettle();
    const sliders = screen.getAllByRole("slider");
    await act(async () => {
      fireEvent.change(sliders[0]!, { target: { value: "3" } });
      fireEvent.change(sliders[1]!, { target: { value: "4" } });
      fireEvent.change(sliders[2]!, { target: { value: "2" } });
      fireEvent.change(sliders[3]!, { target: { value: "5" } });
    });
    const btn = screen.getByRole("button", { name: /submeter/i });
    expect(btn).toBeDisabled();
  });

  it("botão fica activo quando todos os 5 sliders estão definidos", async () => {
    await renderAndSettle();
    await setAllRequiredSliders("3");
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /submeter/i })
      ).not.toBeDisabled();
    });
  });

  it("sRPE não bloqueia o botão quando não definido (opcional)", async () => {
    await renderAndSettle({ ...BASE_PROPS, phase: "post" });
    // Definir só os 5 obrigatórios (deixar sRPE em null)
    const sliders = screen.getAllByRole("slider");
    await act(async () => {
      for (let i = 0; i < 5; i++) {
        fireEvent.change(sliders[i]!, { target: { value: "3" } });
      }
    });
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /submeter/i })
      ).not.toBeDisabled();
    });
  });
});

// ─── Submissão ────────────────────────────────────────────────────────────────

describe("FatigueQuestionnaire — submissão", () => {
  it("chama submitFatigueResponse com payload correcto", async () => {
    vi.mocked(submitFatigueResponse).mockResolvedValue({
      ok: true,
      data: { id: "0190a000-0000-7000-a000-000000000001" },
    });

    await renderAndSettle();
    const sliders = screen.getAllByRole("slider");

    await act(async () => {
      fireEvent.change(sliders[0]!, { target: { value: "4" } }); // dim_energy
      fireEvent.change(sliders[1]!, { target: { value: "3" } }); // dim_focus
      fireEvent.change(sliders[2]!, { target: { value: "5" } }); // dim_sleep
      fireEvent.change(sliders[3]!, { target: { value: "2" } }); // dim_soreness
      fireEvent.change(sliders[4]!, { target: { value: "4" } }); // dim_mood
    });

    // Esperar que o botão fique activo
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /submeter/i })
      ).not.toBeDisabled();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /submeter/i }));
    });

    expect(submitFatigueResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        player_id: PLAYER_ID,
        session_id: SESSION_ID,
        phase: "pre",
        dim_energy: 4,
        dim_focus: 3,
        dim_sleep: 5,
        dim_soreness: 2,
        dim_mood: 4,
        submitted_via: "online",
      })
    );
  });

  it("envia srpe_value=null quando fase pre", async () => {
    vi.mocked(submitFatigueResponse).mockResolvedValue({
      ok: true,
      data: { id: "0190a000-0000-7000-a000-000000000001" },
    });

    await renderAndSettle({ ...BASE_PROPS, phase: "pre" });
    await setAllRequiredSliders("3");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /submeter/i })
      ).not.toBeDisabled();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /submeter/i }));
    });

    expect(submitFatigueResponse).toHaveBeenCalledWith(
      expect.objectContaining({ srpe_value: null })
    );
  });

  it("mostra CalmConfirmation após sucesso", async () => {
    vi.mocked(submitFatigueResponse).mockResolvedValue({
      ok: true,
      data: { id: "0190a000-0000-7000-a000-000000000001" },
    });

    await renderAndSettle();
    await setAllRequiredSliders("3");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /submeter/i })
      ).not.toBeDisabled();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /submeter/i }));
    });

    await waitFor(() => {
      // CalmConfirmation usa role="alert" aria-live="polite"
      expect(screen.getByRole("alert")).toHaveTextContent("Registado, bom treino");
    });
  });

  it("mostra mensagem de erro em falha de submissão", async () => {
    vi.mocked(submitFatigueResponse).mockResolvedValue({
      ok: false,
      error: { code: "internal", message: "Erro interno do servidor" },
    });

    await renderAndSettle();
    await setAllRequiredSliders("3");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /submeter/i })
      ).not.toBeDisabled();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /submeter/i }));
    });

    await waitFor(() => {
      const alerts = screen.getAllByRole("alert");
      const errorAlert = alerts.find((a) =>
        a.textContent?.includes("Erro interno do servidor")
      );
      expect(errorAlert).toBeDefined();
    });
  });
});

// ─── IndexedDB — autosave & restore ───────────────────────────────────────────

describe("FatigueQuestionnaire — IndexedDB draft", () => {
  it("restaura valores do draft ao montar o componente", async () => {
    const draftKey = `draft:questionnaire:${SESSION_ID}:pre:${PLAYER_ID}`;
    await db.cache.put({
      key: draftKey,
      payload: {
        id: "0190a000-0000-7000-a000-000000000099",
        dim_energy: 4,
        dim_focus: null,
        dim_sleep: null,
        dim_soreness: null,
        dim_mood: null,
        srpe_value: null,
      },
      updatedAt: new Date().toISOString(),
    });

    await renderAndSettle();

    await waitFor(() => {
      const sliders = screen.getAllByRole("slider");
      // dim_energy (índice 0) deve ter valor 4
      expect((sliders[0] as HTMLInputElement).value).toBe("4");
    });
  });

  it("guarda draft no IndexedDB após debounce de 800ms", async () => {
    await renderAndSettle();

    const sliders = screen.getAllByRole("slider");
    await act(async () => {
      fireEvent.change(sliders[0]!, { target: { value: "3" } });
    });

    const draftKey = `draft:questionnaire:${SESSION_ID}:pre:${PLAYER_ID}`;

    // Aguardar que o debounce (800ms) e o db.cache.put se completem
    await waitFor(
      async () => {
        const entry = await db.cache.get(draftKey);
        expect(entry).toBeDefined();
        const payload = entry?.payload as { dim_energy: number | null } | undefined;
        expect(payload?.dim_energy).toBe(3);
      },
      { timeout: 2000, interval: 100 }
    );
  });
});

// ─── Acessibilidade ────────────────────────────────────────────────────────────

describe("FatigueQuestionnaire — acessibilidade", () => {
  it("sem violações axe-core na fase pre", async () => {
    const { container } = render(<FatigueQuestionnaire {...BASE_PROPS} />);
    await act(async () => {
      await Promise.resolve();
    });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("sem violações axe-core na fase post (com sRPE)", async () => {
    const { container } = render(
      <FatigueQuestionnaire {...BASE_PROPS} phase="post" />
    );
    await act(async () => {
      await Promise.resolve();
    });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ─── Variante sub-14 (ageGroup='u14') — Story 4.3 ─────────────────────────────

describe("variante sub-14 (ageGroup='u14')", () => {
  it("renderiza labels simplificados para dim_energy", async () => {
    await renderAndSettle({ ...BASE_PROPS, ageGroup: "u14" });
    expect(screen.getByText("Como te sentes de energia?")).toBeInTheDocument();
    expect(screen.getByText("Cansado")).toBeInTheDocument();
    expect(screen.getByText("Cheio de energia")).toBeInTheDocument();
  });

  it("renderiza labels simplificados para dim_focus", async () => {
    await renderAndSettle({ ...BASE_PROPS, ageGroup: "u14" });
    expect(screen.getByText("Estás atento?")).toBeInTheDocument();
    expect(screen.getByText("Distraído")).toBeInTheDocument();
    expect(screen.getByText("Atento")).toBeInTheDocument();
  });

  it("renderiza labels simplificados para dim_mood", async () => {
    await renderAndSettle({ ...BASE_PROPS, ageGroup: "u14" });
    expect(screen.getByText("Como estás de humor?")).toBeInTheDocument();
    expect(screen.getByText("Triste/zangado")).toBeInTheDocument();
    expect(screen.getByText("Bem-disposto")).toBeInTheDocument();
  });

  it("botão de submissão diz 'Pronto, terminámos'", async () => {
    await renderAndSettle({ ...BASE_PROPS, ageGroup: "u14" });
    expect(screen.getByRole("button", { name: /Pronto, terminámos/i })).toBeInTheDocument();
  });

  it("botão 'Submeter' NÃO aparece na variante u14", async () => {
    await renderAndSettle({ ...BASE_PROPS, ageGroup: "u14" });
    expect(screen.queryByRole("button", { name: /^Submeter$/i })).not.toBeInTheDocument();
  });

  it("exibe help text para sub-14", async () => {
    await renderAndSettle({ ...BASE_PROPS, ageGroup: "u14" });
    expect(
      screen.getByText("Não há respostas certas. O que importa é como te sentes mesmo.")
    ).toBeInTheDocument();
  });

  it("NÃO exibe help text para senior (sem prop ageGroup)", async () => {
    await renderAndSettle(BASE_PROPS); // sem ageGroup → default "senior"
    expect(
      screen.queryByText("Não há respostas certas. O que importa é como te sentes mesmo.")
    ).not.toBeInTheDocument();
  });

  it("renderiza label u14 ('Como te sentes de energia?') e NÃO renderiza senior ('Energia muscular')", async () => {
    await renderAndSettle({ ...BASE_PROPS, ageGroup: "u14" });
    // Positivo: o label u14 aparece
    expect(screen.getByText("Como te sentes de energia?")).toBeInTheDocument();
    // Negativo: o label senior NÃO aparece
    expect(screen.queryByText("Energia muscular")).not.toBeInTheDocument();
  });

  it("sem violações axe-core com ageGroup='u14'", async () => {
    const { container } = render(
      <FatigueQuestionnaire {...BASE_PROPS} ageGroup="u14" />
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("sem violações axe-core com ageGroup='senior'", async () => {
    const { container } = render(
      <FatigueQuestionnaire {...BASE_PROPS} ageGroup="senior" />
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("defaults to senior variant quando ageGroup prop é undefined (simula null age_group do DB)", async () => {
    await renderAndSettle(BASE_PROPS); // sem ageGroup → defaults "senior"
    // Verifica que os labels senior aparecem
    expect(screen.getByText("Energia muscular")).toBeInTheDocument();
    expect(screen.getByText("Concentração")).toBeInTheDocument();
    expect(screen.getByText("Sono")).toBeInTheDocument();
    expect(screen.getByText("Desconforto físico")).toBeInTheDocument();
    expect(screen.getByText("Estado emocional")).toBeInTheDocument();
    // Verifica que help text u14 NÃO aparece
    expect(
      screen.queryByText("Não há respostas certas. O que importa é como te sentes mesmo.")
    ).not.toBeInTheDocument();
    // Verifica que botão diz "Submeter" (não "Pronto, terminámos")
    expect(screen.getByRole("button", { name: /^Submeter$/i })).toBeInTheDocument();
  });
});
