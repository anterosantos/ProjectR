"use client";

import { useState, useEffect } from "react";
import {
  detectBrowserEnvironment,
  isServiceWorkerSupported,
  type BrowserEnvironment,
} from "@/lib/pwa/webview-detection";
import { WebViewBlockPage } from "./WebViewBlockPage";
import { UnsupportedBrowserPage } from "./UnsupportedBrowserPage";

interface BrowserGateProps {
  children: React.ReactNode;
}

export function BrowserGate({ children }: BrowserGateProps) {
  const [env, setEnv] = useState<BrowserEnvironment | null>(null);

  useEffect(() => {
    // Detect browser environment from user agent string
    const detected = detectBrowserEnvironment(navigator.userAgent);

    // Additional runtime check: even if browser appears supported,
    // verify Service Worker API is available. This is a critical requirement
    // for PWA functionality. If not available, treat as unsupported.
    // This is separate from UA-based detection to catch edge cases where
    // a browser claims support but lacks the API at runtime.
    const resolved: BrowserEnvironment =
      detected.type === "supported" && !isServiceWorkerSupported()
        ? { type: "unsupported" }
        : detected;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnv(resolved);
  }, []);

  // null = SSR / first render: show children to avoid blank flash
  // Hydration will replace with block page if needed after client-side detection
  if (env === null) return <>{children}</>;
  if (env.type === "webview") return <WebViewBlockPage />;
  if (env.type === "unsupported") return <UnsupportedBrowserPage />;
  return <>{children}</>;
}
