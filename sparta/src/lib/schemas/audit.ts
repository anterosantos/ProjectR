import { z } from "zod";

export const AuditLogInputSchema = z.object({
  action: z
    .string()
    .regex(
      /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/,
      "action must be in domain.verb format (e.g., 'health_data.read')"
    ),
  targetKind: z
    .string()
    .regex(
      /^[a-z][a-z0-9_]*$/,
      "targetKind must be snake_case (e.g., 'fatigue_response')"
    ),
  targetId: z.string().uuid().optional().nullable(),
  context: z.record(z.string(), z.unknown()).optional(),
});
