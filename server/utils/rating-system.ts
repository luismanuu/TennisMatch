import { and, asc, count, desc, eq, exists, gt, gte, inArray, isNotNull, isNull, lt, ne, not, or, sql } from 'drizzle-orm'
import { useDb, type DbOrTx } from '../db'
import { categories, matches, players, rating_history } from '../db/schema'
import type { RatingTierInfo, RatingCalculationResult, MonthlyDecayStatus } from '~/types'
import {
  classifyStoredScore,
  expectedScore,
  explanationFor,
  isRatable,
  parseExplanation,
  ratePair,
  RATING_FLOOR,
  type MatchClassification,
} from './elo'
import {
  detectMatchFormatFromScore,
  parseGamesFromScore,
  calculateMatchRating,
  calculateUtrRating,
  calculatePlayerReliability,
  getFormatWeight,
  getCompetitivenessWeight,
  getReliabilityWeight
} from './utr-rating-system'

// The SR formula lives in ./elo.ts (pure). This file reads and writes it: tiers, the match rating write, reversal,
// monthly decay and UTR upkeep.

// MMR to ELO conversion. players.mmr is kept as a mirror of the SR on the old MMR scale (legacy column, no longer
// an input to any rating).
const MMR_ELO_CENTER = 2250
const MMR_ELO_SCALE = 750

// Uncertainty bounds (legacy column: decay still raises it; no rating reads it)
const UNCERTAINTY_MIN = 0.5
const UNCERTAINTY_MAX = 2.0

// ELO bounds
const ELO_MIN = RATING_FLOOR
export const ELO_DECAY_FLOOR = 500

// Monthly decay
export const MATCHES_REQUIRED_PER_MONTH = 2
const DECAY_PER_MISSED_MATCH = 25
const MAX_DECAY_MONTHS = 4

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
 * Probability that a player with `player1Elo` beats one with `player2Elo` (the SR formula's expected score)
 */
export function getExpectedWinProbability(player1Elo: number, player2Elo: number): number {
  return expectedScore(player1Elo, player2Elo)
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
 * Days left in the current UTC month
 */
export function getDaysRemainingInMonth(): number {
  const now = new Date()
  const lastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))
  return lastDay.getUTCDate() - now.getUTCDate()
}

// First instant of a UTC month, `offset` months from the current one.
export function utcMonthStart(offset = 0): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1))
}

/**
 * Matches required in the UTC month starting at `monthStart` (default: the current month). A player who registered
 * after day 1 of that month owes a share proportional to the days left from registration, at least 1.
 * The decay job passes the month it is closing, so it applies the requirement the player saw during that month.
 */
export function calculateRequiredMatchesForMonth(playerCreatedAt: string | null | Date, monthStart: Date = utcMonthStart()): number {
  if (!playerCreatedAt) {
    return MATCHES_REQUIRED_PER_MONTH
  }

  const created = typeof playerCreatedAt === 'string' ? new Date(playerCreatedAt) : playerCreatedAt
  const inMonth = created.getUTCFullYear() === monthStart.getUTCFullYear() && created.getUTCMonth() === monthStart.getUTCMonth()
  if (!inMonth || created.getUTCDate() === 1) {
    return MATCHES_REQUIRED_PER_MONTH
  }

  const daysInMonth = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0)).getUTCDate()
  const daysRemainingFromCreation = daysInMonth - created.getUTCDate() + 1
  return Math.max(1, Math.round((MATCHES_REQUIRED_PER_MONTH * daysRemainingFromCreation) / daysInMonth))
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

// ============================================
// MATCH RATING (reads and writes; the math is ./elo.ts)
// ============================================

/**
 * Rate a completed match, once. Locks the match and both players (players in id order, so concurrent matches cannot
 * deadlock), re-checks that the match is completed, competitive and not rated yet, computes the change with the SR
 * formula and writes both players and both rating_history rows. Runs in a transaction; pass `tx` to join the
 * caller's (approve_score does, so completing a match and rating it commit together or not at all).
 *
 * `classification` is how the result was classified when it was entered (score parser or an explicit form choice);
 * without it the stored score is parsed again. Returns null, writing nothing, when the match cannot be rated, is a
 * walkover or abandoned match, or was already rated.
 */
