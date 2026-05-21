import { z } from "zod";

export const PlayerMetricCreateSchema = z
  .object({
    player_id: z.string().uuid(),
    weight_kg: z.number().min(30).max(150).multipleOf(0.01).optional(),
    height_cm: z.number().min(100).max(220).multipleOf(0.01).optional(),
    recorded_at: z.string().datetime({ offset: true }),
  })
  .refine(
    (data) => data.weight_kg !== undefined || data.height_cm !== undefined,
    {
      message: "Preenche pelo menos peso ou altura",
      path: ["weight_kg"],
    }
  );

export const PlayerMetricUpdateSchema = z.object({
  id: z.string().uuid(),
  weight_kg: z.number().min(30).max(150).multipleOf(0.01).optional(),
  height_cm: z.number().min(100).max(220).multipleOf(0.01).optional(),
  recorded_at: z.string().datetime({ offset: true }).optional(),
});

export type PlayerMetricCreate = z.infer<typeof PlayerMetricCreateSchema>;
export type PlayerMetricUpdate = z.infer<typeof PlayerMetricUpdateSchema>;
