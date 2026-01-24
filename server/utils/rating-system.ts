import type { SupabaseClient } from '@supabase/supabase-js'
import type { RatingTier, RatingTierInfo, RatingCalculationResult, MonthlyDecayStatus } from '~/types'
import { 
  calculateEloWithLLM, 
  getDefaultEloCalculation,
  type LlmEloCalculationResult 
} from './llm-score-resolver'
import {
  detectMatchFormatFromScore,
  parseGamesFromScore,
  calculateMatchRating,
  calculateMatchWeight,
  calculateUtrRating,
  calculatePlayerReliability,
  getFormatWeight,
  getCompetitivenessWeight,
  getReliabilityWeight
} from './utr-rating-system'

// ============================================
// CONSTANTS
// ============================================

// K-factors for ELO calculation
const K_FACTOR_STANDARD = 40
const K_FACTOR_PLACEMENT = 50
const K_FACTOR_HIGH_RATED = 30
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
export const ELO_DECAY_FLOOR = 500
const ELO_HIGH_RATED_THRESHOLD = 3500

// Win streak bonus
// Bonus starts after 2 consecutive wins: 2 wins = +6, 3+ wins = +12 (capped)
const WIN_STREAK_BONUS_MIN_WINS = 2 // Bonus only applies after this many wins
const WIN_STREAK_BONUS_2_WINS = 6 // Bonus for exactly 2 consecutive wins
const WIN_STREAK_BONUS_MAX = 12 // Maximum bonus for 3+ consecutive wins

// MMR to ELO conversion
const MMR_ELO_CENTER = 2250
const MMR_ELO_SCALE = 750

// Monthly decay
export const MATCHES_REQUIRED_PER_MONTH = 2
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
 * Bonus starts after 2 consecutive wins: 2 wins = +6, 3+ wins = +12 (capped)
 * Examples:
 * - 0-1 wins: 0 bonus
 * - 2 wins: +6 bonus
 * - 3 wins: +12 bonus
 * - 4+ wins: +12 bonus (capped)
 */
