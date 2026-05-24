import { z } from "zod";

const DimensionScore = z.number().int().min(1).max(5);

/**
 * Base object schema — use this when you need .omit()/.pick()/.extend().
 * ZodEffects (schemas with .refine()) do not support those methods.
 */
export const FatigueResponseBaseSchema = z.object({
  id: z.string().uuid(), // client-generated UUIDv7 (NFR48, AR4)
  player_id: z.string().uuid(),
  session_id: z.string().uuid(),
  phase: z.enum(["pre", "post"]),
  dim_energy: DimensionScore,
  dim_focus: DimensionScore,
  dim_sleep: DimensionScore,
  dim_soreness: DimensionScore,
  dim_mood: DimensionScore,
  srpe_value: z.number().int().min(1).max(10).nullable().optional(),
  submitted_via: z.enum(["online", "offline-drain"]).default("online"),
});

/**
 * Full validated schema — includes the sRPE/phase cross-field refinement.
 * Use for final validation before insert/submit.
 *
 * Refine (Story 5.1):
 * - PRE phase: srpe_value MUST be null (not provided)
 * - POST phase: srpe_value MUST be a number (1–10), not null
 */
export const FatigueResponseSchema = FatigueResponseBaseSchema.refine(
  (d) => {
    if (d.phase === "pre") return d.srpe_value == null;
    if (d.phase === "post") return d.srpe_value != null;
    return true;
  },
  {
    message: "post phase requer srpe_value (1–10); pre phase não permite",
    path: ["srpe_value"],
  }
);

export type FatigueResponseInput = z.infer<typeof FatigueResponseSchema>;
