import { z } from "zod";

/**
 * Zod schema for telemetry payload validation.
 * Accepts any JSON-serializable value (object, array, primitive).
 * Lives outside "use server" so it can be imported by tests and non-server code.
 */
export const TelemetryPayloadSchema = z.custom<unknown>(
  (val) => {
    try {
      JSON.stringify(val);
      return true;
    } catch {
      return false;
    }
  },
  "payload must be JSON-serializable"
);

export type TelemetryPayload = z.infer<typeof TelemetryPayloadSchema>;
