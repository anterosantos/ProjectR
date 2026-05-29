import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ActionButton } from "@/components/domain/match-event-capture/action-button";

const ACTIONS = [
  "ball_loss",
  "ball_recovery",
  "shot_total",
  "shot_on_target",
  "pass_completed",
  "def_pressure",
  "def_action_success",
  "off_action_success",
] as const;

describe("<ActionButton>", () => {
  it.each(ACTIONS)("renders button for action %s", (action) => {
    render(<ActionButton action={action} />);
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
  });

  it("calls onClick with the action when clicked", () => {
    const onClick = vi.fn();
    render(<ActionButton action="ball_loss" onClick={onClick} />);

    const button = screen.getByRole("button");
    button.click();

    expect(onClick).toHaveBeenCalledWith("ball_loss");
  });

  it("has correct aria-label for ball_loss", () => {
    render(<ActionButton action="ball_loss" />);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-label", "Perda de bola");
  });

  it("has correct aria-label for pass_completed", () => {
    render(<ActionButton action="pass_completed" />);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-label", "Passe completado");
  });

  it("renders with red border for negative action (ball_loss)", () => {
    const { container } = render(<ActionButton action="ball_loss" />);
    const button = container.querySelector("button");
    expect(button?.className).toContain("border-l-red-500");
  });

  it("renders with green border for positive action (ball_recovery)", () => {
    const { container } = render(<ActionButton action="ball_recovery" />);
    const button = container.querySelector("button");
    expect(button?.className).toContain("border-l-emerald-500");
  });

  it("renders with red border for def_pressure (negative)", () => {
    const { container } = render(<ActionButton action="def_pressure" />);
    const button = container.querySelector("button");
    expect(button?.className).toContain("border-l-red-500");
  });

  it("renders with green border for def_action_success (positive)", () => {
    const { container } = render(<ActionButton action="def_action_success" />);
    const button = container.querySelector("button");
    expect(button?.className).toContain("border-l-emerald-500");
  });

  it("does not render if action is unknown", () => {
    // @ts-expect-error Testing invalid action
    const { container } = render(<ActionButton action="invalid_action" />);
    const button = container.querySelector("button");
    expect(button).not.toBeInTheDocument();
  });
});
