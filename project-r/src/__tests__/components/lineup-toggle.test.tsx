import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LineupToggle } from "@/components/patterns/LineupToggle";

describe("LineupToggle", () => {
  const mockPlayer = {
    id: "player-1",
    full_name: "João Silva",
    jersey_num: 7,
    positions: [
      { position: "MID", is_primary: true },
      { position: "FWD", is_primary: false },
    ],
  };

  describe("Rendering", () => {
    it("should render player name and jersey number", () => {
      render(
        <LineupToggle
          player={mockPlayer}
          selected={null}
          onChange={vi.fn()}
        />
      );

      expect(screen.getByText("7")).toBeInTheDocument();
      expect(screen.getByText("João Silva")).toBeInTheDocument();
    });

    it("should render primary position", () => {
      render(
        <LineupToggle
          player={mockPlayer}
          selected={null}
          onChange={vi.fn()}
        />
      );

      expect(screen.getByText("MID")).toBeInTheDocument();
    });

    it("should render three toggle buttons", () => {
      render(
        <LineupToggle
          player={mockPlayer}
          selected={null}
          onChange={vi.fn()}
        />
      );

      const buttons = screen.getAllByRole("button");
      expect(buttons).toHaveLength(3);
    });

    it("should render dash position if no positions", () => {
      const playerNoPos = { ...mockPlayer, positions: [] };
      render(
        <LineupToggle
          player={playerNoPos}
          selected={null}
          onChange={vi.fn()}
        />
      );

      expect(screen.getByText("—")).toBeInTheDocument();
    });
  });

  describe("Selected state", () => {
    it("should show selected state for starter", () => {
      const { container } = render(
        <LineupToggle
          player={mockPlayer}
          selected="starter"
          onChange={vi.fn()}
        />
      );

      const buttons = container.querySelectorAll("button");
      const starterButton = buttons[1]; // Second button is starter

      expect(starterButton).toHaveAttribute("aria-pressed", "true");
      expect(starterButton).toHaveClass("bg-primary");
    });

    it("should show selected state for bench", () => {
      const { container } = render(
        <LineupToggle
          player={mockPlayer}
          selected="bench"
          onChange={vi.fn()}
        />
      );

      const buttons = container.querySelectorAll("button");
      const benchButton = buttons[2]; // Third button is bench

      expect(benchButton).toHaveAttribute("aria-pressed", "true");
      expect(benchButton).toHaveClass("bg-primary");
    });

    it("should show unselected state", () => {
      const { container } = render(
        <LineupToggle
          player={mockPlayer}
          selected={null}
          onChange={vi.fn()}
        />
      );

      const buttons = container.querySelectorAll("button");
      const unselectedButton = buttons[0]; // First button is unselected

      expect(unselectedButton).toHaveAttribute("aria-pressed", "true");
    });
  });

  describe("Interactions", () => {
    it("should call onChange with 'starter' when starter button clicked", () => {
      const onChange = vi.fn();
      const { container } = render(
        <LineupToggle
          player={mockPlayer}
          selected={null}
          onChange={onChange}
        />
      );

      const buttons = container.querySelectorAll("button");
      const starterButton = buttons[1];

      fireEvent.click(starterButton);

      expect(onChange).toHaveBeenCalledWith("starter");
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("should call onChange with 'bench' when bench button clicked", () => {
      const onChange = vi.fn();
      const { container } = render(
        <LineupToggle
          player={mockPlayer}
          selected={null}
          onChange={onChange}
        />
      );

      const buttons = container.querySelectorAll("button");
      const benchButton = buttons[2];

      fireEvent.click(benchButton);

      expect(onChange).toHaveBeenCalledWith("bench");
    });

    it("should call onChange with null when unselected button clicked", () => {
      const onChange = vi.fn();
      const { container } = render(
        <LineupToggle
          player={mockPlayer}
          selected="starter"
          onChange={onChange}
        />
      );

      const buttons = container.querySelectorAll("button");
      const unselectedButton = buttons[0];

      fireEvent.click(unselectedButton);

      expect(onChange).toHaveBeenCalledWith(null);
    });

    it("should toggle between states on multiple clicks", () => {
      const onChange = vi.fn();
      const { container, rerender } = render(
        <LineupToggle
          player={mockPlayer}
          selected={null}
          onChange={onChange}
        />
      );

      let buttons = container.querySelectorAll("button");
      fireEvent.click(buttons[1]); // Click starter
      expect(onChange).toHaveBeenCalledWith("starter");

      rerender(
        <LineupToggle
          player={mockPlayer}
          selected="starter"
          onChange={onChange}
        />
      );

      buttons = container.querySelectorAll("button");
      fireEvent.click(buttons[2]); // Click bench
      expect(onChange).toHaveBeenCalledWith("bench");

      expect(onChange).toHaveBeenCalledTimes(2);
    });
  });

  describe("Shirt number input", () => {
    it("should show shirt number input when starter is selected", () => {
      render(
        <LineupToggle
          player={mockPlayer}
          selected="starter"
          onChange={vi.fn()}
        />
      );

      const input = screen.getByLabelText(`Número de camisola para ${mockPlayer.full_name}`);
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute("type", "number");
      expect(input).toHaveAttribute("min", "1");
      expect(input).toHaveAttribute("max", "99");
    });

    it("should not show shirt number input when not starter", () => {
      const { rerender } = render(
        <LineupToggle
          player={mockPlayer}
          selected={null}
          onChange={vi.fn()}
        />
      );

      expect(
        screen.queryByLabelText(`Número de camisola para ${mockPlayer.full_name}`)
      ).not.toBeInTheDocument();

      rerender(
        <LineupToggle
          player={mockPlayer}
          selected="bench"
          onChange={vi.fn()}
        />
      );

      expect(
        screen.queryByLabelText(`Número de camisola para ${mockPlayer.full_name}`)
      ).not.toBeInTheDocument();
    });

    it("should call onChange with shirt number when input changes", () => {
      const onChange = vi.fn();
      render(
        <LineupToggle
          player={mockPlayer}
          selected="starter"
          onChange={onChange}
          shirtNum={null}
        />
      );

      const input = screen.getByLabelText(`Número de camisola para ${mockPlayer.full_name}`) as HTMLInputElement;
      fireEvent.change(input, { target: { value: "7" } });

      expect(onChange).toHaveBeenCalledWith("starter", 7);
    });

    it("should display existing shirt number", () => {
      render(
        <LineupToggle
          player={mockPlayer}
          selected="starter"
          onChange={vi.fn()}
          shirtNum={10}
        />
      );

      const input = screen.getByLabelText(`Número de camisola para ${mockPlayer.full_name}`) as HTMLInputElement;
      expect(input.value).toBe("10");
    });

    it("should call onChange with null when input is cleared", () => {
      const onChange = vi.fn();
      render(
        <LineupToggle
          player={mockPlayer}
          selected="starter"
          onChange={onChange}
          shirtNum={7}
        />
      );

      const input = screen.getByLabelText(`Número de camisola para ${mockPlayer.full_name}`) as HTMLInputElement;
      fireEvent.change(input, { target: { value: "" } });

      expect(onChange).toHaveBeenCalledWith("starter", null);
    });
  });

  describe("Parental consent", () => {
    it("should show badge when parental consent not confirmed", () => {
      const { container } = render(
        <LineupToggle
          player={mockPlayer}
          selected={null}
          onChange={vi.fn()}
          parentalConsentConfirmed={false}
        />
      );

      const badge = container.querySelector("span.text-orange-600");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass("bg-orange-50");
    });

    it("should not show badge when parental consent confirmed", () => {
      render(
        <LineupToggle
          player={mockPlayer}
          selected={null}
          onChange={vi.fn()}
          parentalConsentConfirmed={true}
        />
      );

      expect(screen.queryByText("Aguarda")).not.toBeInTheDocument();
    });
  });

  describe("Disabled state", () => {
    it("should disable all buttons when disabled=true", () => {
      const { container } = render(
        <LineupToggle
          player={mockPlayer}
          selected={null}
          onChange={vi.fn()}
          disabled={true}
        />
      );

      const buttons = container.querySelectorAll("button");
      buttons.forEach((button) => {
        expect(button).toBeDisabled();
      });
    });

    it("should not call onChange when disabled and clicked", () => {
      const onChange = vi.fn();
      const { container } = render(
        <LineupToggle
          player={mockPlayer}
          selected="starter"
          onChange={onChange}
          disabled={true}
        />
      );

      const buttons = container.querySelectorAll("button");
      fireEvent.click(buttons[0]); // Click unselected button while disabled

      expect(onChange).not.toHaveBeenCalled();
    });

    it("should show disabled styling", () => {
      const { container } = render(
        <LineupToggle
          player={mockPlayer}
          selected={null}
          onChange={vi.fn()}
          disabled={true}
        />
      );

      const buttons = container.querySelectorAll("button");
      buttons.forEach((button) => {
        expect(button).toHaveClass("opacity-50", "cursor-not-allowed");
      });
    });

    it("should disable shirt number input when disabled=true", () => {
      const { container } = render(
        <LineupToggle
          player={mockPlayer}
          selected="starter"
          onChange={vi.fn()}
          disabled={true}
        />
      );

      const input = container.querySelector('input[type="number"]');
      expect(input).toBeDisabled();
    });
  });

  describe("Accessibility", () => {
    it("should have proper aria-label for group", () => {
      const { container } = render(
        <LineupToggle
          player={mockPlayer}
          selected={null}
          onChange={vi.fn()}
        />
      );

      const group = container.querySelector('[role="group"]');
      expect(group).toHaveAttribute("aria-label", `Seleção para ${mockPlayer.full_name}`);
    });

    it("should have aria-pressed attribute on buttons", () => {
      const { container } = render(
        <LineupToggle
          player={mockPlayer}
          selected="starter"
          onChange={vi.fn()}
        />
      );

      const buttons = container.querySelectorAll("button");
      buttons.forEach((button) => {
        expect(button).toHaveAttribute("aria-pressed");
      });
    });

    it("should have min height for touch targets (44px)", () => {
      const { container } = render(
        <LineupToggle
          player={mockPlayer}
          selected={null}
          onChange={vi.fn()}
        />
      );

      const buttons = container.querySelectorAll("button");
      buttons.forEach((button) => {
        expect(button).toHaveClass("min-h-[44px]");
      });
    });
  });
});
