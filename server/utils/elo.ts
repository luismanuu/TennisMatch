import { parseScore, type Completion, type ParsedScore } from '../../utils/score'

/**
 * The SR formula. Pure and deterministic: no I/O, no clock, no randomness, no model. Same inputs, same output, so any
 * rating can be replayed from the stored inputs.
 *
 * Standard Elo on the 400-point scale:
 *   expected(winner) = 1 / (1 + 10^((loser - winner) / 400))
 *   gain = round(K * margin * (1 - expected(winner)))     winner +gain, loser -gain
 *
 * One K per match: the mean of both players' experience K. Using each player's own K would make a newcomer's win over
 * a veteran create or destroy points (the old system did: +30/-12), and the pool would drift. With one K the match is
 * exactly zero-sum; a newcomer still moves faster than two veterans do, and a veteran who meets a newcomer risks a
 * little more than against another veteran, never the full placement swing.
 *
 * K by experience (rated matches played before this one):
 * - Placement, the first 3 matches: K = 60. Seeds come from a self-chosen category, 250 SR apart, so the first
 *   matches must be able to move a player a good part of a category. 60 is what unrated players already had.
 * - After placement: K = 32, the usual value for club-level Elo on this scale. An even match is worth about 16; the
 *   largest possible single swing (two placement players, straight sets, huge upset) is round(60 * 1.1) = 66.
 * The placement count stays 3: players.placement_matches_completed has a CHECK between 0 and 3, the landing and the
 * ranking explainer say three, and decay exempts players in placement.
 *
 * Margin (bounded, applies to both players, so the match stays zero-sum):
 * - straight sets 1.10, a deciding third set 0.90, a retirement 0.90 (less evidence than a finished match), a
 *   completed score that could not be parsed (older free-text results) 1.00.
 * - a single pro set 0.90, like a deciding set: it is one short set (12-17 games against 18 or more in two sets), so
 *   it shows less of a gap than winning two sets, and one break decides it the way a third set does.
 * - walkover and abandoned: not rated at all (factor 0). A walkover says nothing about playing level and would
 *   reward a no-show; an abandoned match has no winner.
 *
 * The classification (completion + how many sets) is the seam for fuzzy inputs: today it comes from the score parser
 * or from an explicit form choice; a later model step may propose it for text the parser cannot read, never the
 * number itself. It is stored with its source so a replay reproduces the same rating.
 */

export const ELO_FORMULA_VERSION = 'elo-v2'
export const ELO_SCALE = 400
export const PLACEMENT_MATCHES = 3
export const K_PLACEMENT = 60
export const K_ESTABLISHED = 32
export const RATING_FLOOR = 1

export type SetsShape = 'straight' | 'deciding' | 'pro' | 'incomplete' | 'none' | 'unknown'
export type ClassificationSource = 'manual' | 'parser' | 'jev'

export interface MatchClassification {
  completion: Completion
  sets: SetsShape
  source: ClassificationSource
}

export const MARGIN_FACTORS: Record<Completion, Partial<Record<SetsShape, number>> & { default: number }> = {
  completed: { straight: 1.1, deciding: 0.9, pro: 0.9, unknown: 1, default: 1 },
  retired: { default: 0.9 },
  walkover: { default: 0 },
  abandoned: { default: 0 },
}
export const MAX_MARGIN_FACTOR = 1.1

export function marginFactor(c: Pick<MatchClassification, 'completion' | 'sets'>): number {
  const table = MARGIN_FACTORS[c.completion]
  return table[c.sets] ?? table.default
}

export function isRatable(c: Pick<MatchClassification, 'completion' | 'sets'>): boolean {
  return marginFactor(c) > 0
}

export function classifyScore(score: ParsedScore, source: ClassificationSource): MatchClassification {
  if (score.completion !== 'completed') {
    return { completion: score.completion, sets: score.sets.length === 0 ? 'none' : 'incomplete', source }
  }
  const sets: SetsShape = score.sets.length === 1 ? 'pro' : score.sets.length === 2 ? 'straight' : 'deciding'
  return { completion: 'completed', sets, source }
}

/**
 * The classification of a stored score. Text the parser cannot read (results stored before scores were validated)
 * counts as a completed match of unknown shape, so it still rates at factor 1 instead of blocking the match.
 */
export function classifyStoredScore(text: string | null | undefined): MatchClassification {
  const parsed = parseScore(text)
  if (parsed.ok) return classifyScore(parsed.score, 'parser')
  return { completion: 'completed', sets: 'unknown', source: 'parser' }
}

export function experienceK(ratedMatchesBefore: number): number {
  return ratedMatchesBefore < PLACEMENT_MATCHES ? K_PLACEMENT : K_ESTABLISHED
}

export function expectedScore(rating: number, opponent: number): number {
  return 1 / (1 + Math.pow(10, (opponent - rating) / ELO_SCALE))
}

export interface EloPlayer {
  rating: number
  /** Rated matches this player had before this one */
  ratedMatches: number
}

