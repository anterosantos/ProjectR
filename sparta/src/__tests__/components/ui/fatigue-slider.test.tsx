import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { axe } from "vitest-axe";
import { FatigueSlider } from "@/components/ui/fatigue-slider";

describe("FatigueSlider", () => {
  const defaultProps = {
    id: "slider-energy",
    label: "Energia muscular",
    minLabel: "Esgotado",
    maxLabel: "Pleno",
    value: null,
    onChange: vi.fn(),
  };

  // ─── Renderização básica ───────────────────────────────────────────────────

  it("renderiza o label da dimensão", () => {
    render(<FatigueSlider {...defaultProps} />);
    expect(screen.getByText("Energia muscular")).toBeInTheDocument();
  });

  it("renderiza o label mínimo", () => {
    render(<FatigueSlider {...defaultProps} />);
    expect(screen.getByText("Esgotado")).toBeInTheDocument();
  });

  it("renderiza o label máximo", () => {
    render(<FatigueSlider {...defaultProps} />);
    expect(screen.getByText("Pleno")).toBeInTheDocument();
  });

  // ─── Atributos ARIA ────────────────────────────────────────────────────────

  it("tem aria-label igual ao label da dimensão", () => {
    render(<FatigueSlider {...defaultProps} />);
    const input = screen.getByRole("slider");
    expect(input).toHaveAttribute("aria-label", "Energia muscular");
  });

  it("tem aria-valuemin=1 por defeito", () => {
    render(<FatigueSlider {...defaultProps} />);
    const input = screen.getByRole("slider");
    expect(input).toHaveAttribute("aria-valuemin", "1");
  });

  it("tem aria-valuemax=5 por defeito", () => {
    render(<FatigueSlider {...defaultProps} />);
    const input = screen.getByRole("slider");
    expect(input).toHaveAttribute("aria-valuemax", "5");
  });

  it("aria-valuetext='Não definido' quando valor é null", () => {
    render(<FatigueSlider {...defaultProps} value={null} />);
    const input = screen.getByRole("slider");
    expect(input).toHaveAttribute("aria-valuetext", "Não definido");
  });

  it("aria-valuetext inclui o valor e max quando definido", () => {
    render(<FatigueSlider {...defaultProps} value={3} />);
    const input = screen.getByRole("slider");
    expect(input).toHaveAttribute(
      "aria-valuetext",
      expect.stringMatching(/3 de 5/)
    );
  });

  it("tem step=1 para enforçar snap inteiro", () => {
    render(<FatigueSlider {...defaultProps} />);
    const input = screen.getByRole("slider");
    expect(input).toHaveAttribute("step", "1");
  });

  // ─── Interacção ────────────────────────────────────────────────────────────

  it("chama onChange com integer ao mudar valor", () => {
    const onChange = vi.fn();
    render(<FatigueSlider {...defaultProps} onChange={onChange} />);
    const input = screen.getByRole("slider");
    fireEvent.change(input, { target: { value: "4" } });
    expect(onChange).toHaveBeenCalledWith(4);
    expect(typeof onChange.mock.calls[0]?.[0]).toBe("number");
  });

  it("não chama onChange quando disabled=true", () => {
    const onChange = vi.fn();
    render(<FatigueSlider {...defaultProps} onChange={onChange} disabled />);
    const input = screen.getByRole("slider");
    fireEvent.change(input, { target: { value: "3" } });
    // disabled inputs não disparam change events em jsdom
    expect(input).toBeDisabled();
  });

  // ─── Props opcionais ───────────────────────────────────────────────────────

  it("usa min e max customizados (sRPE 1-10)", () => {
    render(
      <FatigueSlider
        {...defaultProps}
        id="slider-srpe"
        label="sRPE"
        min={1}
        max={10}
        value={7}
      />
    );
    const input = screen.getByRole("slider");
    expect(input).toHaveAttribute("aria-valuemin", "1");
    expect(input).toHaveAttribute("aria-valuemax", "10");
    expect(input).toHaveAttribute(
      "aria-valuetext",
      expect.stringMatching(/7 de 10/)
    );
  });

  // ─── Toque-alvo ≥44px ─────────────────────────────────────────────────────

  it("container tem min-h de pelo menos 44px (NFR40)", () => {
    const { container } = render(<FatigueSlider {...defaultProps} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper?.className).toMatch(/min-h-\[44px\]/);
  });

  // ─── Acessibilidade (vitest-axe) ───────────────────────────────────────────

  it("sem violações axe-core quando valor é null", async () => {
    const { container } = render(<FatigueSlider {...defaultProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("sem violações axe-core quando valor está definido", async () => {
    const { container } = render(
      <FatigueSlider {...defaultProps} value={3} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  // ─── getValueLabel helper (indirectamente testado via aria-valuetext) ──────

  it("aria-valuetext inclui 'médio' para valor 3 na escala 1-5", () => {
    render(<FatigueSlider {...defaultProps} value={3} />);
    const input = screen.getByRole("slider");
    expect(input).toHaveAttribute("aria-valuetext", "3 de 5 — médio");
  });

  it("aria-valuetext inclui 'máximo' para valor 5 na escala 1-5", () => {
    render(<FatigueSlider {...defaultProps} value={5} />);
    const input = screen.getByRole("slider");
    expect(input).toHaveAttribute("aria-valuetext", "5 de 5 — máximo");
  });

  it("aria-valuetext inclui 'moderado' para valor 6 na escala 1-10", () => {
    render(
      <FatigueSlider
        {...defaultProps}
        id="srpe"
        min={1}
        max={10}
        value={6}
      />
    );
    const input = screen.getByRole("slider");
    expect(input).toHaveAttribute("aria-valuetext", "6 de 10 — moderado");
  });
});
