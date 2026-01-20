import type { SupabaseClient } from '@supabase/supabase-js'
import type { RatingTier, RatingTierInfo, RatingCalculationResult, MonthlyDecayStatus } from '~/types'

// ============================================
// CONSTANTS
// ============================================

// K-factors for ELO calculation
const K_FACTOR_STANDARD = 32
const K_FACTOR_PLACEMENT = 50
const K_FACTOR_HIGH_RATED = 24
const K_FACTOR_UNRATED = 60
const K_FACTOR_RATED_VS_UNRATED = 24

// K-factors for MMR calculation
const K_MMR_STANDARD = 0.05
const K_MMR_UNRATED = 0.08
const K_MMR_RATED_VS_UNRATED = 0.03

// Uncertainty values
const UNCERTAINTY_INITIAL = 2.0
const UNCERTAINTY_MIN = 0.5
const UNCERTAINTY_MAX = 2.0
const UNCERTAINTY_DECREASE_STANDARD = 0.1
const UNCERTAINTY_DECREASE_PLACEMENT = 0.15
const UNCERTAINTY_DECREASE_UNRATED = 0.2

// ELO bounds
const ELO_MIN = 1
const ELO_DECAY_FLOOR = 500
const ELO_HIGH_RATED_THRESHOLD = 3500

// Win streak bonus
const WIN_STREAK_BONUS_PER_WIN = 5
const WIN_STREAK_BONUS_MAX_WINS = 5
const WIN_STREAK_BONUS_MAX = WIN_STREAK_BONUS_PER_WIN * WIN_STREAK_BONUS_MAX_WINS // 25

// MMR to ELO conversion
const MMR_ELO_CENTER = 2250
const MMR_ELO_SCALE = 750

// Monthly decay
const MATCHES_REQUIRED_PER_MONTH = 2
const DECAY_PER_MISSED_MATCH = 25
const MAX_DECAY_MONTHS = 4

// Convergence threshold
const CONVERGENCE_THRESHOLD = 50
const CONVERGENCE_MULTIPLIER_GAIN = 1.2
const CONVERGENCE_MULTIPLIER_LOSS = 0.8

// ============================================
// RATING TIER DEFINITIONS
// ============================================

export const RATING_TIERS: RatingTierInfo[] = [
  { tier: 'Bronze', minElo: 1, maxElo: 1499, color: '#CD7F32' },
  { tier: 'Silver', minElo: 1500, maxElo: 1999, color: '#C0C0C0' },
  { tier: 'Gold', minElo: 2000, maxElo: 2499, color: '#FFD700' },
  { tier: 'Platinum', minElo: 2500, maxElo: 2999, color: '#E5E4E2' },
  { tier: 'Diamond', minElo: 3000, maxElo: 3499, color: '#B9F2FF' },
  { tier: 'Master', minElo: 3500, maxElo: 3999, color: '#9932CC' },
  { tier: 'Grandmaster', minElo: 4000, maxElo: Infinity, color: '#FF4500' },
]

// ============================================
// CORE RATING FUNCTIONS
// ============================================

/**
 * Get rating tier from ELO
 */
export function getRatingTier(elo: number): RatingTierInfo {
  for (const tier of RATING_TIERS) {
    if (elo >= tier.minElo && elo <= tier.maxElo) {
      return tier
    }
  }
  return RATING_TIERS[0] // Default to Bronze
}

/**
 * Get progress to next tier
 * Returns information about current tier, next tier, and progress
 */
export interface NextTierProgress {
  currentTier: RatingTierInfo
  nextTier: RatingTierInfo | null
  eloNeeded: number
  progressPercent: number
  isMaxTier: boolean
}

export function getNextTierProgress(elo: number): NextTierProgress {
  const currentTier = getRatingTier(elo)
  const currentIndex = RATING_TIERS.findIndex(t => t.tier === currentTier.tier)
  
  // Check if already at max tier (Grandmaster)
  if (currentIndex === RATING_TIERS.length - 1 || currentTier.tier === 'Grandmaster') {
    return {
      currentTier,
      nextTier: null,
      eloNeeded: 0,
      progressPercent: 100,
      isMaxTier: true
    }
  }
  
  const nextTier = RATING_TIERS[currentIndex + 1]
  const eloNeeded = nextTier.minElo - elo
  
  // Calculate progress within current tier
  const tierRange = currentTier.maxElo - currentTier.minElo
  const eloInTier = elo - currentTier.minElo
  const progressPercent = tierRange > 0 ? Math.round((eloInTier / tierRange) * 100) : 0
  
  return {
    currentTier,
    nextTier,
    eloNeeded,
    progressPercent,
    isMaxTier: false
  }
}

