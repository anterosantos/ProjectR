import { z } from "zod";

const SESSION_TYPES = ["training", "match", "friendly"] as const;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const SessionCreateSchema = z
  .object({
    type: z.enum(SESSION_TYPES),
    scheduledAt: z.string().min(1, "Data e hora obrigatórias"),
    durationMin: z
      .number()
      .int()
      .min(15, "Duração deve estar entre 15 e 240 minutos")
      .max(240, "Duração deve estar entre 15 e 240 minutos")
      .default(90),
    location: z
      .string()
      .max(100, "Local demasiado longo (máx. 100 caracteres)")
      .optional(),
    notes: z
      .string()
      .max(500, "Notas demasiado longas (máx. 500 caracteres)")
      .optional(),
  })
  .refine(
    (data) => {
      const scheduled = new Date(data.scheduledAt).getTime();
      const oneDayAgo = Date.now() - ONE_DAY_MS;
      return scheduled >= oneDayAgo;
    },
    {
      message: "Data não pode ser passada (máx. retaguarda 24h)",
      path: ["scheduledAt"],
    }
  );

export const SessionUpdateSchema = z
  .object({
    id: z.string().uuid("ID de sessão inválido"),
    type: z.enum(SESSION_TYPES),
    scheduledAt: z.string().min(1, "Data e hora obrigatórias"),
    durationMin: z
      .number()
      .int()
      .min(15, "Duração deve estar entre 15 e 240 minutos")
      .max(240, "Duração deve estar entre 15 e 240 minutos")
      .default(90),
    location: z
      .string()
      .max(100, "Local demasiado longo (máx. 100 caracteres)")
      .optional(),
    notes: z
      .string()
      .max(500, "Notas demasiado longas (máx. 500 caracteres)")
      .optional(),
  })
  .refine(
    (data) => {
      const scheduled = new Date(data.scheduledAt).getTime();
      const oneDayAgo = Date.now() - ONE_DAY_MS;
      return scheduled >= oneDayAgo;
    },
    {
      message: "Data não pode ser passada (máx. retaguarda 24h)",
      path: ["scheduledAt"],
    }
  );

export type SessionCreate = z.infer<typeof SessionCreateSchema>;
export type SessionUpdate = z.infer<typeof SessionUpdateSchema>;
export type SessionType = (typeof SESSION_TYPES)[number];
export type SessionStatus = "scheduled" | "cancelled" | "completed";

export type Session = {
  id: string;
  club_id: string;
  season_id: string;
  type: SessionType;
  scheduled_at: string;
  duration_min: number;
  location: string | null;
  status: SessionStatus;
  notes: string | null;
  created_by: string;
  created_at: string;
};
