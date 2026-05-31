import { z } from 'zod'

export const UpsertSessionSrpeInputSchema = z.object({
  id: z.string().uuid(),
  session_id: z.string().uuid(),
  player_id: z.string().uuid(),
  srpe_value: z.number().int().min(1).max(10),
  duration_min: z.number().int().min(15).max(240),
})

export type UpsertSessionSrpeInput = z.infer<typeof UpsertSessionSrpeInputSchema>

export interface PlayerSrpeEntry {
  player_id: string
  full_name: string
  jersey_num: number | null
  primary_position: string | null
  is_active: boolean
  attendance_status: 'present' | 'absent' | 'late' | 'injured' | 'excused' | null
  existing_analyst_srpe: number | null // valor já registado pelo analista
  player_submitted_srpe: number | null // valor self-reported pelo jogador
}
