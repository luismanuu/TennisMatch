import { and, asc, count, desc, eq, isNull, lt, or } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { players, rating_history } from '~/server/db/schema'
import { requireAdmin } from '~/server/utils/session'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const query = getQuery(event)

    // Pagination parameters
    const limit = Math.min(query.limit ? parseInt(query.limit as string) : 50, 500)
    const offset = query.offset ? parseInt(query.offset as string) : 0

    const db = useDb()
    const where = and(
      eq(players.status, 'active'),
      isNull(players.deleted_at),
      or(eq(players.total_matches_played, 0), lt(players.placement_matches_completed, 3)),
    )!

    // Get total count
    const [{ n: totalCount }] = await db.select({ n: count() }).from(players).where(where)

    // Get all players in placement matches
    const rows = await db.query.players.findMany({
      where,
      orderBy: [desc(players.created_at)],
      limit,
      offset,
      columns: { id: true, name: true, elo: true, total_matches_played: true, placement_matches_completed: true, created_at: true },
      with: {
        category: { columns: { id: true, name: true } },
        city: { columns: { id: true, name: true } },
      },
    })

    // Get placement match history for each player
    const playersWithHistory = await Promise.all(
      (rows || []).map(async (player) => {
        const isInPlacement = (player.total_matches_played || 0) === 0 || (player.placement_matches_completed || 0) < 3
        const placementMatchesRemaining = Math.max(0, 3 - (player.placement_matches_completed || 0))

        // Get rating history for placement matches
        const placementHistory = await db.query.rating_history.findMany({
          where: and(eq(rating_history.player_id, player.id), eq(rating_history.is_placement_match, true)),
          orderBy: [asc(rating_history.created_at)],
          columns: {
            id: true,
            match_id: true,
            elo_before: true,
            elo_after: true,
            elo_change: true,
            created_at: true,
            is_placement_match: true,
            was_winner: true,
            opponent_id: true,
          },
          with: {
            match: { columns: { id: true, player1_id: true, player2_id: true, winner_id: true, score: true, played_at: true } },
          },
        })

        return {
          id: player.id,
          name: player.name,
          elo: player.elo || 0,
          total_matches_played: player.total_matches_played || 0,
          placement_matches_completed: player.placement_matches_completed || 0,
          placement_matches_remaining: placementMatchesRemaining,
          is_in_placement: isInPlacement,
          created_at: player.created_at,
          category: player.category,
          city: player.city,
          placement_history: placementHistory || [],
        }
      }),
    )

    // Calculate statistics (based on all players, not just current page)
    // We need to fetch all for stats, but this is expensive. For now, calculate from current page.
    // In production, you might want to cache these stats or calculate them separately.
    const stats = {
      total_in_placement: totalCount || 0,
      completed_0: playersWithHistory.filter((p) => p.placement_matches_completed === 0).length,
      completed_1: playersWithHistory.filter((p) => p.placement_matches_completed === 1).length,
      completed_2: playersWithHistory.filter((p) => p.placement_matches_completed === 2).length,
      average_elo:
        playersWithHistory.length > 0 ? Math.round(playersWithHistory.reduce((sum, p) => sum + p.elo, 0) / playersWithHistory.length) : 0,
    }

    return {
      success: true,
      players: playersWithHistory,
      statistics: stats,
      total: totalCount || 0,
      page: Math.floor(offset / limit) + 1,
      page_size: limit,
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Internal server error',
      data: error.data || error,
    })
  }
})
