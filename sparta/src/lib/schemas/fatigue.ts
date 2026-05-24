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
 */
export const FatigueResponseSchema = FatigueResponseBaseSchema.refine(
  (d) => (d.phase === "pre" ? d.srpe_value == null : true),
  {
    message: "srpe_value só é permitido na fase pós-sessão",
    path: ["srpe_value"],
  }
);

export type FatigueResponseInput = z.infer<typeof FatigueResponseSchema>;
