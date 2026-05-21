import type { SessionType } from "@/lib/schemas/sessions"

export interface SessionColorConfig {
  bg: string
  bgDark: string
  label: string
}

export const SESSION_TYPE_COLORS: Record<SessionType, SessionColorConfig> = {
  training: { bg: "#2563EB", bgDark: "rgba(37,99,235,0.8)", label: "Treino" },
  match:    { bg: "#DC2626", bgDark: "rgba(220,38,38,0.8)",  label: "Jogo" },
  friendly: { bg: "#CA8A04", bgDark: "rgba(202,138,4,0.8)",  label: "Amigável" },
}
