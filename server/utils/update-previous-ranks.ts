import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import { useDb, type DbOrTx } from '~/server/db'
import { players } from '~/server/db/schema'

/**
 * Utility function to update previous_rank for all players
 * This should be called periodically (e.g., daily) to track rank changes
 *
 * @param tx - optional db/transaction handle, so a caller can run this inside its own transaction
 * @returns Number of players updated
 */
export async function updatePreviousRanks(tx?: DbOrTx): Promise<number> {
  const db = tx ?? useDb()
  try {
    // Get all active players ordered by ELO (current ranking) - same population as the leaderboard.
    const rows = await db.query.players.findMany({
      where: and(eq(players.status, 'active'), isNull(players.deleted_at)),
      orderBy: [desc(players.elo), asc(players.id)],
      columns: { id: true, elo: true },
    })

    if (!rows || rows.length === 0) {
      return 0
    }

    // Calculate current rank for each player
    // Players are already sorted by ELO descending, so rank = index + 1
    const updates = rows.map((player, index) => ({
      id: player.id,
      previous_rank: index + 1,
    }))

    // Update all players in batches to avoid overwhelming the database
    const batchSize = 100
    let updatedCount = 0

    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize)

      // Use Promise.all to update batch in parallel
      const results = await Promise.all(
        batch.map(async (update) => {
          try {
            await db.update(players).set({ previous_rank: update.previous_rank }).where(eq(players.id, update.id))
            return true
          } catch (error) {
            console.error(`Error updating previous_rank for player ${update.id}:`, error)
            return false
          }
        }),
      )

      updatedCount += results.filter((r) => r === true).length
    }

    return updatedCount
  } catch (error: any) {
    console.error('Error updating previous ranks:', error)
    throw error
  }
}