/**
 * Get default ELO for a category order (1-7)
 * Linear mapping: Category 1 = 2500, Category 7 = 1000
 */
export function getDefaultELOForCategory(categoryOrder: number): number {
  const defaults: Record<number, number> = {
    1: 2500, // Elite
    2: 2250, // Advanced
    3: 2000, // Upper Intermediate
    4: 1750, // Lower Intermediate
    5: 1500, // Basic Intermediate
    6: 1250, // Upper Beginner
    7: 1000, // Beginner
  }
  return defaults[categoryOrder] ?? 1000
}

/**
 * Convert MMR to ELO scale
 * Formula: ELO = 2250 + (MMR * 750)
 */
export function mmrToElo(mmr: number): number {
  return Math.round(MMR_ELO_CENTER + (mmr * MMR_ELO_SCALE))
}

/**
 * Convert ELO to MMR scale
 * Formula: MMR = (ELO - 2250) / 750
 */
export function eloToMmr(elo: number): number {
  return (elo - MMR_ELO_CENTER) / MMR_ELO_SCALE
}

/**
 * Check if player is unrated
 */
export function isPlayerUnrated(totalMatchesPlayed: number): boolean {
  return totalMatchesPlayed === 0
}

/**
 * Calculate expected score using ELO formula
 * E = 1 / (1 + 10^((opponent_elo - player_elo) / 400))
 */
export function calculateExpectedScore(playerElo: number, opponentElo: number): number {
  const exponent = (opponentElo - playerElo) / 400
  const expected = 1 / (1 + Math.pow(10, exponent))
  // Cap expected score to prevent extreme values
  return Math.min(0.99, Math.max(0.01, expected))
}

/**
 * Calculate expected MMR probability
 * E = 1 / (1 + 10^((opponent_mmr - player_mmr) / 1.0))
 */
export function calculateExpectedMmrProbability(playerMmr: number, opponentMmr: number): number {
  const exponent = (opponentMmr - playerMmr) / 1.0
  const expected = 1 / (1 + Math.pow(10, exponent))
  return Math.min(0.99, Math.max(0.01, expected))
}

/**
 * Get K-factor for ELO calculation
 */
export function getEloKFactor(
  playerElo: number,
  isPlacementMatch: boolean,
  isUnrated: boolean,
  opponentIsUnrated: boolean
): number {
  // Unrated player has highest K-factor
  if (isUnrated) {
    return K_FACTOR_UNRATED
  }
  
  // Rated player playing against unrated gets reduced K-factor
  if (opponentIsUnrated) {
    return K_FACTOR_RATED_VS_UNRATED
  }
  
  // Placement matches have higher K-factor
  if (isPlacementMatch) {
    return K_FACTOR_PLACEMENT
  }
  
  // High-rated players have reduced K-factor
  if (playerElo > ELO_HIGH_RATED_THRESHOLD) {
    return K_FACTOR_HIGH_RATED
  }
  
  return K_FACTOR_STANDARD
}

/**
 * Get K-factor for MMR calculation
 */
export function getMmrKFactor(
  isUnrated: boolean,
  opponentIsUnrated: boolean
): number {
  if (isUnrated) {
    return K_MMR_UNRATED
  }
  if (opponentIsUnrated) {
    return K_MMR_RATED_VS_UNRATED
  }
  return K_MMR_STANDARD
}

/**
 * Calculate win streak bonus
 * +5 ELO per consecutive win, capped at 5 wins (max +25)
 */
export function calculateWinStreakBonus(winStreak: number): number {
  const effectiveStreak = Math.min(winStreak, WIN_STREAK_BONUS_MAX_WINS)
  return effectiveStreak * WIN_STREAK_BONUS_PER_WIN
}

/**
 * Apply ELO-MMR convergence logic
 * When ELO and MMR diverge by 50+ points, adjust ELO change
 */
