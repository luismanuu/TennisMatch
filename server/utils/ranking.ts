import { and, asc, count, desc, eq, gt, gte, isNull, lt, lte, or, sql, type SQL } from 'drizzle-orm'
import { categories, cities, players } from '../db/schema'
import type { DbOrTx } from '../db'
import { getNextTierProgress, getRatingTier } from './rating-system'
import type { LeaderboardPlayer } from '~/types/leaderboard'

/**
 * The one definition of a player's rank, used by every page and route (leaderboard, top, nearby, rankings,
 * ranking-position and the previous_rank snapshot behind the arrows):
 *
 *   ranked players = active, not deleted, at least one rated match
 *   rank           = 1 + number of ranked players with a strictly higher SR   (ties share a rank: 1, 2, 2, 4)
 *
 * A player with no rated match has no rank: a seed is chosen at sign-up, not earned. Filters (tier, city, search,
 * a window around the viewer) choose which rows are shown; they never renumber them. Lists are ordered by SR, then
 * id, so pages partition a list the same way on every request; `position` is the row's place in that filtered list.
 */
export const rankedPlayers: SQL = and(eq(players.status, 'active'), isNull(players.deleted_at), gte(players.total_matches_played, 1))!

export async function rankOf(db: DbOrTx, elo: number, scope?: SQL): Promise<number> {
  const [{ n }] = await db
    .select({ n: count() })
    .from(players)
    .where(and(rankedPlayers, scope, gt(players.elo, elo)))
  return n + 1
}

export async function rankedCount(db: DbOrTx, scope?: SQL): Promise<number> {
  const [{ n }] = await db.select({ n: count() }).from(players).where(and(rankedPlayers, scope))
  return n
}

export function eloBetween(minElo: number, maxElo: number): SQL {
  return and(gte(players.elo, minElo), Number.isFinite(maxElo) ? lte(players.elo, maxElo) : undefined)!
}

/** Rows ordered before a player with this SR and id in a list (SR desc, id asc). */
export function orderedBefore(elo: number, id: string): SQL {
  return or(gt(players.elo, elo), and(eq(players.elo, elo), lt(players.id, id)))!
}

/**
 * Ranked players matching `filter`, in list order, each with its global rank. `offset` is 0-based in the filtered
 * list; the returned `position` is 1-based.
 */
export async function rankedRows(
  db: DbOrTx,
  { filter, limit, offset = 0, viewerId }: { filter?: SQL; limit: number; offset?: number; viewerId?: string },
): Promise<LeaderboardPlayer[]> {
  const ranked = db.$with('ranked').as(
    db
      .select({ id: players.id, rank: sql<number>`cast(rank() over (order by ${players.elo} desc) as integer)`.as('rank') })
      .from(players)
      .where(rankedPlayers),
  )
  const rows = await db
    .with(ranked)
    .select({
      id: players.id,
      name: players.name,
      elo: players.elo,
      total_matches_played: players.total_matches_played,
      placement_matches_completed: players.placement_matches_completed,
      win_streak: players.win_streak,
      loss_streak: players.loss_streak,
      previous_rank: players.previous_rank,
      rank: ranked.rank,
      city_id: cities.id,
      city_name: cities.name,
      category_id: categories.id,
      category_name: categories.name,
    })
    .from(players)
    .innerJoin(ranked, eq(ranked.id, players.id))
    .leftJoin(cities, eq(cities.id, players.city_id))
    .leftJoin(categories, eq(categories.id, players.category_id))
    .where(filter)
    .orderBy(desc(players.elo), asc(players.id))
    .limit(limit)
    .offset(offset)

  return rows.map((row, i) => {
    const progress = getNextTierProgress(row.elo)
    const nearPromotion = !progress.isMaxTier && progress.eloNeeded <= 100
    return {
      id: row.id,
      name: row.name,
      elo: row.elo,
      rank: row.rank,
      position: offset + i + 1,
      previous_rank: row.previous_rank ?? undefined,
      rank_change: row.previous_rank != null ? row.previous_rank - row.rank : undefined,
      rating_tier: getRatingTier(row.elo).tier,
      total_matches_played: row.total_matches_played ?? 0,
      win_streak: row.win_streak ?? 0,
      loss_streak: row.loss_streak ?? 0,
      placement_matches_completed: row.placement_matches_completed ?? 0,
      city: row.city_id ? ({ id: row.city_id, name: row.city_name } as LeaderboardPlayer['city']) : undefined,
      category: row.category_id ? ({ id: row.category_id, name: row.category_name } as LeaderboardPlayer['category']) : undefined,
      badges: [],
      is_current_user: viewerId ? row.id === viewerId : false,
      near_promotion: nearPromotion,
      next_tier: nearPromotion ? progress.nextTier?.tier ?? null : null,
    }
  })
}
