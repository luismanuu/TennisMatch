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
  status?: 'active' | 'deleted'
  deleted_at?: string
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
  category_id?: string | null
  category?: Category
  invited_by_player_id?: string | null
  invited_by_player?: Player
  clerk_invitation_id?: string
  invitation_token?: string
  status: 'pending' | 'accepted' | 'expired' | 'revoked'
  created_at: string
  updated_at: string
  role?: 'player' | 'tournament_organizer' // Role from invitation metadata
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
  tournament?: Tournament
  status: 'scheduled' | 'active' | 'completed' | 'cancelled'
  score?: string
  scheduled_at: string
  played_at?: string
  score_proposed_by?: string
  score_proposed_by_player?: Player
  score_proposed_at?: string
  score_approved_by?: string
  score_approved_by_player?: Player
  reschedule_proposed_by?: string
  reschedule_proposed_by_player?: Player
  reschedule_proposed_at?: string
  reschedule_proposed_scheduled_at?: string
  reschedule_approved_by?: string
  reschedule_approved_by_player?: Player
  reschedule_rejected_by?: string
  reschedule_rejected_by_player?: Player
  location?: string
  created_at: string
  updated_at: string
  messages?: MatchMessage[]
}

export interface Tournament {
  id: string
  name: string
  category_id?: string | null
  category?: Category
  start_date: string
  end_date?: string
  status: 'upcoming' | 'active' | 'completed'
  tournament_type?: 'groups_playoffs' | 'single_elimination' | 'double_elimination' | 'round_robin'
  current_phase?: 'registration' | 'group_stage' | 'playoffs' | 'completed'
  group_size: number
  players_per_group_advance: number
  registration_open: boolean
  registration_deadline?: string
  max_players?: number
  min_players: number
  created_by: string
  created_by_player?: Player
  organizer_id?: string
  organizer?: Player
  description?: string
  rules?: string
  location?: string
  created_at: string
  updated_at: string
}

export interface TournamentRegistration {
  id: string
  tournament_id: string
  tournament?: Tournament
  player_id: string
  player?: Player
  status: 'registered' | 'confirmed' | 'withdrawn' | 'waitlisted'
  registered_at: string
  withdrawn_at?: string
  confirmed_at?: string
  check_in_status?: 'checked_in' | 'not_checked_in'
  check_in_at?: string
}

export interface TournamentGroup {
  id: string
  tournament_id: string
  tournament?: Tournament
  group_name: string
  group_number: number
  created_at: string
}

export interface TournamentGroupPlayer {
  id: string
  tournament_id: string
  group_id: string
  group?: TournamentGroup
  player_id: string
  player?: Player
  seed_position?: number
}

export interface TournamentMatch {
  id: string
  tournament_id: string
  tournament?: Tournament
  match_id: string
  match?: Match
  bracket_type: 'group' | 'main' | 'backdraw'
  round_number?: number
  group_id?: string
  group?: TournamentGroup
  bracket_position?: string
  is_bye: boolean
  round_deadline?: string
}

export interface TournamentRound {
  id: string
  tournament_id: string
  tournament?: Tournament
  round_number: number
  round_name: string
  bracket_type: 'group' | 'main' | 'backdraw'
  deadline: string
  status: 'upcoming' | 'active' | 'completed'
  created_at: string
  updated_at: string
}

export interface TournamentStanding {
  id: string
  tournament_id: string
  tournament?: Tournament
  group_id: string
  group?: TournamentGroup
  player_id: string
  player?: Player
  wins: number
  losses: number
  sets_won: number
  sets_lost: number
  games_won: number
  games_lost: number
  head_to_head_wins: number
  final_position?: number
  qualified: boolean
  updated_at: string
}

export interface TournamentOrganizer {
  id: string
  clerk_id: string
  name: string
  email?: string
  created_at: string
  updated_at: string
}

export interface CreateTournamentPayload {
  name: string
  category_id?: string | null // Optional - null means open to all categories
  start_date: string
  end_date?: string
  tournament_type?: 'groups_playoffs' | 'single_elimination' | 'double_elimination' | 'round_robin'
  group_size?: number
  players_per_group_advance?: number
  registration_open?: boolean
  registration_deadline?: string
  max_players?: number
  min_players?: number
  description?: string
  rules?: string
  location?: string
}

export interface UpdateTournamentPayload {
  name?: string
  category_id?: string
  start_date?: string
  end_date?: string
  status?: 'upcoming' | 'active' | 'completed'
  group_size?: number
  players_per_group_advance?: number
  registration_open?: boolean
  registration_deadline?: string
  max_players?: number
  min_players?: number
  description?: string
  rules?: string
  location?: string
}

export interface RegisterPlayerPayload {
  player_id: string
}

export interface WithdrawPlayerPayload {
  player_id: string
  option: 'walkover' | 'replacement'
  replacement_player_id?: string
}

export interface SetRoundDeadlinePayload {
  deadline: string
  round_number?: number
  bracket_type: 'group' | 'main' | 'backdraw'
}

export interface RescheduleMatchPayload {
  match_id: string
  scheduled_at: string
}

export interface ExtendDeadlinePayload {
  round_id: string
  new_deadline: string
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

export interface ProposeReschedulePayload {
  scheduled_at: string
}