export function applyConvergence(
  playerElo: number,
  playerMmr: number,
  baseEloChange: number,
  isWin: boolean
): number {
  const mmrElo = mmrToElo(playerMmr)
  const diff = mmrElo - playerElo
  
  // Only apply convergence if difference is significant
  if (Math.abs(diff) < CONVERGENCE_THRESHOLD) {
    return baseEloChange
  }
  
  if (diff > 0) {
    // ELO too low compared to MMR - gain more on win, lose less on loss
    return isWin
      ? Math.round(baseEloChange * CONVERGENCE_MULTIPLIER_GAIN)
      : Math.round(baseEloChange * CONVERGENCE_MULTIPLIER_LOSS)
  } else {
    // ELO too high compared to MMR - gain less on win, lose more on loss
    return isWin
      ? Math.round(baseEloChange * CONVERGENCE_MULTIPLIER_LOSS)
      : Math.round(baseEloChange * CONVERGENCE_MULTIPLIER_GAIN)
  }
}

/**
 * Calculate uncertainty decrease amount
 */
export function getUncertaintyDecrease(
  isUnrated: boolean,
  isPlacementMatch: boolean
): number {
  if (isUnrated) {
    return UNCERTAINTY_DECREASE_UNRATED
  }
  if (isPlacementMatch) {
    return UNCERTAINTY_DECREASE_PLACEMENT
  }
  return UNCERTAINTY_DECREASE_STANDARD
}

/**
 * Calculate new uncertainty value
 */
export function calculateNewUncertainty(
  currentUncertainty: number,
  isUnrated: boolean,
  isPlacementMatch: boolean
): number {
  const decrease = getUncertaintyDecrease(isUnrated, isPlacementMatch)
  const newUncertainty = currentUncertainty - decrease
  // Clamp to valid range
  return Math.max(UNCERTAINTY_MIN, Math.min(UNCERTAINTY_MAX, newUncertainty))
}

/**
 * Calculate ELO change for a match
 */
export function calculateELOChange(
  player1Elo: number,
  player2Elo: number,
  winnerId: 1 | 2,
  isPlayer1PlacementMatch: boolean,
  isPlayer2PlacementMatch: boolean,
  player1WinStreak: number,
  player2WinStreak: number,
  player1IsUnrated: boolean,
  player2IsUnrated: boolean,
  player1Mmr: number,
  player2Mmr: number
): { player1Change: number; player2Change: number; player1WinStreakBonus: number; player2WinStreakBonus: number } {
  const player1Expected = calculateExpectedScore(player1Elo, player2Elo)
  const player2Expected = 1 - player1Expected
  
  const player1ActualScore = winnerId === 1 ? 1 : 0
  const player2ActualScore = winnerId === 2 ? 1 : 0
  
  const player1KFactor = getEloKFactor(player1Elo, isPlayer1PlacementMatch, player1IsUnrated, player2IsUnrated)
  const player2KFactor = getEloKFactor(player2Elo, isPlayer2PlacementMatch, player2IsUnrated, player1IsUnrated)
  
  // Base ELO changes
  let player1Change = Math.round(player1KFactor * (player1ActualScore - player1Expected))
  let player2Change = Math.round(player2KFactor * (player2ActualScore - player2Expected))
  
  // Apply convergence logic
  player1Change = applyConvergence(player1Elo, player1Mmr, player1Change, winnerId === 1)
  player2Change = applyConvergence(player2Elo, player2Mmr, player2Change, winnerId === 2)
  
  // Calculate win streak bonuses (only for rated players on wins)
  let player1WinStreakBonus = 0
  let player2WinStreakBonus = 0
  
  if (winnerId === 1 && !player1IsUnrated) {
    player1WinStreakBonus = calculateWinStreakBonus(player1WinStreak + 1) - calculateWinStreakBonus(player1WinStreak)
    // Only apply bonus up to the cap
    if (player1WinStreak < WIN_STREAK_BONUS_MAX_WINS) {
      player1Change += player1WinStreakBonus
    } else {
      player1WinStreakBonus = 0
    }
  }
  
  if (winnerId === 2 && !player2IsUnrated) {
    player2WinStreakBonus = calculateWinStreakBonus(player2WinStreak + 1) - calculateWinStreakBonus(player2WinStreak)
    if (player2WinStreak < WIN_STREAK_BONUS_MAX_WINS) {
      player2Change += player2WinStreakBonus
    } else {
      player2WinStreakBonus = 0
    }
  }
  
  return { player1Change, player2Change, player1WinStreakBonus, player2WinStreakBonus }
}