export async function updateRatingsAfterMatch(
  matchId: string,
  tx?: DbOrTx,
  classification?: MatchClassification
): Promise<RatingCalculationResult | null> {
  return (tx ?? useDb()).transaction(async (t) => {
    const inputs = await loadRatingInputs(matchId, t)
    return inputs ? writeRatings(inputs, classification ?? classifyStoredScore(inputs.match.score), t) : null
  })
}

// Thrown inside the recalculation transaction so a re-rate that produced nothing also undoes the reversal
class NothingRecalculated extends Error {}

/**
 * Reverse a match's ratings and rate it again from the players' current ratings (admin recalculate). The reversal
 * and the new rating apply together or not at all. The classification stored with the reversed rating is reused,
 * so an explicit choice (a walkover ticked in the form) is not replaced by a re-parse. `result` is null (and nothing
 * changed) when the match cannot be rated again.
 */
export async function recalculateMatchRatings(
  matchId: string
): Promise<{ reversed: number; result: RatingCalculationResult | null }> {
  try {
    return await useDb().transaction(async (t) => {
      await t.select({ id: matches.id }).from(matches).where(eq(matches.id, matchId)).for('update')
      const [previous] = await t
        .select({ reasoning_preview: rating_history.reasoning_preview })
        .from(rating_history)
        .where(and(eq(rating_history.match_id, matchId), eq(rating_history.rating_reversed, false)))
        .limit(1)
      const classification = parseExplanation(previous?.reasoning_preview)?.classification
      const reversed = await reverseMatchRatings(matchId, t)
      const result = await updateRatingsAfterMatch(matchId, t, classification)
      if (!result) {
        throw new NothingRecalculated()
      }
      return { reversed, result }
    })
  } catch (error) {
    if (error instanceof NothingRecalculated) {
      return { reversed: 0, result: null }
    }
    throw error
  }
}

type RatingPlayer = {
  id: string
  elo: number
  mmr: number | null
  mmr_uncertainty: number | null
  win_streak: number | null
  loss_streak: number | null
  total_matches_played: number | null
  matches_this_month: number | null
  last_match_at: Date | null
}

// Everything a rating is computed from
interface RatingInputs {
  match: { id: string; score: string | null; played_at: Date | null }
  player1: RatingPlayer
  player2: RatingPlayer
  winnerIsPlayer1: boolean
  /** Live rated matches each player had before this one: the formula's experience */
  player1RatedMatches: number
  player2RatedMatches: number
}

/**
 * Lock and read what a rating needs, inside a transaction. Returns null when the match cannot be rated (not
 * completed, no winner, a missing player, a self-match, a friendly) or already has live ratings.
 */
