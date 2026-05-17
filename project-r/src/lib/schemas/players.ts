import { z } from "zod";
import { differenceInYears } from "date-fns";

export const POSITIONS = [
  "GR",
  "DD", "DC", "DE", "LIB",
  "MDC", "MC", "MO", "MD", "ME",
  "EXD", "EXE", "SC", "PL",
] as const;

export type Position = (typeof POSITIONS)[number];

export const AGE_GROUPS = ["u14", "u15", "u17", "u19", "senior"] as const;

export type AgeGroup = (typeof AGE_GROUPS)[number];

export const PositionSchema = z.object({
  position: z.string().min(1, "Posição obrigatória"),
  isPrimary: z.boolean(),
  sortOrder: z.number().int().min(0).max(4),
});

export const PlayerCreateSchema = z.object({
  fullName: z.string().min(2, "Nome demasiado curto").max(100, "Nome demasiado longo"),
  birthdate: z.string().date("Data inválida").refine(
    (dateStr) => {
      const age = differenceInYears(new Date(), new Date(dateStr));
      return age >= 4 && age <= 100;
    },
    "Data de nascimento inválida (idade deve ser 4-100 anos)"
  ),
  jerseyNum: z
    .number({ message: "Número de camisola inválido" })
    .int("Número inteiro obrigatório")
    .min(1, "Mínimo 1")
    .max(99, "Máximo 99"),
  ageGroup: z.enum(AGE_GROUPS, { error: "Escalão inválido" }),
  positions: z
    .array(PositionSchema)
    .min(1, "Mínimo 1 posição obrigatória")
    .max(5, "Máximo 5 posições (1 primária + 4 alternativas)")
    .refine(
      (positions) => positions.filter((p) => p.isPrimary).length === 1,
      "Exactamente 1 posição primária obrigatória"
    ),
});

export const PlayerUpdateSchema = PlayerCreateSchema.extend({
  playerId: z.string().uuid("ID de jogador inválido"),
});

export const ArchivePlayerSchema = z.object({
  playerId: z.string().uuid("ID de jogador inválido"),
});

export type PlayerCreate = z.infer<typeof PlayerCreateSchema>;
export type PlayerUpdate = z.infer<typeof PlayerUpdateSchema>;
export type ArchivePlayer = z.infer<typeof ArchivePlayerSchema>;