/**
 * Calculate MMR change for a match
 */
export function calculateMMRChange(
  player1Mmr: number,
  player2Mmr: number,
  player1Uncertainty: number,
  player2Uncertainty: number,
  winnerId: 1 | 2,
  player1IsUnrated: boolean,
  player2IsUnrated: boolean,
  isPlayer1PlacementMatch: boolean,
  isPlayer2PlacementMatch: boolean
): {
  player1MmrChange: number
  player2MmrChange: number
  player1NewUncertainty: number
  player2NewUncertainty: number
} {
  const player1Expected = calculateExpectedMmrProbability(player1Mmr, player2Mmr)
  const player2Expected = 1 - player1Expected
  
  const player1ActualScore = winnerId === 1 ? 1 : 0
  const player2ActualScore = winnerId === 2 ? 1 : 0
  
  const player1KFactor = getMmrKFactor(player1IsUnrated, player2IsUnrated)
  const player2KFactor = getMmrKFactor(player2IsUnrated, player1IsUnrated)
  
  // Uncertainty factor: higher uncertainty = bigger changes
  const player1UncertaintyFactor = Math.min(player1Uncertainty / UNCERTAINTY_MIN, 2.0)
  const player2UncertaintyFactor = Math.min(player2Uncertainty / UNCERTAINTY_MIN, 2.0)
  
  // Calculate MMR changes
  const player1MmrChange = player1KFactor * (player1ActualScore - player1Expected) * player1UncertaintyFactor
  const player2MmrChange = player2KFactor * (player2ActualScore - player2Expected) * player2UncertaintyFactor
  
  // Calculate new uncertainties
  const player1NewUncertainty = calculateNewUncertainty(player1Uncertainty, player1IsUnrated, isPlayer1PlacementMatch)
  const player2NewUncertainty = calculateNewUncertainty(player2Uncertainty, player2IsUnrated, isPlayer2PlacementMatch)
  
  return {
    player1MmrChange,
    player2MmrChange,
    player1NewUncertainty,
    player2NewUncertainty,
  }
}

/**
 * Get expected win probability between two players
 */
export function getExpectedWinProbability(player1Elo: number, player2Elo: number): number {
  return calculateExpectedScore(player1Elo, player2Elo)
}

/**
 * Initialize player ratings based on category
 */
export function initializePlayerRatings(categoryOrder: number | null): {
  elo: number
  mmr: number
  mmrUncertainty: number
  placementMatchesCompleted: number
  winStreak: number
  lossStreak: number
  totalMatchesPlayed: number
} {
  const defaultElo = categoryOrder ? getDefaultELOForCategory(categoryOrder) : 1000
  const mmr = eloToMmr(defaultElo)
  
  return {
    elo: defaultElo,
    mmr,
    mmrUncertainty: UNCERTAINTY_INITIAL,
    placementMatchesCompleted: 0,
    winStreak: 0,
    lossStreak: 0,
    totalMatchesPlayed: 0,
  }
}

/**
 * Get effective rating for match calculations
 * If player is unrated, use category-based defaults
 */
export function getEffectiveRatings(
  playerElo: number,
  playerMmr: number,
  isUnrated: boolean,
  categoryDefaultElo: number
): { elo: number; mmr: number } {
  if (isUnrated) {
    return {
      elo: categoryDefaultElo,
      mmr: eloToMmr(categoryDefaultElo),
    }
  }
  return { elo: playerElo, mmr: playerMmr }
}

// ============================================
// MONTHLY DECAY FUNCTIONS
// ============================================

/**
 * Calculate decay amount based on matches played
 */
export function calculateDecayAmount(matchesPlayed: number): number {
  if (matchesPlayed >= MATCHES_REQUIRED_PER_MONTH) {
    return 0
  }
  return (MATCHES_REQUIRED_PER_MONTH - matchesPlayed) * DECAY_PER_MISSED_MATCH
}

