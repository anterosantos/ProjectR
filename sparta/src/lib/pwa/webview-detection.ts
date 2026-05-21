export type BrowserEnvironment = {
  type: "webview" | "unsupported" | "supported";
  webViewSource?: "facebook" | "instagram" | "whatsapp" | "other";
};

// WebView detection patterns (checked first to prioritize blocking WebViews)
// Order matters: Facebook patterns checked first, then Instagram, then WhatsApp
// If a UA string matches multiple patterns, the first match wins
const WEBVIEW_PATTERNS: Array<{ pattern: RegExp; source: BrowserEnvironment["webViewSource"] }> = [
  { pattern: /FBAN|FBAV|FB_IAB|FB4A|FBBV/i, source: "facebook" },
  { pattern: /Instagram/i, source: "instagram" },
  { pattern: /WhatsApp/i, source: "whatsapp" },
];

// Unsupported browser patterns (IE 11, Opera Mini, UC Browser)
// These browsers lack Service Worker support or other critical APIs
const UNSUPPORTED_PATTERNS: RegExp[] = [
  /Trident\/7/i,   // IE 11
  /Opera Mini/i,   // Opera Mini
  /UCBrowser/i,    // UC Browser
];

export function isWebView(ua: string): boolean {
  if (!ua || typeof ua !== "string") return false;
  return WEBVIEW_PATTERNS.some(({ pattern }) => pattern.test(ua));
}

export function getWebViewSource(ua: string): BrowserEnvironment["webViewSource"] {
  if (!ua || typeof ua !== "string") return "other";
  for (const { pattern, source } of WEBVIEW_PATTERNS) {
    if (pattern.test(ua)) return source;
  }
  return "other";
}

export function isUnsupportedBrowser(ua: string): boolean {
  if (!ua || typeof ua !== "string") return false;
  return UNSUPPORTED_PATTERNS.some((pattern) => pattern.test(ua));
}

export function isServiceWorkerSupported(): boolean {
  if (typeof navigator === "undefined") return false;
  return "serviceWorker" in navigator;
}

export function detectBrowserEnvironment(ua: string): BrowserEnvironment {
  // Empty UA is treated as unsupported (fail-safe)
  if (!ua || ua.trim() === "") {
    return { type: "unsupported" };
  }

  if (isWebView(ua)) {
    return { type: "webview", webViewSource: getWebViewSource(ua) };
  }
  if (isUnsupportedBrowser(ua)) {
    return { type: "unsupported" };
  }
  return { type: "supported" };
}
