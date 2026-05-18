import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSeasonView } from "@/hooks/useSeasonView";

describe("useSeasonView", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("começa com 'current' por defeito", () => {
    const { result } = renderHook(() => useSeasonView());
    const [view] = result.current;
    expect(view).toBe("current");
  });

  it("lê valor 'cumulative' do localStorage ao montar", async () => {
    localStorage.setItem("season_view", "cumulative");
    const { result } = renderHook(() => useSeasonView());

    // Wait for useEffect
    await act(async () => {});

    const [view] = result.current;
    expect(view).toBe("cumulative");
  });

  it("lê valor 'current' do localStorage ao montar", async () => {
    localStorage.setItem("season_view", "current");
    const { result } = renderHook(() => useSeasonView());

    await act(async () => {});

    const [view] = result.current;
    expect(view).toBe("current");
  });

  it("ignora valores inválidos no localStorage", async () => {
    localStorage.setItem("season_view", "invalid-value");
    const { result } = renderHook(() => useSeasonView());

    await act(async () => {});

    const [view] = result.current;
    expect(view).toBe("current");
  });

  it("altera para 'cumulative' e persiste no localStorage", () => {
    const { result } = renderHook(() => useSeasonView());

    act(() => {
      const [, setView] = result.current;
      setView("cumulative");
    });

    const [view] = result.current;
    expect(view).toBe("cumulative");
    expect(localStorage.getItem("season_view")).toBe("cumulative");
  });

  it("altera de volta para 'current' e persiste no localStorage", () => {
    localStorage.setItem("season_view", "cumulative");
    const { result } = renderHook(() => useSeasonView());

    act(() => {
      const [, setView] = result.current;
      setView("current");
    });

    const [view] = result.current;
    expect(view).toBe("current");
    expect(localStorage.getItem("season_view")).toBe("current");
  });
});