/**
 * Calculate accumulated decay for multiple months
 */
export function calculateAccumulatedDecay(monthsInactive: number): number {
  const effectiveMonths = Math.min(monthsInactive, MAX_DECAY_MONTHS)
  return effectiveMonths * DECAY_PER_MISSED_MATCH * MATCHES_REQUIRED_PER_MONTH
}

/**
 * Apply decay to ELO with floor protection
 */
export function applyDecay(currentElo: number, decayAmount: number): number {
  const newElo = currentElo - decayAmount
  return Math.max(ELO_DECAY_FLOOR, newElo)
}

/**
 * Get days remaining in current month
 */
export function getDaysRemainingInMonth(): number {
  const now = new Date()
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return lastDay.getDate() - now.getDate()
}

/**
 * Get monthly decay status for a player
 */
export function getMonthlyDecayStatus(
  matchesThisMonth: number,
  lastDecayCheck: string | null,
  placementMatchesCompleted?: number
): MonthlyDecayStatus {
  const daysRemaining = getDaysRemainingInMonth()
  
  // Players in placement matches are exempt from decay
  const isInPlacement = (placementMatchesCompleted ?? 0) < 3
  const willDecay = !isInPlacement && matchesThisMonth < MATCHES_REQUIRED_PER_MONTH
  const estimatedDecay = isInPlacement ? 0 : calculateDecayAmount(matchesThisMonth)
  
  return {
    matches_this_month: matchesThisMonth,
    matches_required: MATCHES_REQUIRED_PER_MONTH,
    days_remaining_in_month: daysRemaining,
    will_decay: willDecay,
    estimated_decay: estimatedDecay,
    last_decay_check: lastDecayCheck ?? undefined,
  }
}

/**
 * Check if decay should be applied (new month since last check)
 */
export function shouldApplyDecay(lastDecayCheck: Date | null): boolean {
  if (!lastDecayCheck) {
    return false // First time, don't decay
  }
  
  const now = new Date()
  const lastCheckMonth = lastDecayCheck.getMonth()
  const lastCheckYear = lastDecayCheck.getFullYear()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()
  
  // Different year or month means we should check for decay
  return currentYear > lastCheckYear || 
    (currentYear === lastCheckYear && currentMonth > lastCheckMonth)
}

// ============================================
// DATABASE UPDATE FUNCTIONS
// ============================================

/**
 * Main function to update ratings after a match completes
 */
