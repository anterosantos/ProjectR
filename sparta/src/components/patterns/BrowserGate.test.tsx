import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { BrowserGate } from "./BrowserGate";
import type { BrowserEnvironment } from "@/lib/pwa/webview-detection";

vi.mock("@/lib/pwa/webview-detection", () => ({
  detectBrowserEnvironment: vi.fn(),
  isServiceWorkerSupported: vi.fn(),
}));

import {
  detectBrowserEnvironment,
  isServiceWorkerSupported,
} from "@/lib/pwa/webview-detection";

const mockDetect = vi.mocked(detectBrowserEnvironment);
const mockSwSupported = vi.mocked(isServiceWorkerSupported);

function setup(env: BrowserEnvironment, swSupported = true) {
  mockDetect.mockReturnValue(env);
  mockSwSupported.mockReturnValue(swSupported);
}

describe("BrowserGate", () => {
  beforeEach(() => {
    setup({ type: "supported" });
  });

  it("renders children when browser is supported", async () => {
    setup({ type: "supported" });

    await act(async () => {
      render(
        <BrowserGate>
          <div>App content</div>
        </BrowserGate>
      );
    });

    expect(screen.getByText("App content")).toBeInTheDocument();
  });

  it("renders WebViewBlockPage when detection returns webview (Facebook)", async () => {
    setup({ type: "webview", webViewSource: "facebook" });

    await act(async () => {
      render(
        <BrowserGate>
          <div>App content</div>
        </BrowserGate>
      );
    });

    expect(
      screen.getByRole("heading", { name: /Abre o SPARTA no teu browser principal/i })
    ).toBeInTheDocument();
    expect(screen.queryByText("App content")).not.toBeInTheDocument();
  });

  it("renders UnsupportedBrowserPage when detection returns unsupported UA", async () => {
    setup({ type: "unsupported" });

    await act(async () => {
      render(
        <BrowserGate>
          <div>App content</div>
        </BrowserGate>
      );
    });

    expect(
      screen.getByRole("heading", { name: /Este site precisa de um browser moderno/i })
    ).toBeInTheDocument();
    expect(screen.queryByText("App content")).not.toBeInTheDocument();
  });

  it("renders UnsupportedBrowserPage when Service Worker is not available", async () => {
    setup({ type: "supported" }, false);

    await act(async () => {
      render(
        <BrowserGate>
          <div>App content</div>
        </BrowserGate>
      );
    });

    expect(
      screen.getByRole("heading", { name: /Este site precisa de um browser moderno/i })
    ).toBeInTheDocument();
    expect(screen.queryByText("App content")).not.toBeInTheDocument();
  });
});
