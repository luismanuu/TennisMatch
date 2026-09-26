import { eq, sql } from 'drizzle-orm'
import { useDb, type DbOrTx } from '~/server/db'
import { players } from '~/server/db/schema'
import { rankedPlayers } from '~/server/utils/ranking'

/**
 * Snapshot every ranked player's current rank (server/utils/ranking.ts) into previous_rank, so the arrows compare
 * the same definition later. Players without a rank get null. One statement, so the snapshot is consistent.
 *
 * @param tx - optional db/transaction handle, so a caller can run this inside its own transaction
 * @returns Number of ranked players snapshotted
 */
export async function updatePreviousRanks(tx?: DbOrTx): Promise<number> {
  const db = tx ?? useDb()
  const ranked = db.$with('ranked').as(
    db
      .select({ id: players.id, rank: sql<number>`cast(rank() over (order by ${players.elo} desc) as integer)`.as('rank') })
      .from(players)
      .where(rankedPlayers),
  )
  const updated = await db
    .with(ranked)
    .update(players)
    .set({ previous_rank: sql`${ranked.rank}` })
    .from(ranked)
    .where(eq(players.id, ranked.id))
    .returning({ id: players.id })
  await db.update(players).set({ previous_rank: null }).where(sql`not coalesce(${rankedPlayers}, false)`)
  return updated.length
}