export async function updateRatingsAfterMatch(
  matchId: string,
  supabase: SupabaseClient
): Promise<RatingCalculationResult | null> {
  // Fetch match data
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select(`
      id,
      player1_id,
      player2_id,
      winner_id,
      status,
      played_at,
      tournament_id
    `)
    .eq('id', matchId)
    .single()
  
  if (matchError || !match) {
    console.error('Failed to fetch match:', matchError)
    return null
  }
  
  // Validate match state
  if (match.status !== 'completed' || !match.winner_id) {
    console.error('Match is not completed or has no winner')
    return null
  }
  
  // Both players must exist
  if (!match.player1_id || !match.player2_id) {
    console.error('Match must have both players')
    return null
  }
  
  // Prevent self-match
  if (match.player1_id === match.player2_id) {
    console.error('Invalid match: player1_id equals player2_id')
    return null
  }
  
  // Only competitive matches affect ratings
  // Friendly matches (is_competitive = false) don't count
  if (match.is_competitive === false) {
    console.log('Match is not competitive (friendly match), skipping rating update')
    return null
  }
  
  // Fetch both players with their categories
  const { data: players, error: playersError } = await supabase
    .from('players')
    .select(`
      id,
      elo,
      mmr,
      mmr_uncertainty,
      placement_matches_completed,
      win_streak,
      loss_streak,
      total_matches_played,
      matches_this_month,
      category_id,
      category:categories(id, order, default_elo)
    `)
    .in('id', [match.player1_id, match.player2_id])
  
  if (playersError || !players || players.length !== 2) {
    console.error('Failed to fetch players:', playersError)
    return null
  }
  
  const player1 = players.find(p => p.id === match.player1_id)!
  const player2 = players.find(p => p.id === match.player2_id)!
  
  // Determine winner
  const winnerId: 1 | 2 = match.winner_id === match.player1_id ? 1 : 2
  
  // Check if players are unrated
  const player1IsUnrated = isPlayerUnrated(player1.total_matches_played)
  const player2IsUnrated = isPlayerUnrated(player2.total_matches_played)
  
  // Check if placement match (only for rated players)
  const isPlayer1PlacementMatch = !player1IsUnrated && player1.placement_matches_completed < 3
  const isPlayer2PlacementMatch = !player2IsUnrated && player2.placement_matches_completed < 3
  
  // Get default ELO from category
  const player1DefaultElo = (player1.category as any)?.default_elo ?? 1000
  const player2DefaultElo = (player2.category as any)?.default_elo ?? 1000
  
  // Get effective ratings (use category defaults for unrated)
  const player1Effective = getEffectiveRatings(
    player1.elo,
    Number(player1.mmr),
    player1IsUnrated,
    player1DefaultElo
  )
  const player2Effective = getEffectiveRatings(
    player2.elo,
    Number(player2.mmr),
    player2IsUnrated,
    player2DefaultElo
  )
  
  // Calculate ELO changes
  const eloResult = calculateELOChange(
    player1Effective.elo,
    player2Effective.elo,
    winnerId,
    isPlayer1PlacementMatch,
    isPlayer2PlacementMatch,
    player1.win_streak,
    player2.win_streak,
    player1IsUnrated,
    player2IsUnrated,
    player1Effective.mmr,
    player2Effective.mmr
  )
  
  // Calculate MMR changes
  const mmrResult = calculateMMRChange(
    player1Effective.mmr,
    player2Effective.mmr,
    Number(player1.mmr_uncertainty),
    Number(player2.mmr_uncertainty),
    winnerId,
    player1IsUnrated,
    player2IsUnrated,
    isPlayer1PlacementMatch,
    isPlayer2PlacementMatch
  )
  
  // Calculate new values
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()
  
  // Check if we need to reset matches_this_month (new month)
  const player1MatchesThisMonth = getUpdatedMatchCount(player1.matches_this_month, match.played_at)
  const player2MatchesThisMonth = getUpdatedMatchCount(player2.matches_this_month, match.played_at)
  
  const player1NewElo = Math.max(ELO_MIN, (player1IsUnrated ? player1DefaultElo : player1.elo) + eloResult.player1Change)
  const player2NewElo = Math.max(ELO_MIN, (player2IsUnrated ? player2DefaultElo : player2.elo) + eloResult.player2Change)
  
  const player1NewMmr = (player1IsUnrated ? player1Effective.mmr : Number(player1.mmr)) + mmrResult.player1MmrChange
  const player2NewMmr = (player2IsUnrated ? player2Effective.mmr : Number(player2.mmr)) + mmrResult.player2MmrChange
  
  // Update streaks
  const player1NewWinStreak = winnerId === 1 ? player1.win_streak + 1 : 0
  const player1NewLossStreak = winnerId === 1 ? 0 : player1.loss_streak + 1
  const player2NewWinStreak = winnerId === 2 ? player2.win_streak + 1 : 0
  const player2NewLossStreak = winnerId === 2 ? 0 : player2.loss_streak + 1
  
  // Update placement matches count (only increment if was in placement)
  const player1NewPlacementCount = isPlayer1PlacementMatch 
    ? player1.placement_matches_completed + 1 
    : (player1IsUnrated ? 1 : player1.placement_matches_completed)
  const player2NewPlacementCount = isPlayer2PlacementMatch 
    ? player2.placement_matches_completed + 1 
    : (player2IsUnrated ? 1 : player2.placement_matches_completed)
  
  // Update player 1
  const { error: update1Error } = await supabase
    .from('players')
    .update({
      elo: player1NewElo,
      mmr: player1NewMmr,
      mmr_uncertainty: mmrResult.player1NewUncertainty,
      placement_matches_completed: Math.min(3, player1NewPlacementCount),
      win_streak: player1NewWinStreak,
      loss_streak: player1NewLossStreak,
      last_match_at: match.played_at || now.toISOString(),
      matches_this_month: player1MatchesThisMonth + 1,
      total_matches_played: player1.total_matches_played + 1,
    })
    .eq('id', player1.id)
  
  if (update1Error) {
    console.error('Failed to update player 1:', update1Error)
    return null
  }
  
  // Update player 2
  const { error: update2Error } = await supabase
    .from('players')
    .update({
      elo: player2NewElo,
      mmr: player2NewMmr,
      mmr_uncertainty: mmrResult.player2NewUncertainty,
      placement_matches_completed: Math.min(3, player2NewPlacementCount),
      win_streak: player2NewWinStreak,
      loss_streak: player2NewLossStreak,
      last_match_at: match.played_at || now.toISOString(),
      matches_this_month: player2MatchesThisMonth + 1,
      total_matches_played: player2.total_matches_played + 1,
    })
    .eq('id', player2.id)
  
  if (update2Error) {
    console.error('Failed to update player 2:', update2Error)
    return null
  }
  
  // Record rating history for player 1
  const player1Expected = calculateExpectedScore(player1Effective.elo, player2Effective.elo)
  await supabase.from('rating_history').insert({
    player_id: player1.id,
    match_id: matchId,
    elo_before: player1IsUnrated ? player1DefaultElo : player1.elo,
    elo_after: player1NewElo,
    elo_change: eloResult.player1Change,
    mmr_before: player1Effective.mmr,
    mmr_after: player1NewMmr,
    mmr_change: mmrResult.player1MmrChange,
    uncertainty_before: Number(player1.mmr_uncertainty),
    uncertainty_after: mmrResult.player1NewUncertainty,
    k_factor: getEloKFactor(player1Effective.elo, isPlayer1PlacementMatch, player1IsUnrated, player2IsUnrated),
    expected_score: player1Expected,
    actual_score: winnerId === 1 ? 1 : 0,
    is_placement_match: isPlayer1PlacementMatch,
    is_unrated_match: player1IsUnrated,
    win_streak_bonus: eloResult.player1WinStreakBonus,
    opponent_id: player2.id,
    opponent_elo: player2Effective.elo,
    opponent_mmr: player2Effective.mmr,
    was_winner: winnerId === 1,
  })
  
  // Record rating history for player 2
  const player2Expected = 1 - player1Expected
  await supabase.from('rating_history').insert({
    player_id: player2.id,
    match_id: matchId,
    elo_before: player2IsUnrated ? player2DefaultElo : player2.elo,
    elo_after: player2NewElo,
    elo_change: eloResult.player2Change,
    mmr_before: player2Effective.mmr,
    mmr_after: player2NewMmr,
    mmr_change: mmrResult.player2MmrChange,
    uncertainty_before: Number(player2.mmr_uncertainty),
    uncertainty_after: mmrResult.player2NewUncertainty,
    k_factor: getEloKFactor(player2Effective.elo, isPlayer2PlacementMatch, player2IsUnrated, player1IsUnrated),
    expected_score: player2Expected,
    actual_score: winnerId === 2 ? 1 : 0,
    is_placement_match: isPlayer2PlacementMatch,
    is_unrated_match: player2IsUnrated,
    win_streak_bonus: eloResult.player2WinStreakBonus,
    opponent_id: player1.id,
    opponent_elo: player1Effective.elo,
    opponent_mmr: player1Effective.mmr,
    was_winner: winnerId === 2,
  })
  
  return {
    player1: {
      eloChange: eloResult.player1Change,
      newElo: player1NewElo,
      mmrChange: mmrResult.player1MmrChange,
      newMmr: player1NewMmr,
      newUncertainty: mmrResult.player1NewUncertainty,
      winStreakBonus: eloResult.player1WinStreakBonus,
    },
    player2: {
      eloChange: eloResult.player2Change,
      newElo: player2NewElo,
      mmrChange: mmrResult.player2MmrChange,
      newMmr: player2NewMmr,
      newUncertainty: mmrResult.player2NewUncertainty,
      winStreakBonus: eloResult.player2WinStreakBonus,
    },
  }
}

