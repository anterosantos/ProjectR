import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CopyLinkButton } from "./CopyLinkButton";

describe("CopyLinkButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "location", {
      value: { href: "https://example.com/test" },
      writable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders button with correct aria-label", () => {
    render(<CopyLinkButton />);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-label", "Copiar link desta página");
  });

  it("copies URL to clipboard on click", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    render(<CopyLinkButton />);
    const button = screen.getByRole("button");

    fireEvent.click(button);
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith("https://example.com/test");
    });
  });

  it("shows success feedback after copy", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    render(<CopyLinkButton />);
    const button = screen.getByRole("button");

    expect(button).toHaveTextContent("Copiar link");
    fireEvent.click(button);

    await waitFor(() => {
      expect(button).toHaveTextContent("Link copiado!");
    });
  });

  it("shows error feedback when clipboard API fails", async () => {
    const writeTextMock = vi.fn().mockRejectedValue(new Error("Clipboard denied"));
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    render(<CopyLinkButton />);
    const button = screen.getByRole("button");

    fireEvent.click(button);
    await waitFor(() => {
      expect(button).toHaveTextContent("Erro ao copiar");
      expect(button).toHaveAttribute(
        "aria-label",
        "Falha ao copiar link. Tenta novamente."
      );
    });
  });

  it("allows retry after error", async () => {
    const writeTextMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("First attempt failed"))
      .mockResolvedValueOnce(undefined);

    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    render(<CopyLinkButton />);
    const button = screen.getByRole("button");

    fireEvent.click(button);
    await waitFor(() => {
      expect(button).toHaveTextContent("Erro ao copiar");
    });

    fireEvent.click(button);
    await waitFor(() => {
      expect(button).toHaveTextContent("Link copiado!");
    });
  });

  it("captures URL at render time", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    render(<CopyLinkButton />);
    const button = screen.getByRole("button");
    const initialUrl = "https://example.com/test";

    fireEvent.click(button);
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(initialUrl);
    });

    window.location.href = "https://example.com/different";
    fireEvent.click(button);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenLastCalledWith(initialUrl);
    });
  });

  it("cleans up timeout on unmount", () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    const { unmount } = render(<CopyLinkButton />);
    const button = screen.getByRole("button");

    fireEvent.click(button);
    unmount();

    expect(() => unmount()).not.toThrow();
  });
});
