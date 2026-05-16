import { describe, it, expect } from "vitest";
import {
  isWebView,
  isUnsupportedBrowser,
  detectBrowserEnvironment,
} from "@/lib/pwa/webview-detection";

// Real-world UA strings collected from devices
const UA_FACEBOOK_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/123.0.0.0.0;]";
const UA_FACEBOOK_ANDROID =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36 [FBAN/FB4A;FBDV/Pixel;]";
const UA_INSTAGRAM_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Instagram 123.0.0.0.0";
const UA_INSTAGRAM_ANDROID =
  "Mozilla/5.0 (Linux; Android 13; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36 Instagram 123.0.0.0.0";
const UA_WHATSAPP_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) WhatsApp/2.23.25.79";
const UA_WHATSAPP_ANDROID =
  "Mozilla/5.0 (Linux; Android 13; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36 WhatsApp/2.23.25.79";
const UA_IE11 =
  "Mozilla/5.0 (Windows NT 10.0; Trident/7.0; rv:11.0) like Gecko";
const UA_OPERA_MINI =
  "Opera/9.80 (Android; Opera Mini/8.0.1807/28.204; U; pt) Presto/2.12.407 Version/12.50";
const UA_UC_BROWSER =
  "Mozilla/5.0 (Linux; U; Android 13; en-US; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 UCBrowser/13.4.0.1306 Mobile Safari/537.36";
const UA_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const UA_SAFARI_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1";
const UA_FIREFOX =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0";
const UA_EDGE =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0";
const UA_SAMSUNG =
  "Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/22.0 Chrome/111.0.5563.116 Mobile Safari/537.36";

describe("isWebView", () => {
  it("detects Facebook iOS WebView", () => {
    expect(isWebView(UA_FACEBOOK_IOS)).toBe(true);
  });

  it("detects Facebook Android WebView", () => {
    expect(isWebView(UA_FACEBOOK_ANDROID)).toBe(true);
  });

  it("detects Instagram iOS WebView", () => {
    expect(isWebView(UA_INSTAGRAM_IOS)).toBe(true);
  });

  it("detects Instagram Android WebView", () => {
    expect(isWebView(UA_INSTAGRAM_ANDROID)).toBe(true);
  });

  it("detects WhatsApp iOS WebView", () => {
    expect(isWebView(UA_WHATSAPP_IOS)).toBe(true);
  });

  it("detects WhatsApp Android WebView", () => {
    expect(isWebView(UA_WHATSAPP_ANDROID)).toBe(true);
  });

  it("does not flag Chrome as WebView", () => {
    expect(isWebView(UA_CHROME)).toBe(false);
  });

  it("does not flag Safari iOS as WebView", () => {
    expect(isWebView(UA_SAFARI_IOS)).toBe(false);
  });

  it("does not flag Firefox as WebView", () => {
    expect(isWebView(UA_FIREFOX)).toBe(false);
  });
});

describe("isUnsupportedBrowser", () => {
  it("detects IE 11 via Trident/7", () => {
    expect(isUnsupportedBrowser(UA_IE11)).toBe(true);
  });

  it("detects Opera Mini", () => {
    expect(isUnsupportedBrowser(UA_OPERA_MINI)).toBe(true);
  });

  it("detects UC Browser", () => {
    expect(isUnsupportedBrowser(UA_UC_BROWSER)).toBe(true);
  });

  it("does not flag Chrome as unsupported", () => {
    expect(isUnsupportedBrowser(UA_CHROME)).toBe(false);
  });

  it("does not flag Safari iOS as unsupported", () => {
    expect(isUnsupportedBrowser(UA_SAFARI_IOS)).toBe(false);
  });

  it("does not flag Firefox as unsupported", () => {
    expect(isUnsupportedBrowser(UA_FIREFOX)).toBe(false);
  });

  it("does not flag Edge as unsupported", () => {
    expect(isUnsupportedBrowser(UA_EDGE)).toBe(false);
  });

  it("does not flag Samsung Internet as unsupported", () => {
    expect(isUnsupportedBrowser(UA_SAMSUNG)).toBe(false);
  });
});

describe("detectBrowserEnvironment", () => {
  it("returns webview for Facebook iOS with source=facebook", () => {
    const env = detectBrowserEnvironment(UA_FACEBOOK_IOS);
    expect(env.type).toBe("webview");
    expect(env.webViewSource).toBe("facebook");
  });

  it("returns webview for Facebook Android with source=facebook", () => {
    const env = detectBrowserEnvironment(UA_FACEBOOK_ANDROID);
    expect(env.type).toBe("webview");
    expect(env.webViewSource).toBe("facebook");
  });

  it("returns webview for Instagram with source=instagram", () => {
    const env = detectBrowserEnvironment(UA_INSTAGRAM_IOS);
    expect(env.type).toBe("webview");
    expect(env.webViewSource).toBe("instagram");
  });

  it("returns webview for WhatsApp with source=whatsapp", () => {
    const env = detectBrowserEnvironment(UA_WHATSAPP_IOS);
    expect(env.type).toBe("webview");
    expect(env.webViewSource).toBe("whatsapp");
  });

  it("returns unsupported for IE 11", () => {
    const env = detectBrowserEnvironment(UA_IE11);
    expect(env.type).toBe("unsupported");
    expect(env.webViewSource).toBeUndefined();
  });

  it("returns unsupported for Opera Mini", () => {
    const env = detectBrowserEnvironment(UA_OPERA_MINI);
    expect(env.type).toBe("unsupported");
  });

  it("returns unsupported for UC Browser", () => {
    const env = detectBrowserEnvironment(UA_UC_BROWSER);
    expect(env.type).toBe("unsupported");
  });

  it("returns supported for Chrome", () => {
    expect(detectBrowserEnvironment(UA_CHROME).type).toBe("supported");
  });

  it("returns supported for Safari iOS", () => {
    expect(detectBrowserEnvironment(UA_SAFARI_IOS).type).toBe("supported");
  });

  it("returns supported for Firefox", () => {
    expect(detectBrowserEnvironment(UA_FIREFOX).type).toBe("supported");
  });

  it("returns supported for Edge", () => {
    expect(detectBrowserEnvironment(UA_EDGE).type).toBe("supported");
  });

  it("returns supported for Samsung Internet", () => {
    expect(detectBrowserEnvironment(UA_SAMSUNG).type).toBe("supported");
  });

  it("prioritises webview over unsupported when both patterns could match", () => {
    // A WhatsApp UA on a hypothetical old browser should still be treated as webview
    const hybridUA = `${UA_WHATSAPP_IOS} Trident/7.0`;
    expect(detectBrowserEnvironment(hybridUA).type).toBe("webview");
  });
});