/**
 * Helper function to get updated match count for the current month
 */
function getUpdatedMatchCount(currentCount: number, matchPlayedAt: string | null): number {
  if (!matchPlayedAt) {
    return currentCount
  }
  
  const matchDate = new Date(matchPlayedAt)
  const now = new Date()
  
  // If match is in a different month than current, reset count
  if (matchDate.getMonth() !== now.getMonth() || matchDate.getFullYear() !== now.getFullYear()) {
    return 0
  }
  
  return currentCount
}

/**
 * Check and apply monthly decay for a player
 */
export async function checkAndApplyMonthlyDecay(
  playerId: string,
  supabase: SupabaseClient
): Promise<{ decayApplied: number; uncertaintyIncrease: number } | null> {
  // Fetch player data
  const { data: player, error } = await supabase
    .from('players')
    .select('id, elo, mmr_uncertainty, matches_this_month, last_decay_check, total_matches_played, placement_matches_completed')
    .eq('id', playerId)
    .single()
  
  if (error || !player) {
    console.error('Failed to fetch player for decay check:', error)
    return null
  }
  
  // Don't apply decay to unrated players
  if (player.total_matches_played === 0) {
    return { decayApplied: 0, uncertaintyIncrease: 0 }
  }
  
  // Don't apply decay to players still in placement matches
  if ((player.placement_matches_completed ?? 0) < 3) {
    return { decayApplied: 0, uncertaintyIncrease: 0 }
  }
  
  const lastDecayCheck = player.last_decay_check ? new Date(player.last_decay_check) : null
  
  // Check if we should apply decay
  if (!shouldApplyDecay(lastDecayCheck)) {
    return { decayApplied: 0, uncertaintyIncrease: 0 }
  }
  
  // Calculate decay
  const decayAmount = calculateDecayAmount(player.matches_this_month)
  const uncertaintyIncrease = (MATCHES_REQUIRED_PER_MONTH - Math.min(player.matches_this_month, MATCHES_REQUIRED_PER_MONTH)) * 0.1
  
  if (decayAmount === 0 && uncertaintyIncrease === 0) {
    // No decay needed, just update the check date
    await supabase
      .from('players')
      .update({
        last_decay_check: new Date().toISOString().split('T')[0],
        matches_this_month: 0, // Reset for new month
      })
      .eq('id', playerId)
    
    return { decayApplied: 0, uncertaintyIncrease: 0 }
  }
  
  // Apply decay
  const newElo = applyDecay(player.elo, decayAmount)
  const newUncertainty = Math.min(UNCERTAINTY_MAX, Number(player.mmr_uncertainty) + uncertaintyIncrease)
  
  const { error: updateError } = await supabase
    .from('players')
    .update({
      elo: newElo,
      mmr_uncertainty: newUncertainty,
      last_decay_check: new Date().toISOString().split('T')[0],
      matches_this_month: 0, // Reset for new month
    })
    .eq('id', playerId)
  
  if (updateError) {
    console.error('Failed to apply decay:', updateError)
    return null
  }
  
  return { decayApplied: decayAmount, uncertaintyIncrease }
}