async function loadRatingInputs(matchId: string, t: DbOrTx): Promise<RatingInputs | null> {
  const [match] = await t
    .select({
      id: matches.id,
      player1_id: matches.player1_id,
      player2_id: matches.player2_id,
      winner_id: matches.winner_id,
      status: matches.status,
      played_at: matches.played_at,
      score: matches.score,
      is_competitive: matches.is_competitive,
    })
    .from(matches)
    .where(eq(matches.id, matchId))
    .for('update')

  if (!match || match.status !== 'completed' || !match.winner_id || !match.player1_id || !match.player2_id) {
    return null
  }
  if (match.player1_id === match.player2_id || match.is_competitive === false) {
    return null
  }
  if (match.winner_id !== match.player1_id && match.winner_id !== match.player2_id) {
    return null
  }

  const [{ n: live }] = await t
    .select({ n: count() })
    .from(rating_history)
    .where(and(eq(rating_history.match_id, matchId), eq(rating_history.rating_reversed, false)))
  if (live > 0) {
    return null
  }

  const playerRows = await t
    .select({
      id: players.id,
      elo: players.elo,
      mmr: players.mmr,
      mmr_uncertainty: players.mmr_uncertainty,
      win_streak: players.win_streak,
      loss_streak: players.loss_streak,
      total_matches_played: players.total_matches_played,
      matches_this_month: players.matches_this_month,
      last_match_at: players.last_match_at,
    })
    .from(players)
    .where(inArray(players.id, [match.player1_id, match.player2_id]))
    .orderBy(asc(players.id))
    .for('update')

  const player1 = playerRows.find((p) => p.id === match.player1_id)
  const player2 = playerRows.find((p) => p.id === match.player2_id)
  if (!player1 || !player2) {
    return null
  }

  // Experience from the live history, so a match rated out of order still sees the matches rated before it
  const ratedMatches = async (playerId: string) => {
    const [row] = await t
      .select({ n: count() })
      .from(rating_history)
      .where(and(eq(rating_history.player_id, playerId), eq(rating_history.rating_reversed, false)))
    return row?.n ?? 0
  }

  return {
    match: { id: match.id, score: match.score, played_at: match.played_at },
    player1,
    player2,
    winnerIsPlayer1: match.winner_id === match.player1_id,
    player1RatedMatches: await ratedMatches(player1.id),
    player2RatedMatches: await ratedMatches(player2.id),
  }
}

// UTR match data from the score (UTR is a separate, derived number; SR does not read it)
function utrMatchData(score: string | null, player1: RatingPlayer, player2: RatingPlayer) {
  if (!score) return null
  const games = parseGamesFromScore(score, 1)
  if (games.totalGames === 0) return null
  const reliability =
    (getReliabilityWeight(player2.total_matches_played ?? 0, player2.last_match_at) +
      getReliabilityWeight(player1.total_matches_played ?? 0, player1.last_match_at)) /
    2
  return {
    matchRatingP1: calculateMatchRating(player1.elo, player2.elo, games.gamesWon, games.totalGames),
    matchRatingP2: calculateMatchRating(player2.elo, player1.elo, games.gamesLost, games.totalGames),
    matchWeight: getFormatWeight(detectMatchFormatFromScore(score)) * getCompetitivenessWeight(Math.abs(player1.elo - player2.elo)) * reliability,
    gamesWonP1: games.gamesWon,
    gamesLostP1: games.gamesLost,
    totalGames: games.totalGames,
  }
}

