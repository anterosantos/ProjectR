import { z } from "zod";

export const ATTENDANCE_STATUSES = [
  "present",
  "absent",
  "late",
  "injured",
  "excused",
] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const UpsertAttendanceInputSchema = z.object({
  id: z.string().uuid(),
  session_id: z.string().uuid(),
  player_id: z.string().uuid(),
  status: z.enum(ATTENDANCE_STATUSES),
  note: z.string().max(500).optional(),
});

export type UpsertAttendanceInput = z.infer<typeof UpsertAttendanceInputSchema>;

export interface AttendanceRecord {
  player_id: string;
  status: AttendanceStatus;
  note: string | null;
  recorded_at: string;
}

export interface PlayerForAttendance {
  id: string;
  full_name: string;
  jersey_num: number;
  primary_position: string | null;
  is_active: boolean;
}
