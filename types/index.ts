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
  default_elo: number
  created_at: string
  updated_at: string
}

export interface City {
  id: string
  name: string
  order: number
  created_at: string
  updated_at: string
}

export interface Player {
  id: string
  clerk_id: string
  name: string
  phone_number?: string
  city_id?: string
  city?: City
  category_id?: string
  category?: Category
  elo: number
  mmr: number
  mmr_uncertainty: number
  placement_matches_completed: number
  win_streak: number
  loss_streak: number
  last_match_at?: string
  matches_this_month: number
  last_decay_check?: string
  total_matches_played: number
  status?: 'active' | 'deleted'
  deleted_at?: string
  created_at: string
  updated_at: string
}

// Helper to check if player is unrated
export function isPlayerUnrated(player: Player): boolean {
  return player.total_matches_played === 0
}

export interface CreatePlayerPayload {
  name: string
  phone_number?: string
  city_id: string
  category_id: string
}

export interface UpdatePlayerPayload {
  name?: string
  phone_number?: string
  city_id?: string
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
  scheduled_at: string | null
  played_at?: string
  is_competitive?: boolean // Whether this match counts towards ratings (default: true)
  schedule_proposed_by?: string
  schedule_proposed_by_player?: Player
  schedule_proposed_at?: string
  schedule_proposed_scheduled_at?: string
  schedule_approved_by?: string
  schedule_approved_by_player?: Player
  schedule_rejected_by?: string
  schedule_rejected_by_player?: Player
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
  points_config?: {
    group_stage?: number
    playoffs?: number | {
      quarterfinals?: number
      semifinals?: number
      final?: number
    }
  }
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
  points: number
  game_difference: number
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
  points_config?: {
    group_stage?: number
    playoffs?: number | {
      quarterfinals?: number
      semifinals?: number
      final?: number
    }
  }
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
  points_config?: {
    group_stage?: number
    playoffs?: number | {
      quarterfinals?: number
      semifinals?: number
      final?: number
    }
  }
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

// ============================================
// MATCHMAKING AND RANKING SYSTEM TYPES
// ============================================export interface CitySegment {
  id: string
  name: string
  description?: string
  created_at: string
  updated_at: string
  cities?: City[]
}

export interface CitySegmentCity {
  id: string
  city_segment_id: string
  city_id: string
  city?: City
  city_segment?: CitySegment
  created_at: string
}

export interface RatingHistory {
  id: string
  player_id: string
  match_id: string
  elo_before: number
  elo_after: number
  elo_change: number
  mmr_before: number
  mmr_after: number
  mmr_change: number
  uncertainty_before: number
  uncertainty_after: number
  k_factor: number
  expected_score: number
  actual_score: number
  is_placement_match: boolean
  is_unrated_match: boolean
  win_streak_bonus: number
  opponent_id?: string
  opponent_elo?: number
  opponent_mmr?: number
  was_winner: boolean
  rating_reversed: boolean
  reversed_at?: string
  created_at: string
}// Rating tiers based on ELO
export type RatingTier = 
  | 'Bronze'
  | 'Silver'
  | 'Gold'
  | 'Platinum'
  | 'Diamond'
  | 'Master'
  | 'Grandmaster'
  | 'Unrated'

export interface RatingTierInfo {
  tier: RatingTier
  minElo: number
  maxElo: number
  color: string
}

// Matchmaking recommendation
export interface MatchmakingRecommendation {
  player: Player
  expected_win_probability: number
  mmr_difference: number
  rating_tier: RatingTier
  is_unrated: boolean
  last_active_days_ago?: number
}

// Monthly decay status
export interface MonthlyDecayStatus {
  matches_this_month: number
  matches_required: number
  days_remaining_in_month: number
  will_decay: boolean
  estimated_decay: number
  last_decay_check?: string
}

// Rating calculation result
export interface RatingCalculationResult {
  player1: {
    eloChange: number
    newElo: number
    mmrChange: number
    newMmr: number
    newUncertainty: number
    winStreakBonus: number
  }
  player2: {
    eloChange: number
    newElo: number
    mmrChange: number
    newMmr: number
    newUncertainty: number
    winStreakBonus: number
  }
}

// City segment management payloads
export interface CreateCitySegmentPayload {
  name: string
  description?: string
  city_ids?: string[]
}

export interface UpdateCitySegmentPayload {
  name?: string
  description?: string
}

export interface AddCitiesToSegmentPayload {
  city_ids: string[]
}

export interface RemoveCityFromSegmentPayload {
  city_id: string
}
