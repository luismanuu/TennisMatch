import { and, eq, inArray } from 'drizzle-orm'
import { useDb, type DbOrTx } from '../db'
import { notifications } from '../db/schema'

/**
 * Notification types for match-related events
 */
export type NotificationType =
  | 'match_proposal'      // Match proposed, needs acceptance
  | 'match_created'       // Match confirmed/created (e.g., tournament)
  | 'score_proposal'      // Score proposed, needs approval
  | 'schedule_proposal'   // Schedule proposed, needs approval
  | 'reschedule_proposal' // Reschedule requested
  | 'acceptance_change'   // Acceptance with schedule change

// Notifications are non-critical. Inside a caller's transaction they run in a savepoint, so a failed
// notification is rolled back on its own instead of aborting the caller's transaction.
function isolated<T>(tx: DbOrTx | undefined, work: (db: DbOrTx) => Promise<T>): Promise<T> {
  return tx ? tx.transaction(work) : work(useDb())
}

/**
 * Create a notification for a player about a match event.
 * Non-critical operation - logs errors but doesn't throw.
 * An existing, non-dismissed notification of the same type for the match is returned instead of a duplicate.
 */
export async function createMatchNotification(
  playerId: string,
  matchId: string,
  type: NotificationType,
  metadata?: Record<string, unknown>,
  tx?: DbOrTx
) {
  try {
    return await isolated(tx, async (db) => {
      const live = and(
        eq(notifications.player_id, playerId),
        eq(notifications.match_id, matchId),
        eq(notifications.type, type),
        eq(notifications.is_dismissed, false)
      )

      const existing = await db.query.notifications.findFirst({
        columns: { id: true, is_dismissed: true },
        where: live,
      })
      if (existing) {
        return existing
      }

      // The partial unique index (player, type, match) where not dismissed makes a concurrent duplicate a no-op
      const [created] = await db
        .insert(notifications)
        .values({ player_id: playerId, type, match_id: matchId, metadata: metadata || {} })
        .onConflictDoNothing()
        .returning()
      if (created) {
        return created
      }

      const raced = await db.query.notifications.findFirst({ where: live })
      if (!raced) {
        console.warn(`[Notifications] Duplicate key error but couldn't find existing notification for player ${playerId}, match ${matchId}, type ${type}`)
      }
      return raced ?? null
    })
  } catch (err) {
    console.error(`[Notifications] Failed to create ${type} notification:`, err)
    return null
  }
}

/**
 * Auto-dismiss related notifications when player takes action
 * For example, when match is accepted, dismiss the proposal notification
 */
export async function dismissExistingNotifications(
  playerId: string,
  matchId: string,
  types: NotificationType[],
  tx?: DbOrTx
) {
  try {
    await isolated(tx, (db) =>
      db
        .update(notifications)
        .set({ is_dismissed: true, dismissed_at: new Date() })
        .where(
          and(
            eq(notifications.player_id, playerId),
            eq(notifications.match_id, matchId),
            inArray(notifications.type, types),
            eq(notifications.is_dismissed, false) // Only dismiss non-dismissed notifications
          )
        )
    )
    return true
  } catch (err) {
    console.error('[Notifications] Failed to dismiss notifications:', err)
    return false
  }
}

/**
 * Dismiss all notifications of specific types for a match (both players)
 * Useful when match is cancelled or completed
 */
export async function dismissMatchNotifications(
  matchId: string,
  types: NotificationType[],
  tx?: DbOrTx
) {
  try {
    await isolated(tx, (db) =>
      db
        .update(notifications)
        .set({ is_dismissed: true, dismissed_at: new Date() })
        .where(
          and(
            eq(notifications.match_id, matchId),
            inArray(notifications.type, types),
            eq(notifications.is_dismissed, false)
          )
        )
    )
    return true
  } catch (err) {
    console.error('[Notifications] Failed to dismiss match notifications:', err)
    return false
  }
}
