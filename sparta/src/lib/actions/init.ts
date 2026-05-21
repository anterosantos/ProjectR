"use server";

import { logTelemetry } from "./telemetry";

/**
 * Initialize telemetry on app startup
 * Called from a layout or initial component to track app usage
 *
 * Awaits logTelemetry to ensure the event is recorded within the request lifecycle.
 * logTelemetry itself is fire-and-forget: it always returns ok(undefined) and never throws.
 */
export async function trackAppInitialized() {
  await logTelemetry("app_initialized", {
    timestamp: new Date().toISOString(),
  });
}