export interface EloSide {
  before: number
  after: number
  delta: number
  expected: number
  isPlacement: boolean
}

export interface EloOutcome {
  ratable: boolean
  k: number
  margin: number
  winner: EloSide
  loser: EloSide
}

export function rateMatch(winner: EloPlayer, loser: EloPlayer, classification: MatchClassification): EloOutcome {
  const k = Math.round((experienceK(winner.ratedMatches) + experienceK(loser.ratedMatches)) / 2)
  const margin = marginFactor(classification)
  const expectedWinner = expectedScore(winner.rating, loser.rating)
  const raw = Math.round(k * margin * (1 - expectedWinner))
  const gain = Math.max(0, Math.min(raw, loser.rating - RATING_FLOOR))
  const side = (p: EloPlayer, delta: number, expected: number): EloSide => ({
    before: p.rating,
    after: p.rating + delta,
    delta,
    expected,
    isPlacement: p.ratedMatches < PLACEMENT_MATCHES,
  })
  return {
    ratable: margin > 0,
    k,
    margin,
    winner: side(winner, gain, expectedWinner),
    loser: side(loser, gain === 0 ? 0 : -gain, 1 - expectedWinner),
  }
}

/** rateMatch from the match's side: player 1 and player 2 instead of winner and loser. */
export function ratePair(
  player1: EloPlayer,
  player2: EloPlayer,
  winner: 'p1' | 'p2',
  classification: MatchClassification,
): { k: number; margin: number; ratable: boolean; p1: EloSide; p2: EloSide; outcome: EloOutcome } {
  const outcome = winner === 'p1' ? rateMatch(player1, player2, classification) : rateMatch(player2, player1, classification)
  const [p1, p2] = winner === 'p1' ? [outcome.winner, outcome.loser] : [outcome.loser, outcome.winner]
  return { k: outcome.k, margin: outcome.margin, ratable: outcome.ratable, p1, p2, outcome }
}

/** What a player sees under "¿Por qué?": stored with the rating, one per player and match. */
export interface RatingExplanation {
  formula: typeof ELO_FORMULA_VERSION
  k: number
  margin: number
  expected: number
  opponent_before: number
  classification: MatchClassification
}

export function explanationFor(side: EloSide, opponent: EloSide, outcome: Pick<EloOutcome, 'k' | 'margin'>, classification: MatchClassification): RatingExplanation {
  return {
    formula: ELO_FORMULA_VERSION,
    k: outcome.k,
    margin: outcome.margin,
    expected: Math.round(side.expected * 1000) / 1000,
    opponent_before: opponent.before,
    classification,
  }
}

export function parseExplanation(text: string | null | undefined): RatingExplanation | null {
  if (!text || !text.startsWith('{')) return null
  try {
    const value = JSON.parse(text) as RatingExplanation
    return value.formula === ELO_FORMULA_VERSION ? value : null
  } catch {
    return null
  }
}


// ============================================
// REPLAY (pure): every confirmed match, in order, through the formula
// ============================================

export interface ReplayMatch {
  id: string
  player1: string
  player2: string
  winner: string
  /** played_at (or created_at) in ms; ties are broken by id so the order never depends on how rows were read */
  at: number
  classification: MatchClassification
}

export interface ReplayRow {
  matchId: string
  winner: string
  loser: string
  outcome: EloOutcome
  classification: MatchClassification
}

export interface ReplayResult {
  ratings: Map<string, number>
  ratedMatches: Map<string, number>
  rows: ReplayRow[]
}

export function sortForReplay<T extends Pick<ReplayMatch, 'at' | 'id'>>(matches: readonly T[]): T[] {
  return [...matches].sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/** `seeds`: each player's rating before their first match. Players without a seed are skipped with their matches. */
export function replayRatings(seeds: ReadonlyMap<string, number>, matches: readonly ReplayMatch[]): ReplayResult {
  const ratings = new Map(seeds)
  const ratedMatches = new Map<string, number>()
  const rows: ReplayRow[] = []
  for (const m of sortForReplay(matches)) {
    const loserId = m.winner === m.player1 ? m.player2 : m.player1
    const winnerRating = ratings.get(m.winner)
    const loserRating = ratings.get(loserId)
    if (winnerRating === undefined || loserRating === undefined || m.player1 === m.player2) continue
    if (!isRatable(m.classification)) continue
    const outcome = rateMatch(
      { rating: winnerRating, ratedMatches: ratedMatches.get(m.winner) ?? 0 },
      { rating: loserRating, ratedMatches: ratedMatches.get(loserId) ?? 0 },
      m.classification,
    )
    ratings.set(m.winner, outcome.winner.after)
    ratings.set(loserId, outcome.loser.after)
    ratedMatches.set(m.winner, (ratedMatches.get(m.winner) ?? 0) + 1)
    ratedMatches.set(loserId, (ratedMatches.get(loserId) ?? 0) + 1)
    rows.push({ matchId: m.id, winner: m.winner, loser: loserId, outcome, classification: m.classification })
  }
  return { ratings, ratedMatches, rows }
}
