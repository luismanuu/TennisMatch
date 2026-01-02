export interface User {
  id: string
  email: string
  firstName?: string
  lastName?: string
  imageUrl?: string
}

export interface Category {
  id: string
  name: string
  description?: string
  order: number
  created_at: string
  updated_at: string
}

export interface Player {
  id: string
  clerk_id: string
  name: string
  phone_number?: string
  category_id?: string
  category?: Category
  elo: number
  created_at: string
  updated_at: string
}

export interface CreatePlayerPayload {
  name: string
  phone_number?: string
  category_id: string
}

export interface UpdatePlayerPayload {
  name?: string
  phone_number?: string
  category_id?: string
}

export interface PendingPlayer {
  id: string
  name: string
  email: string
  category_id: string
  category?: Category
  invited_by_player_id: string
  invited_by_player?: Player
  clerk_invitation_id?: string
  invitation_token?: string
  status: 'pending' | 'accepted' | 'expired'
  created_at: string
  updated_at: string
}

export interface Match {
  id: string
  player1_id: string
  player1?: Player
  player2_id?: string
  player2?: Player
  pending_player2_id?: string
  pending_player2?: PendingPlayer
  winner_id?: string
  winner?: Player
  tournament_id?: string
  status: 'scheduled' | 'active' | 'completed' | 'cancelled'
  score?: string
  scheduled_at: string
  played_at?: string
  score_proposed_by?: string
  score_proposed_by_player?: Player
  score_proposed_at?: string
  score_approved_by?: string
  score_approved_by_player?: Player
  location?: string
  created_at: string
  updated_at: string
  messages?: MatchMessage[]
}

export interface Tournament {
  id: string
  name: string
  category: string
  start_date: string
  end_date?: string
  status: 'upcoming' | 'active' | 'completed'
  created_at: string
}

export interface CreateMatchPayload {
  player1_id: string
  player2_id?: string
  pending_player2_id?: string
  scheduled_at: string
  location?: string
}

export interface CreatePendingPlayerPayload {
  name: string
  email: string
  category_id: string
  invited_by_player_id: string
}

export interface PlayerSearchResult {
  id: string
  name: string
  category?: Category
}

export interface MatchMessage {
  id: string
  match_id: string
  player_id: string
  player?: Player
  message: string
  created_at: string
}

export interface ProposeScorePayload {
  score: string
  winner_id: string
}

export interface ApproveScorePayload {
  // No additional fields needed, just approval
}

export interface UpdateMatchStatusPayload {
  status: 'scheduled' | 'active' | 'completed' | 'cancelled'
}

export interface CreateMatchMessagePayload {
  message: string
}

