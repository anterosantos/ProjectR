import { z } from "zod";

export const SeasonCreateSchema = z
  .object({
    name: z.string().min(1, "Nome obrigatório").max(50, "Nome demasiado longo"),
    startDate: z.string().date("Data de início inválida"),
    endDate: z.string().date("Data de fim inválida"),
    setAsCurrent: z.boolean().default(false),
  })
  .refine((data) => data.endDate > data.startDate, {
    message: "Data de fim deve ser posterior à data de início",
    path: ["endDate"],
  });

export const SeasonUpdateSchema = z
  .object({
    id: z.string().uuid("ID de época inválido"),
    name: z.string().min(1, "Nome obrigatório").max(50, "Nome demasiado longo"),
    startDate: z.string().date("Data de início inválida"),
    endDate: z.string().date("Data de fim inválida"),
    setAsCurrent: z.boolean().default(false),
  })
  .refine((data) => data.endDate > data.startDate, {
    message: "Data de fim deve ser posterior à data de início",
    path: ["endDate"],
  });

export type SeasonCreate = z.infer<typeof SeasonCreateSchema>;
export type SeasonUpdate = z.infer<typeof SeasonUpdateSchema>;

export type Season = {
  id: string;
  club_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  created_at: string;
};