export function calculateWinStreakBonus(winStreak: number): number {
  if (winStreak < WIN_STREAK_BONUS_MIN_WINS) {
    return 0 // No bonus until 2 wins
  }
  if (winStreak === 2) {
    return WIN_STREAK_BONUS_2_WINS // +6 for exactly 2 wins
  }
  return WIN_STREAK_BONUS_MAX // +12 for 3+ wins
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
  
  // Calculate win streak bonuses (only for rated players on wins, starts after 2 consecutive wins)
  let player1WinStreakBonus = 0
  let player2WinStreakBonus = 0
  
  if (winnerId === 1 && !player1IsUnrated) {
    const newStreak = player1WinStreak + 1
    // Bonus only applies if the new streak is at least 2 wins
    if (newStreak >= WIN_STREAK_BONUS_MIN_WINS) {
      player1WinStreakBonus = calculateWinStreakBonus(newStreak) - calculateWinStreakBonus(player1WinStreak)
      player1Change += player1WinStreakBonus
    }
  }
  
  if (winnerId === 2 && !player2IsUnrated) {
    const newStreak = player2WinStreak + 1
    // Bonus only applies if the new streak is at least 2 wins
    if (newStreak >= WIN_STREAK_BONUS_MIN_WINS) {
      player2WinStreakBonus = calculateWinStreakBonus(newStreak) - calculateWinStreakBonus(player2WinStreak)
      player2Change += player2WinStreakBonus
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
export function calculateDecayAmount(matchesPlayed: number, matchesRequired: number = MATCHES_REQUIRED_PER_MONTH): number {
  if (matchesPlayed >= matchesRequired) {
    return 0
  }
  return (matchesRequired - matchesPlayed) * DECAY_PER_MISSED_MATCH
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
 * Calculate required matches for current month based on when player registered
 * If player registered mid-month, adjust requirement proportionally
 */
export function calculateRequiredMatchesForMonth(playerCreatedAt: string | null | Date): number {
  if (!playerCreatedAt) {
    return MATCHES_REQUIRED_PER_MONTH
  }
  
  const createdDate = typeof playerCreatedAt === 'string' ? new Date(playerCreatedAt) : playerCreatedAt
  const now = new Date()
  
  // If player was created in a different month/year, use full requirement
  if (createdDate.getMonth() !== now.getMonth() || createdDate.getFullYear() !== now.getFullYear()) {
    return MATCHES_REQUIRED_PER_MONTH
  }
  
  // If created on day 1, use full requirement
  if (createdDate.getDate() === 1) {
    return MATCHES_REQUIRED_PER_MONTH
  }
  
  // Calculate proportional requirement based on days remaining in month from registration date
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const daysInMonth = lastDayOfMonth.getDate()
  const dayOfMonthCreated = createdDate.getDate()
  const daysRemainingFromCreation = daysInMonth - dayOfMonthCreated + 1
  
  // Calculate proportional requirement (minimum 1 match)
  const proportionalRequirement = Math.max(1, Math.round((MATCHES_REQUIRED_PER_MONTH * daysRemainingFromCreation) / daysInMonth))
  
  return proportionalRequirement
}

/**
 * Get monthly decay status for a player
 */
export function getMonthlyDecayStatus(
  matchesThisMonth: number,
  lastDecayCheck: string | null,
  placementMatchesCompleted?: number,
  playerCreatedAt?: string | null | Date
): MonthlyDecayStatus {
  const daysRemaining = getDaysRemainingInMonth()
  
  // Calculate required matches (proportional if registered mid-month)
  const matchesRequired = calculateRequiredMatchesForMonth(playerCreatedAt ?? null)
  
  // Players in placement matches are exempt from decay
  const isInPlacement = (placementMatchesCompleted ?? 0) < 3
  const willDecay = !isInPlacement && matchesThisMonth < matchesRequired
  const estimatedDecay = isInPlacement ? 0 : calculateDecayAmount(matchesThisMonth, matchesRequired)
  
  return {
    matches_this_month: matchesThisMonth,
    matches_required: matchesRequired,
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
  // Fetch match data (including score for UTR/LLM calculations)
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select(`
      id,
      player1_id,
      player2_id,
      winner_id,
      status,
      played_at,
      tournament_id,
      score
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
      last_match_at,
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
  
  // Try LLM ELO calculation first (if API key available)
  const config = useRuntimeConfig()
  let llmResult: LlmEloCalculationResult | null = null
  let llmUsed = false
  let llmFailed = false
  let fallbackReason: string | null = null
  
  // Retry configuration for LLM calls
  const LLM_MAX_RETRIES = 2
  const LLM_RETRY_DELAY_MS = 2000 // 2 seconds between retries
  
  // Check if score is a walkover (WO) - walkovers don't need LLM calculation
  const isWalkover = match.score?.trim().toUpperCase() === 'WO'
  
  if (config.openRouterApiKey && match.score && !isWalkover) {
    let retryCount = 0
    
    while (retryCount <= LLM_MAX_RETRIES) {
      try {
        llmResult = await calculateEloWithLLM(
          {
            matchId: match.id,
            player1Id: match.player1_id,
            player2Id: match.player2_id,
            player1Elo: player1Effective.elo,
            player2Elo: player2Effective.elo,
            score: match.score,
            winnerId: match.winner_id,
            tournamentId: match.tournament_id || undefined
          },
          supabase,
          { openRouterApiKey: config.openRouterApiKey }
        )
        
        if (llmResult.success) {
          llmUsed = true
          break // Success, exit retry loop
        } else {
          // If validation or parsing failed, retry might help
          if (retryCount < LLM_MAX_RETRIES) {
            console.warn(`[LLM] Calculation failed (attempt ${retryCount + 1}/${LLM_MAX_RETRIES + 1}), retrying...`, llmResult.error)
            await new Promise(resolve => setTimeout(resolve, LLM_RETRY_DELAY_MS))
            retryCount++
            continue
          } else {
            llmFailed = true
            fallbackReason = `LLM calculation failed after ${LLM_MAX_RETRIES + 1} attempts: ${llmResult.error || 'Unknown error'}`
            console.warn('LLM calculation failed after retries, using fallback:', llmResult.error)
            break
          }
        }
      } catch (error: any) {
        // Check if it's a rate limiting error
        if (error?.message?.includes('rate limited') || error?.message?.includes('429')) {
          // Rate limiting already has retry logic in callOpenRouterAPI, but if it still fails, retry the whole call
          if (retryCount < LLM_MAX_RETRIES) {
            console.warn(`[LLM] Rate limited (attempt ${retryCount + 1}/${LLM_MAX_RETRIES + 1}), retrying entire call...`)
            await new Promise(resolve => setTimeout(resolve, LLM_RETRY_DELAY_MS * (retryCount + 1))) // Exponential backoff
            retryCount++
            continue
          } else {
            llmFailed = true
            fallbackReason = 'LLM calculation rate limited after retries. The free model is temporarily unavailable. Consider configuring your own OpenRouter API key for better reliability.'
            console.warn('LLM calculation rate limited after retries, using fallback. The free model is temporarily unavailable. Consider configuring your own OpenRouter API key for better reliability.')
            break
          }
        } else {
          // Other errors - retry might help (network issues, timeouts, etc.)
          if (retryCount < LLM_MAX_RETRIES) {
            console.warn(`[LLM] Error (attempt ${retryCount + 1}/${LLM_MAX_RETRIES + 1}), retrying...`, error.message)
            await new Promise(resolve => setTimeout(resolve, LLM_RETRY_DELAY_MS * (retryCount + 1))) // Exponential backoff
            retryCount++
            continue
          } else {
            llmFailed = true
            fallbackReason = `LLM calculation error after ${LLM_MAX_RETRIES + 1} attempts: ${error?.message || 'Unknown error'}`
            console.error('LLM calculation error after retries:', error)
            break
          }
        }
      }
    }
  } else if (isWalkover) {
    // Walkover matches don't use LLM - they use standard ELO calculation
    fallbackReason = 'Walkover (WO) match - using standard ELO calculation (no LLM needed).'
  } else if (!config.openRouterApiKey) {
    // No API key configured
    fallbackReason = 'No OpenRouter API key configured. LLM calculation was not attempted.'
    console.warn('[LLM] No API key found. Check OPENROUTER_API_KEY environment variable.')
    console.warn('[LLM] Config check:', {
      hasApiKey: !!config.openRouterApiKey,
      apiKeyType: typeof config.openRouterApiKey,
      apiKeyLength: config.openRouterApiKey?.length || 0
    })
  } else if (!match.score) {
    // No score available
    fallbackReason = 'Match score not available. LLM calculation requires a score to analyze.'
  }
  
  // Calculate ELO changes (use LLM result if available, otherwise fallback)
  let eloResult: ReturnType<typeof calculateELOChange>
  
  if (llmUsed && llmResult) {
    // Use LLM-calculated ELO changes
    // The LLM should already include win streak bonuses in its calculation
    // Calculate what the bonus would be for tracking purposes (only applies after 2 consecutive wins)
    let player1WinStreakBonus = 0
    let player2WinStreakBonus = 0
    
    if (winnerId === 1 && !player1IsUnrated) {
      const newStreak = player1.win_streak + 1
      if (newStreak >= WIN_STREAK_BONUS_MIN_WINS) {
        player1WinStreakBonus = calculateWinStreakBonus(newStreak) - calculateWinStreakBonus(player1.win_streak)
      }
    }
    
    if (winnerId === 2 && !player2IsUnrated) {
      const newStreak = player2.win_streak + 1
      if (newStreak >= WIN_STREAK_BONUS_MIN_WINS) {
        player2WinStreakBonus = calculateWinStreakBonus(newStreak) - calculateWinStreakBonus(player2.win_streak)
      }
    }
    
    eloResult = {
      player1Change: Math.round(llmResult.player1EloChange),
      player2Change: Math.round(llmResult.player2EloChange),
      player1WinStreakBonus, // Track for display, but LLM should have included it
      player2WinStreakBonus  // Track for display, but LLM should have included it
    }
  } else {
    // Use fallback ELO calculation
    if (llmFailed && match.score) {
      // Try simple fallback from LLM utility
      const fallback = getDefaultEloCalculation(
        player1Effective.elo,
        player2Effective.elo,
        match.winner_id,
        match.player1_id
      )
      eloResult = {
        player1Change: fallback.player1EloChange,
        player2Change: fallback.player2EloChange,
        player1WinStreakBonus: 0,
        player2WinStreakBonus: 0
      }
    } else {
      // Use existing comprehensive ELO calculation
      eloResult = calculateELOChange(
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
    }
  }
  
  // Calculate UTR match rating and weight (if score available)
  let utrData: {
    matchRatingP1: number
    matchRatingP2: number
    matchWeight: number
    gamesWonP1: number
    gamesLostP1: number
    totalGames: number
    format: string
  } | null = null
  
  if (match.score) {
    try {
      const format = detectMatchFormatFromScore(match.score)
      const gamesData = parseGamesFromScore(match.score, 1)
      
      // Calculate match rating for both players
      const matchRatingP1 = calculateMatchRating(
        player1Effective.elo,
        player2Effective.elo,
        gamesData.gamesWon,
        gamesData.totalGames
      )
      const matchRatingP2 = calculateMatchRating(
        player2Effective.elo,
        player1Effective.elo,
        gamesData.gamesLost,
        gamesData.totalGames
      )
      
      // Calculate match weight
      const formatWeight = getFormatWeight(format)
      const competitivenessWeight = getCompetitivenessWeight(Math.abs(player1Effective.elo - player2Effective.elo))
      const reliabilityWeightP1 = getReliabilityWeight(
        player2.total_matches_played,
        player2.last_match_at
      )
      const reliabilityWeightP2 = getReliabilityWeight(
        player1.total_matches_played,
        player1.last_match_at
      )
      
      // Use average reliability for match weight (or use LLM's match weight if available)
      const avgReliability = (reliabilityWeightP1 + reliabilityWeightP2) / 2
      const matchWeight = llmUsed && llmResult 
        ? llmResult.matchWeight 
        : formatWeight * competitivenessWeight * avgReliability
      
      utrData = {
        matchRatingP1,
        matchRatingP2,
        matchWeight,
        gamesWonP1: gamesData.gamesWon,
        gamesLostP1: gamesData.gamesLost,
        totalGames: gamesData.totalGames,
        format
      }
    } catch (error) {
      console.error('Error calculating UTR data:', error)
    }
  }
  
  // Update match with LLM calculation metadata
  if (llmUsed || llmFailed || fallbackReason) {
    await supabase
      .from('matches')
      .update({
        llm_elo_calculated: llmUsed,
        llm_calculation_failed: llmFailed,
        llm_calculation_reasoning: llmUsed ? (llmResult?.reasoning || null) : fallbackReason,
        llm_calculation_model: llmUsed ? 'google/gemini-2.5-flash' : null,
        llm_calculation_timestamp: llmUsed || llmFailed || fallbackReason ? new Date().toISOString() : null
      })
      .eq('id', matchId)
  }
  
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
  
  // Check if rating history already exists for this match (prevent duplicates)
  // This prevents double-counting if updateRatingsAfterMatch is called multiple times
  const { data: existingHistory, error: historyCheckError } = await supabase
    .from('rating_history')
    .select('id, player_id, rating_reversed')
    .eq('match_id', matchId)
    .eq('rating_reversed', false)
    .limit(2) // We expect 2 entries (one per player) if they exist
  
  if (historyCheckError) {
    console.error('Error checking existing rating history:', historyCheckError)
    // Continue anyway - this is just a safety check
  }
  
  // If rating history already exists and hasn't been reversed, skip calculation
  // This prevents duplicate calculations if updateRatingsAfterMatch is called multiple times
  if (existingHistory && existingHistory.length >= 2) {
    const player1HistoryExists = existingHistory.some(h => h.player_id === player1.id)
    const player2HistoryExists = existingHistory.some(h => h.player_id === player2.id)
    
    if (player1HistoryExists && player2HistoryExists) {
      console.warn(`[updateRatingsAfterMatch] Rating history already exists for match ${matchId}. Skipping duplicate calculation.`)
      // Return null to indicate no calculation was performed (match already processed)
      return null
    }
  }
  
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
  
  // Generate brief reasoning preview from LLM reasoning (max 1500 chars)
  // This creates a concise summary for quick display in rating history
  // We use a larger limit to capture more of the reasoning while still being manageable
  const generateReasoningPreview = (reasoning: string | null | undefined): string | null => {
    if (!reasoning) return null
    
    // Remove extra whitespace and newlines, normalize spaces
    const cleaned = reasoning.replace(/\s+/g, ' ').trim()
    
    // If already short enough, return as is
    if (cleaned.length <= 1500) return cleaned
    
    // Try to find a good breaking point (sentence end, period, etc.)
    const maxLength = 1500
    let preview = cleaned.substring(0, maxLength)
    
    // Try to break at sentence boundary (preferred)
    // Look for sentence endings within the last 200 chars to get a good break point
    const searchStart = Math.max(0, maxLength - 200)
    const searchEnd = maxLength
    const searchText = cleaned.substring(searchStart, searchEnd)
    
    const lastPeriod = searchText.lastIndexOf('.')
    const lastExclamation = searchText.lastIndexOf('!')
    const lastQuestion = searchText.lastIndexOf('?')
    const lastBreak = Math.max(lastPeriod, lastExclamation, lastQuestion)
    
    if (lastBreak > 50) {
      // Found a sentence break within reasonable distance (at least 50 chars from end)
      preview = cleaned.substring(0, searchStart + lastBreak + 1)
    } else {
      // Try to break at paragraph or section boundary (double newline or common patterns)
      const paragraphBreak = cleaned.substring(0, maxLength).lastIndexOf('\n\n')
      if (paragraphBreak > maxLength * 0.8) {
        preview = cleaned.substring(0, paragraphBreak)
      } else {
        // Break at word boundary to avoid cutting words
        const lastSpace = preview.lastIndexOf(' ')
        if (lastSpace > maxLength * 0.9) {
          // Good word boundary found (within last 10%)
          preview = cleaned.substring(0, lastSpace) + '...'
        } else {
          // Fallback: just truncate and add ellipsis
          preview = preview + '...'
        }
      }
    }
    
    return preview
  }
  
  const reasoningPreview = generateReasoningPreview(llmResult?.reasoning)
  
  // Record rating history for player 1
  const player1Expected = calculateExpectedScore(player1Effective.elo, player2Effective.elo)
  const { error: player1HistoryError } = await supabase.from('rating_history').insert({
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
    // UTR data
    match_rating: utrData?.matchRatingP1 || null,
    match_weight: utrData?.matchWeight || null,
    games_won: utrData?.gamesWonP1 || null,
    games_lost: utrData?.gamesLostP1 || null,
    total_games: utrData?.totalGames || null,
    // LLM reasoning preview
    reasoning_preview: reasoningPreview,
  })
  
  if (player1HistoryError) {
    console.error('Failed to insert rating history for player 1:', player1HistoryError)
    // Continue anyway - rating history is important but not critical
  }
  
  // Record rating history for player 2
  const player2Expected = 1 - player1Expected
  const { error: player2HistoryError } = await supabase.from('rating_history').insert({
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
    // UTR data
    match_rating: utrData?.matchRatingP2 || null,
    match_weight: utrData?.matchWeight || null,
    games_won: utrData?.gamesLostP1 || null, // Player 2's games won = Player 1's games lost
    games_lost: utrData?.gamesWonP1 || null, // Player 2's games lost = Player 1's games won
    total_games: utrData?.totalGames || null,
    // LLM reasoning preview (same for both players)
    reasoning_preview: reasoningPreview,
  })
  
  if (player2HistoryError) {
    console.error('Failed to insert rating history for player 2:', player2HistoryError)
    // Continue anyway - rating history is important but not critical
  }
  
  // Update player UTR ratings
  if (utrData) {
    await updatePlayerUtrRating(player1.id, supabase)
    await updatePlayerUtrRating(player2.id, supabase)
  }
  
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
    llmUsed,
    llmFailed
  }
}

/**
 * Update player UTR rating based on match history
 */
async function updatePlayerUtrRating(playerId: string, supabase: SupabaseClient): Promise<void> {
  try {
    // Fetch match history with UTR data (last 30 matches within 12 months)
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
    
    // Fetch match history with UTR data (last 30 matches within 12 months)
    // First get all rating history entries with UTR data
    const { data: allHistory, error: historyError } = await supabase
      .from('rating_history')
      .select(`
        match_rating,
        match_weight,
        created_at,
        match_id
      `)
      .eq('player_id', playerId)
      .not('match_rating', 'is', null)
      .not('match_weight', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50) // Get more to filter by date
    
    if (historyError) {
      console.error('Error fetching match history for UTR:', historyError)
      return
    }
    
    if (!allHistory || allHistory.length === 0) {
      // No matches with UTR data, calculate reliability only
      const { data: player } = await supabase
        .from('players')
        .select('total_matches_played, last_match_at')
        .eq('id', playerId)
        .single()
      
      if (player) {
        const reliability = calculatePlayerReliability(
          player.total_matches_played,
          player.last_match_at
        )
        
        await supabase
          .from('players')
          .update({ utr_reliability: reliability })
          .eq('id', playerId)
      }
      return
    }
    
    // Get match dates for filtering
    const matchIds = allHistory.map(h => h.match_id)
    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select('id, played_at')
      .in('id', matchIds)
    
    if (matchesError) {
      console.error('Error fetching matches for UTR:', matchesError)
      return
    }
    
    // Create a map of match_id -> played_at
    const matchDates = new Map(matches?.map(m => [m.id, m.played_at]) || [])
    
    // Filter by date and limit to 30
    const matchHistory = allHistory
      .filter(h => {
        const playedAt = matchDates.get(h.match_id)
        if (!playedAt) return false
        return new Date(playedAt) >= twelveMonthsAgo
      })
      .slice(0, 30)
      .map(h => ({
        ...h,
        playedAt: matchDates.get(h.match_id) || h.created_at
      }))
    
    // Calculate weighted average UTR rating
    const utrRatings = matchHistory.map(m => ({
      matchRating: Number(m.match_rating),
      matchWeight: Number(m.match_weight),
      playedAt: m.playedAt
    }))
    
    const utrRating = calculateUtrRating(utrRatings)
    
    // Calculate reliability
    const { data: player } = await supabase
      .from('players')
      .select('total_matches_played, last_match_at')
      .eq('id', playerId)
      .single()
    
    const reliability = player 
      ? calculatePlayerReliability(player.total_matches_played, player.last_match_at)
      : 0.3
    
    // Update player
    await supabase
      .from('players')
      .update({
        utr_rating: utrRating,
        utr_reliability: reliability
      })
      .eq('id', playerId)
  } catch (error) {
    console.error('Error updating player UTR rating:', error)
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
    .select('id, elo, mmr_uncertainty, matches_this_month, last_decay_check, total_matches_played, placement_matches_completed, created_at')
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
  
  // Calculate required matches (proportional if registered mid-month)
  const matchesRequired = calculateRequiredMatchesForMonth(player.created_at)
  
  // Calculate decay
  const decayAmount = calculateDecayAmount(player.matches_this_month, matchesRequired)
  const uncertaintyIncrease = (matchesRequired - Math.min(player.matches_this_month, matchesRequired)) * 0.1
  
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
