import { and, asc, count, desc, eq, exists, inArray, isNotNull, ne, not, or } from 'drizzle-orm'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useDb, type DbOrTx } from '../db'
import { categories, matches, players, rating_history } from '../db/schema'
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

// The maintenance scripts run outside Nitro, where useRuntimeConfig does not exist.
function openRouterApiKey(): string {
  if (typeof useRuntimeConfig === 'function') {
    return useRuntimeConfig().openRouterApiKey || ''
  }
  return process.env.OPENROUTER_API_KEY || ''
}

const WALKOVER_MULTIPLIER = 0.25 // Walkovers give only 25% of normal points

/**
 * Main function to update ratings after a match completes.
 * Every write (match LLM flags, both players, both rating_history rows) happens in one transaction:
 * pass `tx` to join the caller's, otherwise one is opened here. A failure rolls all of it back.
 * Returns null, without writing anything, when the match cannot be rated or was already rated.
 */
export async function updateRatingsAfterMatch(
  matchId: string,
  tx?: DbOrTx
): Promise<RatingCalculationResult | null> {
  return (tx ?? useDb()).transaction((t) => applyRatingsForMatch(matchId, t))
}

async function applyRatingsForMatch(matchId: string, db: DbOrTx): Promise<RatingCalculationResult | null> {
  // Lock the match row so two concurrent calls cannot both rate it.
  const [match] = await db
    .select({
      id: matches.id,
      player1_id: matches.player1_id,
      player2_id: matches.player2_id,
      winner_id: matches.winner_id,
      status: matches.status,
      played_at: matches.played_at,
      tournament_id: matches.tournament_id,
      score: matches.score,
      is_competitive: matches.is_competitive,
    })
    .from(matches)
    .where(eq(matches.id, matchId))
    .for('update')

  if (!match) {
    console.error('Failed to fetch match:', matchId)
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
  const player1Id = match.player1_id
  const player2Id = match.player2_id
  const matchWinnerId = match.winner_id

  // Prevent self-match
  if (player1Id === player2Id) {
    console.error('Invalid match: player1_id equals player2_id')
    return null
  }

  // Only competitive matches affect ratings; friendly matches (is_competitive = false) don't count
  if (match.is_competitive === false) {
    return null
  }

  // If non-reversed rating history already exists for both players, the match was already rated.
  const existingHistory = await db
    .select({ player_id: rating_history.player_id })
    .from(rating_history)
    .where(and(eq(rating_history.match_id, matchId), eq(rating_history.rating_reversed, false)))
  if (
    existingHistory.some((h) => h.player_id === player1Id) &&
    existingHistory.some((h) => h.player_id === player2Id)
  ) {
    console.warn(`[updateRatingsAfterMatch] Rating history already exists for match ${matchId}. Skipping duplicate calculation.`)
    return null
  }

  // Fetch both players with their category default, locked in id order so concurrent matches cannot deadlock.
  const playerRows = await db
    .select({
      id: players.id,
      elo: players.elo,
      mmr: players.mmr,
      mmr_uncertainty: players.mmr_uncertainty,
      placement_matches_completed: players.placement_matches_completed,
      win_streak: players.win_streak,
      loss_streak: players.loss_streak,
      total_matches_played: players.total_matches_played,
      matches_this_month: players.matches_this_month,
      last_match_at: players.last_match_at,
      category_default_elo: categories.default_elo,
    })
    .from(players)
    .leftJoin(categories, eq(players.category_id, categories.id))
    .where(inArray(players.id, [player1Id, player2Id]))
    .orderBy(asc(players.id))
    .for('update', { of: players })

  const player1 = playerRows.find((p) => p.id === player1Id)
  const player2 = playerRows.find((p) => p.id === player2Id)
  if (!player1 || !player2) {
    console.error('Failed to fetch players for match', matchId)
    return null
  }

  // Actual placement match count from rating_history, so matches processed out of chronological order stay correct
  const placementCount = async (playerId: string) => {
    const [row] = await db
      .select({ n: count() })
      .from(rating_history)
      .where(
        and(
          eq(rating_history.player_id, playerId),
          eq(rating_history.is_placement_match, true),
          eq(rating_history.rating_reversed, false)
        )
      )
    return row?.n ?? 0
  }
  const player1ActualPlacementCount = await placementCount(player1Id)
  const player2ActualPlacementCount = await placementCount(player2Id)

  const player1TotalMatches = player1.total_matches_played ?? 0
  const player2TotalMatches = player2.total_matches_played ?? 0
  const player1WinStreak = player1.win_streak ?? 0
  const player2WinStreak = player2.win_streak ?? 0
  const player1PlacementCompleted = player1.placement_matches_completed ?? 0
  const player2PlacementCompleted = player2.placement_matches_completed ?? 0

  // Determine winner
  const winnerId: 1 | 2 = matchWinnerId === player1Id ? 1 : 2

  // Check if players are unrated
  const player1IsUnrated = isPlayerUnrated(player1TotalMatches)
  const player2IsUnrated = isPlayerUnrated(player2TotalMatches)

  // All matches count as placement until 3 are completed, counted from rating_history (see above)
  const isPlayer1PlacementMatch = player1ActualPlacementCount < 3
  const isPlayer2PlacementMatch = player2ActualPlacementCount < 3

  // Get default ELO from category
  const player1DefaultElo = player1.category_default_elo ?? 1000
  const player2DefaultElo = player2.category_default_elo ?? 1000

  // Get effective ratings (use category defaults for unrated)
  const player1Effective = getEffectiveRatings(player1.elo, Number(player1.mmr), player1IsUnrated, player1DefaultElo)
  const player2Effective = getEffectiveRatings(player2.elo, Number(player2.mmr), player2IsUnrated, player2DefaultElo)

  // Try LLM ELO calculation first (if API key available)
  const apiKey = openRouterApiKey()
  let llmResult: LlmEloCalculationResult | null = null
  let llmUsed = false
  let llmFailed = false
  let fallbackReason: string | null = null

  // Retry configuration for LLM calls
  const LLM_MAX_RETRIES = 2
  const LLM_RETRY_DELAY_MS = 2000 // 2 seconds between retries

  // Check if score is a walkover (WO) - walkovers don't need LLM calculation
  const isWalkover = match.score?.trim().toUpperCase() === 'WO'

  if (apiKey && match.score && !isWalkover) {
    let retryCount = 0

    while (retryCount <= LLM_MAX_RETRIES) {
      try {
        llmResult = await calculateEloWithLLM(
          {
            matchId: match.id,
            player1Id,
            player2Id,
            player1Elo: player1Effective.elo,
            player2Elo: player2Effective.elo,
            score: match.score,
            winnerId: matchWinnerId,
            tournamentId: match.tournament_id || undefined
          },
          { openRouterApiKey: apiKey },
          db
        )

        if (llmResult.success) {
          llmUsed = true
          break // Success, exit retry loop
        } else if (retryCount < LLM_MAX_RETRIES) {
          // If validation or parsing failed, retry might help
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
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        const rateLimited = message.includes('rate limited') || message.includes('429')
        if (retryCount < LLM_MAX_RETRIES) {
          console.warn(`[LLM] ${rateLimited ? 'Rate limited' : 'Error'} (attempt ${retryCount + 1}/${LLM_MAX_RETRIES + 1}), retrying...`, message)
          await new Promise(resolve => setTimeout(resolve, LLM_RETRY_DELAY_MS * (retryCount + 1))) // Exponential backoff
          retryCount++
          continue
        }
        llmFailed = true
        fallbackReason = rateLimited
          ? 'LLM calculation rate limited after retries. The free model is temporarily unavailable. Consider configuring your own OpenRouter API key for better reliability.'
          : `LLM calculation error after ${LLM_MAX_RETRIES + 1} attempts: ${message || 'Unknown error'}`
        console.error('LLM calculation error after retries:', error)
        break
      }
    }
  } else if (isWalkover) {
    // Walkover matches don't use LLM - they use standard ELO calculation
    fallbackReason = 'Walkover (WO) match - using standard ELO calculation (no LLM needed).'
  } else if (!apiKey) {
    fallbackReason = 'No OpenRouter API key configured. LLM calculation was not attempted.'
  } else if (!match.score) {
    fallbackReason = 'Match score not available. LLM calculation requires a score to analyze.'
  }

  // Calculate ELO changes (use LLM result if available, otherwise fallback)
  let eloResult: ReturnType<typeof calculateELOChange>

  if (llmUsed && llmResult) {
    // The LLM should already include win streak bonuses; compute them for tracking only
    let player1WinStreakBonus = 0
    let player2WinStreakBonus = 0

    if (winnerId === 1 && !player1IsUnrated) {
      const newStreak = player1WinStreak + 1
      if (newStreak >= WIN_STREAK_BONUS_MIN_WINS) {
        player1WinStreakBonus = calculateWinStreakBonus(newStreak) - calculateWinStreakBonus(player1WinStreak)
      }
    }

    if (winnerId === 2 && !player2IsUnrated) {
      const newStreak = player2WinStreak + 1
      if (newStreak >= WIN_STREAK_BONUS_MIN_WINS) {
        player2WinStreakBonus = calculateWinStreakBonus(newStreak) - calculateWinStreakBonus(player2WinStreak)
      }
    }

    eloResult = {
      player1Change: Math.round(llmResult.player1EloChange),
      player2Change: Math.round(llmResult.player2EloChange),
      player1WinStreakBonus,
      player2WinStreakBonus
    }
  } else {
    if (llmFailed && match.score) {
      // Simple fallback from the LLM utility
      const fallback = getDefaultEloCalculation(player1Effective.elo, player2Effective.elo, matchWinnerId, player1Id)
      eloResult = {
        player1Change: fallback.player1EloChange,
        player2Change: fallback.player2EloChange,
        player1WinStreakBonus: 0,
        player2WinStreakBonus: 0
      }
    } else {
      // Comprehensive ELO calculation
      eloResult = calculateELOChange(
        player1Effective.elo,
        player2Effective.elo,
        winnerId,
        isPlayer1PlacementMatch,
        isPlayer2PlacementMatch,
        player1WinStreak,
        player2WinStreak,
        player1IsUnrated,
        player2IsUnrated,
        player1Effective.mmr,
        player2Effective.mmr
      )
    }

    // Walkovers give minimal points and no win streak bonus
    if (isWalkover) {
      eloResult.player1Change = Math.round(eloResult.player1Change * WALKOVER_MULTIPLIER)
      eloResult.player2Change = Math.round(eloResult.player2Change * WALKOVER_MULTIPLIER)
      eloResult.player1WinStreakBonus = 0
      eloResult.player2WinStreakBonus = 0
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

      const matchRatingP1 = calculateMatchRating(player1Effective.elo, player2Effective.elo, gamesData.gamesWon, gamesData.totalGames)
      const matchRatingP2 = calculateMatchRating(player2Effective.elo, player1Effective.elo, gamesData.gamesLost, gamesData.totalGames)

      const formatWeight = getFormatWeight(format)
      const competitivenessWeight = getCompetitivenessWeight(Math.abs(player1Effective.elo - player2Effective.elo))
      const reliabilityWeightP1 = getReliabilityWeight(player2TotalMatches, player2.last_match_at)
      const reliabilityWeightP2 = getReliabilityWeight(player1TotalMatches, player1.last_match_at)

      // Use average reliability for match weight (or the LLM's match weight if available)
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

  // Record how this match was rated (LLM, LLM failure with fallback, or the reason it was not attempted)
  if (llmUsed || llmFailed || fallbackReason) {
    await db
      .update(matches)
      .set({
        llm_elo_calculated: llmUsed,
        llm_calculation_failed: llmFailed,
        llm_calculation_reasoning: llmUsed ? (llmResult?.reasoning || null) : fallbackReason,
        llm_calculation_model: llmUsed ? 'google/gemini-2.5-flash' : null,
        llm_calculation_timestamp: new Date()
      })
      .where(eq(matches.id, matchId))
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

  // Apply walkover penalty to MMR changes as well
  if (isWalkover) {
    mmrResult.player1MmrChange = mmrResult.player1MmrChange * WALKOVER_MULTIPLIER
    mmrResult.player2MmrChange = mmrResult.player2MmrChange * WALKOVER_MULTIPLIER
  }

  // Reset matches_this_month when the match is in a different month
  const player1MatchesThisMonth = getUpdatedMatchCount(player1.matches_this_month ?? 0, match.played_at)
  const player2MatchesThisMonth = getUpdatedMatchCount(player2.matches_this_month ?? 0, match.played_at)

  const player1EloBefore = player1IsUnrated ? player1DefaultElo : player1.elo
  const player2EloBefore = player2IsUnrated ? player2DefaultElo : player2.elo
  const player1NewElo = Math.max(ELO_MIN, player1EloBefore + eloResult.player1Change)
  const player2NewElo = Math.max(ELO_MIN, player2EloBefore + eloResult.player2Change)

  const player1NewMmr = (player1IsUnrated ? player1Effective.mmr : Number(player1.mmr)) + mmrResult.player1MmrChange
  const player2NewMmr = (player2IsUnrated ? player2Effective.mmr : Number(player2.mmr)) + mmrResult.player2MmrChange

  // win_streak is consecutive wins, capped at total matches + 1 (this match); a loss resets it
  const player1NewWinStreak = winnerId === 1 ? Math.min(player1WinStreak + 1, player1TotalMatches + 1) : 0
  const player1NewLossStreak = winnerId === 1 ? 0 : (player1.loss_streak ?? 0) + 1
  const player2NewWinStreak = winnerId === 2 ? Math.min(player2WinStreak + 1, player2TotalMatches + 1) : 0
  const player2NewLossStreak = winnerId === 2 ? 0 : (player2.loss_streak ?? 0) + 1

  // Update placement matches count (only increment if was in placement)
  const player1NewPlacementCount = isPlayer1PlacementMatch
    ? player1PlacementCompleted + 1
    : (player1IsUnrated ? 1 : player1PlacementCompleted)
  const player2NewPlacementCount = isPlayer2PlacementMatch
    ? player2PlacementCompleted + 1
    : (player2IsUnrated ? 1 : player2PlacementCompleted)

  const lastMatchAt = match.played_at ?? new Date()

  await db
    .update(players)
    .set({
      elo: player1NewElo,
      mmr: player1NewMmr,
      mmr_uncertainty: mmrResult.player1NewUncertainty,
      placement_matches_completed: Math.min(3, player1NewPlacementCount),
      win_streak: player1NewWinStreak,
      loss_streak: player1NewLossStreak,
      last_match_at: lastMatchAt,
      matches_this_month: player1MatchesThisMonth + 1,
      total_matches_played: player1TotalMatches + 1,
    })
    .where(eq(players.id, player1Id))

  await db
    .update(players)
    .set({
      elo: player2NewElo,
      mmr: player2NewMmr,
      mmr_uncertainty: mmrResult.player2NewUncertainty,
      placement_matches_completed: Math.min(3, player2NewPlacementCount),
      win_streak: player2NewWinStreak,
      loss_streak: player2NewLossStreak,
      last_match_at: lastMatchAt,
      matches_this_month: player2MatchesThisMonth + 1,
      total_matches_played: player2TotalMatches + 1,
    })
    .where(eq(players.id, player2Id))

  const reasoningPreview = generateReasoningPreview(llmResult?.reasoning)

  const player1Expected = calculateExpectedScore(player1Effective.elo, player2Effective.elo)
  const player2Expected = 1 - player1Expected

  await db.insert(rating_history).values([
    {
      player_id: player1Id,
      match_id: matchId,
      elo_before: player1EloBefore,
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
      opponent_id: player2Id,
      opponent_elo: player2Effective.elo,
      opponent_mmr: player2Effective.mmr,
      was_winner: winnerId === 1,
      match_rating: utrData?.matchRatingP1 || null,
      match_weight: utrData?.matchWeight || null,
      games_won: utrData?.gamesWonP1 || null,
      games_lost: utrData?.gamesLostP1 || null,
      total_games: utrData?.totalGames || null,
      reasoning_preview: reasoningPreview,
    },
    {
      player_id: player2Id,
      match_id: matchId,
      elo_before: player2EloBefore,
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
      opponent_id: player1Id,
      opponent_elo: player1Effective.elo,
      opponent_mmr: player1Effective.mmr,
      was_winner: winnerId === 2,
      match_rating: utrData?.matchRatingP2 || null,
      match_weight: utrData?.matchWeight || null,
      games_won: utrData?.gamesLostP1 || null, // Player 2's games won = Player 1's games lost
      games_lost: utrData?.gamesWonP1 || null, // Player 2's games lost = Player 1's games won
      total_games: utrData?.totalGames || null,
      reasoning_preview: reasoningPreview,
    },
  ])

  // UTR ratings are derived data; a failure there must not undo the match's ratings.
  if (utrData) {
    await updatePlayerUtrRating(player1Id, db)
    await updatePlayerUtrRating(player2Id, db)
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
 * Brief reasoning preview from the LLM reasoning (max 1500 chars) for quick display in rating history
 */
function generateReasoningPreview(reasoning: string | null | undefined): string | null {
  if (!reasoning) return null

  const cleaned = reasoning.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= 1500) return cleaned

  const maxLength = 1500
  let preview = cleaned.substring(0, maxLength)

  // Prefer a sentence boundary within the last 200 chars
  const searchStart = Math.max(0, maxLength - 200)
  const searchText = cleaned.substring(searchStart, maxLength)
  const lastBreak = Math.max(searchText.lastIndexOf('.'), searchText.lastIndexOf('!'), searchText.lastIndexOf('?'))

  if (lastBreak > 50) {
    preview = cleaned.substring(0, searchStart + lastBreak + 1)
  } else {
    const paragraphBreak = cleaned.substring(0, maxLength).lastIndexOf('\n\n')
    if (paragraphBreak > maxLength * 0.8) {
      preview = cleaned.substring(0, paragraphBreak)
    } else {
      const lastSpace = preview.lastIndexOf(' ')
      preview = lastSpace > maxLength * 0.9 ? cleaned.substring(0, lastSpace) + '...' : preview + '...'
    }
  }

  return preview
}

/**
 * Update player UTR rating based on match history.
 * Runs in a savepoint and swallows its errors: UTR is derived data and must not abort the caller's transaction.
 */
async function updatePlayerUtrRating(playerId: string, db: DbOrTx): Promise<void> {
  try {
    await db.transaction(async (t) => {
      const twelveMonthsAgo = new Date()
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

      // Rating history entries with UTR data, newest first, with the match date
      const allHistory = await t
        .select({
          match_rating: rating_history.match_rating,
          match_weight: rating_history.match_weight,
          created_at: rating_history.created_at,
          played_at: matches.played_at,
        })
        .from(rating_history)
        .innerJoin(matches, eq(matches.id, rating_history.match_id))
        .where(
          and(
            eq(rating_history.player_id, playerId),
            isNotNull(rating_history.match_rating),
            isNotNull(rating_history.match_weight)
          )
        )
        .orderBy(desc(rating_history.created_at))
        .limit(50)

      const [player] = await t
        .select({ total_matches_played: players.total_matches_played, last_match_at: players.last_match_at })
        .from(players)
        .where(eq(players.id, playerId))

      if (allHistory.length === 0) {
        // No matches with UTR data, calculate reliability only
        if (player) {
          const reliability = calculatePlayerReliability(player.total_matches_played ?? 0, player.last_match_at)
          await t.update(players).set({ utr_reliability: reliability }).where(eq(players.id, playerId))
        }
        return
      }

      // Last 30 matches played within 12 months
      const utrRatings = allHistory
        .filter((h) => h.played_at !== null && h.played_at >= twelveMonthsAgo)
        .slice(0, 30)
        .map((h) => ({
          matchRating: Number(h.match_rating),
          matchWeight: Number(h.match_weight),
          playedAt: h.played_at ?? h.created_at ?? new Date(),
        }))

      const utrRating = calculateUtrRating(utrRatings)
      const reliability = player
        ? calculatePlayerReliability(player.total_matches_played ?? 0, player.last_match_at)
        : 0.3

      await t
        .update(players)
        .set({ utr_rating: utrRating, utr_reliability: reliability })
        .where(eq(players.id, playerId))
    })
  } catch (error) {
    console.error('Error updating player UTR rating:', error)
  }
}

/**
 * Helper function to get updated match count for the current month
 */
function getUpdatedMatchCount(currentCount: number, matchPlayedAt: Date | null): number {
  if (!matchPlayedAt) {
    return currentCount
  }

  const now = new Date()

  // If match is in a different month than current, reset count
  if (matchPlayedAt.getMonth() !== now.getMonth() || matchPlayedAt.getFullYear() !== now.getFullYear()) {
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
