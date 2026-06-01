export interface ConsentReconfirmation {
  id: string
  club_id: string
  player_id: string
  profile_id: string
  token: string
  status: 'pending' | 'confirmed' | 'anonymized'
  created_at: string
  confirmed_at: string | null
  anonymized_at: string | null
}
