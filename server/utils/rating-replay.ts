import { and, asc, eq, inArray, isNotNull, ne, sql } from 'drizzle-orm'
import type { DbOrTx } from '../db'
import { matches, players, rating_history } from '../db/schema'
import {
  classifyStoredScore,
  explanationFor,
  parseExplanation,
  replayRatings,
  sortForReplay,
  type ReplayMatch,
  type ReplayResult,
} from './elo'
import { eloToMmr } from './rating-system'

/**
 * Recompute every SR from the confirmed matches, in order, with the current formula (scripts/recompute-ratings.ts).
 *
 * Seeds: each player's rating before their first rated match in replay order (elo_before of that live row). Players
 * with no live rating are not touched. Matches: completed, competitive, two different players and a winner, ordered by played_at
 * (created_at when missing), then id. Each match keeps the classification stored with its current rating (so an
 * explicit walkover stays one); otherwise its score is parsed.
 *
 * Not replayed: monthly decay (it is not recorded per match), so a decayed player's replayed SR does not include it.
 */
export interface ReplayPlan {
  input: { seeds: Map<string, number>; matches: ReplayMatch[] }
  result: ReplayResult
  current: Map<string, { name: string; elo: number; total: number }>
  unparsedScores: Array<{ matchId: string; score: string | null }>
  /** Live ratings of matches the replay does not rewrite (no longer completed or competitive): applying refuses */
  orphanRatings: Array<{ matchId: string; playerId: string }>
}

export async function planReplay(db: DbOrTx): Promise<ReplayPlan> {
  const live = await db
    .select({
      player_id: rating_history.player_id,
      match_id: rating_history.match_id,
      elo_before: rating_history.elo_before,
      created_at: rating_history.created_at,
      reasoning_preview: rating_history.reasoning_preview,
    })
    .from(rating_history)
    .where(eq(rating_history.rating_reversed, false))
    .orderBy(asc(rating_history.created_at), asc(rating_history.id))

  const storedClassification = new Map<string, ReplayMatch['classification']>()
  const liveBefore = new Map<string, number>()
  for (const row of live) {
    liveBefore.set(`${row.match_id}:${row.player_id}`, row.elo_before)
    const stored = parseExplanation(row.reasoning_preview)?.classification
    if (stored && !storedClassification.has(row.match_id)) storedClassification.set(row.match_id, stored)
  }

  const completed = await db
    .select({
      id: matches.id,
      player1_id: matches.player1_id,
      player2_id: matches.player2_id,
      winner_id: matches.winner_id,
      score: matches.score,
      played_at: matches.played_at,
      created_at: matches.created_at,
    })
    .from(matches)
    .where(
      and(
        eq(matches.status, 'completed'),
        eq(matches.is_competitive, true),
        isNotNull(matches.winner_id),
        isNotNull(matches.player1_id),
        isNotNull(matches.player2_id),
        ne(matches.player1_id, matches.player2_id),
      ),
    )

  const unparsedScores: ReplayPlan['unparsedScores'] = []
  const replayMatches: ReplayMatch[] = []
  for (const m of completed) {
    if (m.winner_id !== m.player1_id && m.winner_id !== m.player2_id) continue
    const classification = storedClassification.get(m.id) ?? classifyStoredScore(m.score)
    if (classification.sets === 'unknown') unparsedScores.push({ matchId: m.id, score: m.score })
    replayMatches.push({
      id: m.id,
      player1: m.player1_id!,
      player2: m.player2_id!,
      winner: m.winner_id!,
      at: (m.played_at ?? m.created_at ?? new Date(0)).getTime(),
      classification,
    })
  }

  const seeds = new Map<string, number>()
  for (const m of sortForReplay(replayMatches)) {
    for (const playerId of [m.player1, m.player2]) {
      const before = liveBefore.get(`${m.id}:${playerId}`)
      if (!seeds.has(playerId) && before !== undefined) seeds.set(playerId, before)
    }
  }

  const replayed = new Set(replayMatches.map((m) => m.id))
  const orphanRatings = live.filter((r) => !replayed.has(r.match_id)).map((r) => ({ matchId: r.match_id, playerId: r.player_id }))

  const ids = [...seeds.keys()]
  const rows = ids.length
    ? await db
        .select({ id: players.id, name: players.name, elo: players.elo, total: players.total_matches_played })
        .from(players)
        .where(inArray(players.id, ids))
    : []
  const current = new Map(rows.map((p) => [p.id, { name: p.name, elo: p.elo, total: p.total ?? 0 }]))

  return { input: { seeds, matches: replayMatches }, result: replayRatings(seeds, replayMatches), current, unparsedScores, orphanRatings }
}

/** scripts/recompute-ratings.ts: writing needs both --apply and --i-understand; anything else is a dry run. */
export function replayApplyMode(argv: readonly string[]): 'dry-run' | 'apply' | 'refuse' {
  if (!argv.includes('--apply')) return 'dry-run'
  return argv.includes('--i-understand') ? 'apply' : 'refuse'
}

