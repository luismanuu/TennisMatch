import type { City, Category, RatingTier } from './index'

// ============================================
// LEADERBOARD TYPES
// ============================================

// Achievement badge types
export type BadgeType = 
  | 'top_1'           // #1 in the leaderboard
  | 'top_3'           // Top 3 position
  | 'top_10'          // Top 10 position
  | 'rising_star'     // Biggest ELO gain in last 30 days
  | 'hot_streak'      // 5+ win streak
  | 'veteran'         // 50+ matches played
  | 'champion'        // Tournament winner
  | 'undefeated_week' // No losses in a week with 3+ matches
  | 'comeback_king'   // Won after being down significantly

export interface AchievementBadge {
  type: BadgeType
  label: string
  description: string
  icon: string
  color: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
}

// Badge definitions with all metadata
export const BADGE_DEFINITIONS: Record<BadgeType, AchievementBadge> = {
  top_1: {
    type: 'top_1',
    label: '#1',
    description: 'Número 1 del ranking',
    icon: 'heroicons:trophy',
    color: '#FFD700',
    rarity: 'legendary'
  },
  top_3: {
    type: 'top_3',
    label: 'Top 3',
    description: 'Entre los 3 mejores jugadores',
    icon: 'heroicons:star',
    color: '#C0C0C0',
    rarity: 'epic'
  },
  top_10: {
    type: 'top_10',
    label: 'Top 10',
    description: 'Entre los 10 mejores jugadores',
    icon: 'heroicons:fire',
    color: '#CD7F32',
    rarity: 'rare'
  },
  rising_star: {
    type: 'rising_star',
    label: 'Estrella en Ascenso',
    description: 'Mayor ganancia de ELO en los últimos 30 días',
    icon: 'heroicons:arrow-trending-up',
    color: '#00D4FF',
    rarity: 'epic'
  },
  hot_streak: {
    type: 'hot_streak',
    label: 'En Racha',
    description: '5 o más victorias consecutivas',
    icon: 'heroicons:fire',
    color: '#FF6B35',
    rarity: 'rare'
  },
  veteran: {
    type: 'veteran',
    label: 'Veterano',
    description: 'Más de 50 partidos jugados',
    icon: 'heroicons:shield-check',
    color: '#9B59B6',
    rarity: 'common'
  },
  champion: {
    type: 'champion',
    label: 'Campeón',
    description: 'Ganador de torneo',
    icon: 'heroicons:trophy',
    color: '#FFD700',
    rarity: 'epic'
  },
  undefeated_week: {
    type: 'undefeated_week',
    label: 'Invicto',
    description: 'Sin derrotas en una semana con 3+ partidos',
    icon: 'heroicons:bolt',
    color: '#00FF88',
    rarity: 'rare'
  },
  comeback_king: {
    type: 'comeback_king',
    label: 'Rey del Comeback',
    description: 'Remontadas épicas',
    icon: 'heroicons:arrow-path',
    color: '#FF4500',
    rarity: 'epic'
  }
}

export interface LeaderboardPlayer {
  id: string
  name: string
  elo: number
  rank: number
  previous_rank?: number // For showing movement
  rank_change?: number   // Positive = moved up, Negative = moved down
  rating_tier: RatingTier
  total_matches_played: number
  win_streak: number
  loss_streak: number
  placement_matches_completed: number
  city?: City
  category?: Category
  badges: readonly BadgeType[]
  is_current_user?: boolean
  near_promotion?: boolean // True if within 200 ELO of next tier
  next_tier?: string | null // Name of next tier if near promotion
}

export interface LeaderboardFilters {
  tier?: RatingTier
  city_id?: string
  search?: string
  limit?: number
  offset?: number
}

export interface LeaderboardResponse {
  success: boolean
  rankings: LeaderboardPlayer[]
  total: number
  page: number
  page_size: number
  filters: LeaderboardFilters
  current_user_position?: LeaderboardPlayer | null
}

export interface NearbyPlayersResponse {
  success: boolean
  current_player: LeaderboardPlayer
  players_above: LeaderboardPlayer[]
  players_below: LeaderboardPlayer[]
}

// Helper function to get badges for a player based on their stats
export function calculatePlayerBadges(
  rank: number,
  winStreak: number,
  totalMatches: number,
  tournamentWins: number = 0
): BadgeType[] {
  const badges: BadgeType[] = []
  
  // Position badges
  if (rank === 1) badges.push('top_1')
  else if (rank <= 3) badges.push('top_3')
  else if (rank <= 10) badges.push('top_10')
  
  // Streak badge
  if (winStreak >= 5) badges.push('hot_streak')
  
  // Veteran badge
  if (totalMatches >= 50) badges.push('veteran')
  
  // Champion badge
  if (tournamentWins > 0) badges.push('champion')
  
  return badges
}