/**
 * Validate rating consistency for a player
 * Recalculates expected rating from history and compares
 */
export async function validateRatingConsistency(
  playerId: string,
  supabase: SupabaseClient
): Promise<{ isConsistent: boolean; expectedElo: number; actualElo: number }> {
  // Fetch player's current rating
  const { data: player, error: playerError } = await supabase
    .from('players')
    .select('elo, category:categories(default_elo)')
    .eq('id', playerId)
    .single()
  
  if (playerError || !player) {
    return { isConsistent: false, expectedElo: 0, actualElo: 0 }
  }
  
  // Fetch all non-reversed rating history
  const { data: history, error: historyError } = await supabase
    .from('rating_history')
    .select('elo_change, is_unrated_match')
    .eq('player_id', playerId)
    .eq('rating_reversed', false)
    .order('created_at', { ascending: true })
  
  if (historyError) {
    return { isConsistent: false, expectedElo: 0, actualElo: player.elo }
  }
  
  // Calculate expected ELO from history
  const defaultElo = (player.category as any)?.default_elo ?? 1000
  let expectedElo = history && history.length > 0 
    ? (history[0].is_unrated_match ? defaultElo : defaultElo)
    : defaultElo
  
  if (history) {
    for (const entry of history) {
      expectedElo += entry.elo_change
    }
  }
  
  expectedElo = Math.max(ELO_MIN, expectedElo)
  
  return {
    isConsistent: Math.abs(expectedElo - player.elo) <= 1, // Allow for rounding
    expectedElo,
    actualElo: player.elo,
  }
}