/**
 * Write a replay: every live rating is reversed and replaced by the replayed one, and each replayed player's SR,
 * match count, placement count, streaks and matches_this_month are set from the replay. One transaction; UTR match
 * data is carried over from the rating it replaces. Returns how many rating rows were written.
 *
 * Refuses (throws, nothing written) when a live rating belongs to a match the replay does not rewrite, e.g. a rated
 * match later turned into a friendly: reversing it without replaying it would change that player's SR silently.
 */
export async function applyReplay(db: DbOrTx): Promise<number> {
  return db.transaction(async (t) => {
    // Lock order matches an approval (players in id order, then rating_history), so the two cannot deadlock. Every
    // player row is locked because the plan is not known yet; then no approval can add or reverse a rating
    // between the plan and the write.
    await t.select({ id: players.id }).from(players).orderBy(asc(players.id)).for('update')
    await t.execute(sql`lock table rating_history in exclusive mode`)
    const plan = await planReplay(t)
    if (plan.orphanRatings.length > 0) {
      throw new Error(
        `${plan.orphanRatings.length} live rating rows belong to matches outside the replay (no longer completed or ` +
          `competitive); reverse them first: ${[...new Set(plan.orphanRatings.map((r) => r.matchId))].join(', ')}`
      )
    }
    const ids = [...plan.input.seeds.keys()].sort()
    if (ids.length === 0) return 0

    const previous = await t
      .select()
      .from(rating_history)
      .where(eq(rating_history.rating_reversed, false))
    const previousOf = new Map(previous.map((r) => [`${r.match_id}:${r.player_id}`, r]))
    await t.update(rating_history).set({ rating_reversed: true, reversed_at: new Date() }).where(eq(rating_history.rating_reversed, false))

    // Rows get increasing created_at in replay order: "latest rating" (reversal, streaks) is read by created_at
    const start = Date.now() - 2 * plan.result.rows.length
    const played = new Map<string, number>()
    const thisMonth = new Map<string, number>()
    const now = new Date()
    const matchAt = new Map(plan.input.matches.map((m) => [m.id, new Date(m.at)]))
    const streak = new Map<string, { win: number; loss: number }>()
    let written = 0
    for (const row of plan.result.rows) {
      for (const [playerId, side, opponentSide, won] of [
        [row.winner, row.outcome.winner, row.outcome.loser, true],
        [row.loser, row.outcome.loser, row.outcome.winner, false],
      ] as const) {
        const carried = previousOf.get(`${row.matchId}:${playerId}`)
        const opponentId = won ? row.loser : row.winner
        await t.insert(rating_history).values({
          player_id: playerId,
          match_id: row.matchId,
          elo_before: side.before,
          elo_after: side.after,
          elo_change: side.delta,
          mmr_before: eloToMmr(side.before),
          mmr_after: eloToMmr(side.after),
          mmr_change: eloToMmr(side.after) - eloToMmr(side.before),
          uncertainty_before: carried?.uncertainty_before ?? 2,
          uncertainty_after: carried?.uncertainty_after ?? 2,
          k_factor: row.outcome.k,
          expected_score: side.expected,
          actual_score: won ? 1 : 0,
          is_placement_match: side.isPlacement,
          is_unrated_match: (played.get(playerId) ?? 0) === 0,
          win_streak_bonus: 0,
          opponent_id: opponentId,
          opponent_elo: opponentSide.before,
          opponent_mmr: eloToMmr(opponentSide.before),
          was_winner: won,
          match_rating: carried?.match_rating ?? null,
          match_weight: carried?.match_weight ?? null,
          games_won: carried?.games_won ?? null,
          games_lost: carried?.games_lost ?? null,
          total_games: carried?.total_games ?? null,
          reasoning_preview: JSON.stringify(explanationFor(side, opponentSide, row.outcome, row.classification)),
          created_at: new Date(start + written),
        })
        played.set(playerId, (played.get(playerId) ?? 0) + 1)
        const at = matchAt.get(row.matchId)!
        if (at.getUTCFullYear() === now.getUTCFullYear() && at.getUTCMonth() === now.getUTCMonth()) {
          thisMonth.set(playerId, (thisMonth.get(playerId) ?? 0) + 1)
        }
        const s = streak.get(playerId) ?? { win: 0, loss: 0 }
        streak.set(playerId, won ? { win: s.win + 1, loss: 0 } : { win: 0, loss: s.loss + 1 })
        written++
      }
    }

    for (const id of ids) {
      const elo = plan.result.ratings.get(id)!
      const count = plan.result.ratedMatches.get(id) ?? 0
      const s = streak.get(id) ?? { win: 0, loss: 0 }
      await t
        .update(players)
        .set({
          elo,
          mmr: eloToMmr(elo),
          total_matches_played: count,
          placement_matches_completed: Math.min(3, count),
          win_streak: s.win,
          loss_streak: s.loss,
          matches_this_month: thisMonth.get(id) ?? 0,
        })
        .where(eq(players.id, id))
    }
    return written
  })
}