async function writeRatings(
  inputs: RatingInputs,
  classification: MatchClassification,
  t: DbOrTx
): Promise<RatingCalculationResult | null> {
  if (!isRatable(classification)) {
    return null
  }
  const { match, player1, player2, winnerIsPlayer1 } = inputs
  const outcome = ratePair(
    { rating: player1.elo, ratedMatches: inputs.player1RatedMatches },
    { rating: player2.elo, ratedMatches: inputs.player2RatedMatches },
    winnerIsPlayer1 ? 'p1' : 'p2',
    classification
  )
  const side1 = outcome.p1
  const side2 = outcome.p2
  const utr = utrMatchData(match.score, player1, player2)
  const lastMatchAt = match.played_at ?? new Date()

  const write = async (player: RatingPlayer, side: typeof side1, opponent: RatingPlayer, opponentSide: typeof side1, won: boolean, ratedMatches: number) => {
    const totalMatches = player.total_matches_played ?? 0
    const mmrBefore = Number(player.mmr)
    const mmrAfter = eloToMmr(side.after)
    const uncertainty = Number(player.mmr_uncertainty)
    await t
      .update(players)
      .set({
        elo: side.after,
        mmr: mmrAfter,
        placement_matches_completed: Math.min(3, ratedMatches + 1),
        win_streak: won ? Math.min((player.win_streak ?? 0) + 1, totalMatches + 1) : 0,
        loss_streak: won ? 0 : (player.loss_streak ?? 0) + 1,
        last_match_at: lastMatchAt,
        matches_this_month: getUpdatedMatchCount(player.matches_this_month ?? 0, match.played_at) + 1,
        total_matches_played: totalMatches + 1,
      })
      .where(eq(players.id, player.id))

    const isPlayer1 = player.id === player1.id
    await t.insert(rating_history).values({
      player_id: player.id,
      match_id: match.id,
      elo_before: side.before,
      elo_after: side.after,
      elo_change: side.delta,
      mmr_before: mmrBefore,
      mmr_after: mmrAfter,
      mmr_change: mmrAfter - mmrBefore,
      uncertainty_before: uncertainty,
      uncertainty_after: uncertainty,
      k_factor: outcome.k,
      expected_score: side.expected,
      actual_score: won ? 1 : 0,
      is_placement_match: side.isPlacement,
      is_unrated_match: ratedMatches === 0,
      win_streak_bonus: 0,
      opponent_id: opponent.id,
      opponent_elo: opponentSide.before,
      opponent_mmr: Number(opponent.mmr),
      was_winner: won,
      match_rating: utr ? (isPlayer1 ? utr.matchRatingP1 : utr.matchRatingP2) : null,
      match_weight: utr?.matchWeight ?? null,
      games_won: utr ? (isPlayer1 ? utr.gamesWonP1 : utr.gamesLostP1) : null,
      games_lost: utr ? (isPlayer1 ? utr.gamesLostP1 : utr.gamesWonP1) : null,
      total_games: utr?.totalGames ?? null,
      reasoning_preview: JSON.stringify(explanationFor(side, opponentSide, outcome, classification)),
    })
  }

  await write(player1, side1, player2, side2, winnerIsPlayer1, inputs.player1RatedMatches)
  await write(player2, side2, player1, side1, !winnerIsPlayer1, inputs.player2RatedMatches)

  // UTR ratings are derived data; a failure there must not undo the match's ratings.
  if (utr) {
    await updatePlayerUtrRating(player1.id, t)
    await updatePlayerUtrRating(player2.id, t)
  }

  return {
    player1: { eloChange: side1.delta, newElo: side1.after },
    player2: { eloChange: side2.delta, newElo: side2.after },
    k: outcome.k,
    margin: outcome.margin,
    classification,
  }
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
 * matches_this_month after a match played at `matchPlayedAt`: a match from an earlier UTC month resets the count
 * (the same UTC month the decay job closes)
 */
function getUpdatedMatchCount(currentCount: number, matchPlayedAt: Date | null): number {
  if (!matchPlayedAt) {
    return currentCount
  }
  return isInCurrentMonth(matchPlayedAt) ? currentCount : 0
}

function isInCurrentMonth(date: Date): boolean {
  const now = new Date()
  return date.getUTCMonth() === now.getUTCMonth() && date.getUTCFullYear() === now.getUTCFullYear()
}

/**
 * Mark a match's non-reversed rating_history rows as reversed and undo what they applied to each player.
 * Runs in one transaction; pass `tx` to join the caller's. Returns how many rating_history rows were reversed.
 *
 * Per player:
 * - ELO, MMR and uncertainty: when the reversed row is the player's latest live rating and nothing has touched
 *   those values since (no decay, no manual edit), they are restored exactly from its elo_before / mmr_before /
 *   uncertainty_before. Otherwise its deltas are subtracted, with the real bounds only: ELO at least ELO_MIN, MMR
 *   unbounded (it is negative below 2250 ELO), uncertainty inside its 0.5-2.0 CHECK.
 * - total and placement match counts go down by one.
 * - win_streak / loss_streak are rebuilt from the player's remaining live rating_history, and matches_this_month
 *   loses the match if it counted it, so a re-rate that adds the match back does not count it twice.
 */
export async function reverseMatchRatings(matchId: string, tx?: DbOrTx): Promise<number> {
  return (tx ?? useDb()).transaction(async (t) => {
    const live = await t
      .select()
      .from(rating_history)
      .where(and(eq(rating_history.match_id, matchId), eq(rating_history.rating_reversed, false)))

    if (live.length === 0) {
      return 0
    }

    const [match] = await t.select({ played_at: matches.played_at }).from(matches).where(eq(matches.id, matchId))

    // Lock the players (in id order) before reading their latest rating, so none is added meanwhile
    const playerIds = [...new Set(live.map((entry) => entry.player_id))].sort()
    const lockedPlayers = await t
      .select({
        id: players.id,
        elo: players.elo,
        mmr: players.mmr,
        mmr_uncertainty: players.mmr_uncertainty,
        total_matches_played: players.total_matches_played,
        placement_matches_completed: players.placement_matches_completed,
        matches_this_month: players.matches_this_month,
      })
      .from(players)
      .where(inArray(players.id, playerIds))
      .orderBy(asc(players.id))
      .for('update')

    const latestLiveId = new Map<string, string>()
    for (const playerId of playerIds) {
      const [latest] = await t
        .select({ id: rating_history.id })
        .from(rating_history)
        .where(and(eq(rating_history.player_id, playerId), eq(rating_history.rating_reversed, false)))
        .orderBy(desc(rating_history.created_at))
        .limit(1)
      if (latest) latestLiveId.set(playerId, latest.id)
    }

    await t
      .update(rating_history)
      .set({ rating_reversed: true, reversed_at: new Date() })
      .where(inArray(rating_history.id, live.map((entry) => entry.id)))

    for (const playerId of playerIds) {
      const player = lockedPlayers.find((p) => p.id === playerId)
      if (!player) {
        throw new Error(`Failed to fetch player ${playerId}`)
      }

      const entry = live.find((h) => h.player_id === playerId)
      if (!entry) continue

      const untouchedSinceEntry =
        latestLiveId.get(playerId) === entry.id &&
        player.elo === entry.elo_after &&
        Number(player.mmr) === Number(entry.mmr_after) &&
        Number(player.mmr_uncertainty) === Number(entry.uncertainty_after)
      const ratings = untouchedSinceEntry
        ? {
            elo: entry.elo_before,
            mmr: Number(entry.mmr_before),
            mmr_uncertainty: Number(entry.uncertainty_before),
          }
        : {
            elo: Math.max(ELO_MIN, player.elo - entry.elo_change),
            mmr: Number(player.mmr) - Number(entry.mmr_change),
            mmr_uncertainty: Math.min(
              UNCERTAINTY_MAX,
              Math.max(
                UNCERTAINTY_MIN,
                Number(player.mmr_uncertainty) - (Number(entry.uncertainty_after) - Number(entry.uncertainty_before))
              )
            ),
          }

      // Rating added this match to matches_this_month only when it was played this month (or has no date)
      const matchesThisMonth = player.matches_this_month ?? 0
      const countedThisMonth = !match?.played_at || isInCurrentMonth(match.played_at)

      const placementCompleted = player.placement_matches_completed ?? 0
      await t
        .update(players)
        .set({
          ...ratings,
          ...(await liveStreaks(playerId, t)),
          matches_this_month: countedThisMonth ? Math.max(0, matchesThisMonth - 1) : matchesThisMonth,
          total_matches_played: Math.max(0, (player.total_matches_played ?? 0) - 1),
          placement_matches_completed:
            entry.is_placement_match && placementCompleted > 0 ? Math.max(0, placementCompleted - 1) : placementCompleted,
        })
        .where(eq(players.id, playerId))
    }

    return live.length
  })
}

// win_streak / loss_streak as the rating writes them: the run of equal results at the end of the live history
async function liveStreaks(playerId: string, t: DbOrTx): Promise<{ win_streak: number; loss_streak: number }> {
  const results = await t
    .select({ was_winner: rating_history.was_winner })
    .from(rating_history)
    .where(and(eq(rating_history.player_id, playerId), eq(rating_history.rating_reversed, false)))
    .orderBy(desc(rating_history.created_at))
  let run = 0
  while (run < results.length && results[run].was_winner === results[0].was_winner) run++
  const lastWon = results[0]?.was_winner === true
  return { win_streak: lastWon ? run : 0, loss_streak: lastWon ? 0 : run }
}

/**
 * Completed competitive matches with both players and a winner that have no non-reversed rating_history
 * (updateRatingsAfterMatch never ran for them, or failed). Self-matches and results that are never rated
 * (walkovers) are left out. Oldest first.
 */
export async function findMatchesMissingRatingHistory(
  filter: { playerId?: string; matchId?: string; limit?: number }, // no limit = every match
  tx?: DbOrTx
): Promise<Array<{ id: string; score: string | null; created_at: Date | null }>> {
  const db = tx ?? useDb()
  const rows = await db
    .select({ id: matches.id, score: matches.score, created_at: matches.created_at })
    .from(matches)
    .where(
      and(
        eq(matches.status, 'completed'),
        eq(matches.is_competitive, true),
        isNotNull(matches.winner_id),
        isNotNull(matches.player1_id),
        isNotNull(matches.player2_id),
        ne(matches.player1_id, matches.player2_id),
        filter.playerId ? or(eq(matches.player1_id, filter.playerId), eq(matches.player2_id, filter.playerId)) : undefined,
        filter.matchId ? eq(matches.id, filter.matchId) : undefined,
        not(
          exists(
            db
              .select({ id: rating_history.id })
              .from(rating_history)
              .where(and(eq(rating_history.match_id, matches.id), eq(rating_history.rating_reversed, false)))
          )
        )
      )
    )
    .orderBy(asc(matches.created_at))
    .limit(filter.limit ?? Number.MAX_SAFE_INTEGER)
  return rows.filter((m) => isRatable(classifyStoredScore(m.score)))
}

export type MonthlyDecayOutcome = 'decayed' | 'reset' | 'baseline' | 'skipped'

// First day of the current UTC month as YYYY-MM-DD, the same format and zone as last_decay_check.
const currentMonthStart = () => utcMonthStart().toISOString().split('T')[0]

/**
 * Apply the monthly decay to one player, at most once per calendar month (UTC).
 *
 * One transaction locks the player row and re-reads it, so a concurrent run (or a rating update) waits and then
 * finds last_decay_check already in this month. Unrated players, players still in placement and deleted
 * players are never touched. A player never checked before gets this month recorded as the baseline, with no
 * decay: decay starts from the next month. matches_this_month was never reset for such a player, so the
 * baseline recounts it from this month's rating history.
 */
export async function applyMonthlyDecay(
  playerId: string
): Promise<{ outcome: MonthlyDecayOutcome; decayApplied: number; uncertaintyIncrease: number }> {
  const none = (outcome: MonthlyDecayOutcome) => ({ outcome, decayApplied: 0, uncertaintyIncrease: 0 })

  return useDb().transaction(async (tx) => {
    const [player] = await tx
      .select({
        elo: players.elo,
        mmr_uncertainty: players.mmr_uncertainty,
        matches_this_month: players.matches_this_month,
        last_decay_check: players.last_decay_check,
        total_matches_played: players.total_matches_played,
        placement_matches_completed: players.placement_matches_completed,
        created_at: players.created_at,
      })
      .from(players)
      .where(and(eq(players.id, playerId), eq(players.status, 'active'), isNull(players.deleted_at)))
      .for('update')

    if (!player || (player.total_matches_played ?? 0) === 0 || (player.placement_matches_completed ?? 0) < 3) {
      return none('skipped')
    }

    const today = new Date().toISOString().split('T')[0]
    const monthStart = currentMonthStart()

    if (!player.last_decay_check) {
      const [{ n }] = await tx
        .select({ n: count() })
        .from(rating_history)
        .innerJoin(matches, eq(matches.id, rating_history.match_id))
        .where(
          and(
            eq(rating_history.player_id, playerId),
            sql`${rating_history.rating_reversed} is not true`,
            gte(sql`coalesce(${matches.played_at}, ${rating_history.created_at})`, new Date(`${monthStart}T00:00:00Z`))
          )
        )
      await tx.update(players).set({ last_decay_check: today, matches_this_month: n }).where(eq(players.id, playerId))
      return none('baseline')
    }

    if (player.last_decay_check >= monthStart) {
      return none('skipped')
    }

    // Closing the previous month: its requirement, not this month's.
    const matchesRequired = calculateRequiredMatchesForMonth(player.created_at, utcMonthStart(-1))
    const matchesThisMonth = player.matches_this_month ?? 0
    const decayAmount = calculateDecayAmount(matchesThisMonth, matchesRequired)
    const uncertaintyIncrease = (matchesRequired - Math.min(matchesThisMonth, matchesRequired)) * 0.1

    if (decayAmount === 0 && uncertaintyIncrease === 0) {
      await tx.update(players).set({ last_decay_check: today, matches_this_month: 0 }).where(eq(players.id, playerId))
      return none('reset')
    }

    await tx
      .update(players)
      .set({
        elo: applyDecay(player.elo, decayAmount),
        mmr_uncertainty: Math.min(UNCERTAINTY_MAX, Number(player.mmr_uncertainty) + uncertaintyIncrease),
        last_decay_check: today,
        matches_this_month: 0,
      })
      .where(eq(players.id, playerId))

    return { outcome: 'decayed' as const, decayApplied: decayAmount, uncertaintyIncrease }
  })
}

/**
 * The scheduled monthly decay: every rated, active player not yet checked this month, one transaction each.
 * Safe to run any number of times; a run cut short is finished by the next one.
 */
export async function applyMonthlyDecayToAllPlayers(): Promise<Record<MonthlyDecayOutcome | 'failed', number>> {
  const monthStart = currentMonthStart()
  const due = await useDb()
    .select({ id: players.id })
    .from(players)
    .where(
      and(
        eq(players.status, 'active'),
        isNull(players.deleted_at),
        gt(players.total_matches_played, 0),
        gte(players.placement_matches_completed, 3),
        or(isNull(players.last_decay_check), lt(players.last_decay_check, monthStart))
      )
    )
    .orderBy(asc(players.id))

  const counts: Record<MonthlyDecayOutcome | 'failed', number> = { decayed: 0, reset: 0, baseline: 0, skipped: 0, failed: 0 }
  for (const { id } of due) {
    try {
      counts[(await applyMonthlyDecay(id)).outcome]++
    } catch (error) {
      counts.failed++
      console.error('Monthly decay failed for player', id, error)
    }
  }
  return counts
}

/**
 * Validate rating consistency for a player
 * Recalculates expected rating from history and compares
 */
export async function validateRatingConsistency(
  playerId: string,
  tx?: DbOrTx
): Promise<{ isConsistent: boolean; expectedElo: number; actualElo: number }> {
  const db = tx ?? useDb()
  const [player] = await db
    .select({ elo: players.elo, default_elo: categories.default_elo })
    .from(players)
    .leftJoin(categories, eq(players.category_id, categories.id))
    .where(eq(players.id, playerId))

  if (!player) {
    return { isConsistent: false, expectedElo: 0, actualElo: 0 }
  }

  const history = await db
    .select({ elo_change: rating_history.elo_change })
    .from(rating_history)
    .where(and(eq(rating_history.player_id, playerId), eq(rating_history.rating_reversed, false)))
    .orderBy(asc(rating_history.created_at))

  // Expected ELO: the category default plus every non-reversed change
  let expectedElo = player.default_elo ?? 1000
  for (const entry of history) {
    expectedElo += entry.elo_change
  }

  expectedElo = Math.max(ELO_MIN, expectedElo)

  return {
    isConsistent: Math.abs(expectedElo - player.elo) <= 1, // Allow for rounding
    expectedElo,
    actualElo: player.elo,
  }
}
