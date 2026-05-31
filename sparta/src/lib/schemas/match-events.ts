import { z } from "zod";

export const MATCH_ACTIONS = [
  "ball_loss",
  "ball_recovery",
  "shot_total",
  "shot_on_target",
  "pass_completed",
  "def_pressure",
  "def_action_success",
  "off_action_success",
] as const;

export const MATCH_ZONES = [
  "def_left",
  "def_center",
  "def_right",
  "mid_left",
  "mid_center",
  "mid_right",
  "att_left",
  "att_center",
  "att_right",
] as const;

export const MatchEventInputSchema = z.object({
  id: z.string().uuid("ID deve ser UUID válido"),
  action: z.enum(MATCH_ACTIONS),
  zone: z.enum(MATCH_ZONES),
  player_id: z.string().uuid("ID do jogador inválido"),
  session_id: z.string().uuid("ID da sessão inválido"),
  occurred_at: z.string().datetime("Horário inválido"),
  captured_via: z.enum(["online", "offline-drain"]).default("online"),
});

export type MatchEventInput = z.infer<typeof MatchEventInputSchema>;

export const MatchEventUpdateSchema = z
  .object({
    action: z.enum(MATCH_ACTIONS).optional(),
    zone: z.enum(MATCH_ZONES).optional(),
  })
  .refine((d) => d.action !== undefined || d.zone !== undefined, {
    message: "Pelo menos um campo (action ou zone) deve ser alterado",
  });

export type MatchEventUpdate = z.infer<typeof MatchEventUpdateSchema>;

export interface SessionEventEntry {
  id: string;
  action: (typeof MATCH_ACTIONS)[number];
  zone: (typeof MATCH_ZONES)[number];
  player_id: string | null;
  player_name: string | null;
  jersey_number: number | null;
  occurred_at: string;
  captured_via: "online" | "offline-drain";
}
