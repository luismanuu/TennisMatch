import { and, desc, eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { notifications } from '~/server/db/schema'
import { requirePlayer } from '~/server/utils/session'

// GET /api/notifications/pending — unread, non-dismissed notifications for the current player,
// filtered to only those where the current player has a pending action, and categorized by type.
export default defineEventHandler(async (event) => {
  const { player: currentPlayer } = await requirePlayer(event)

  try {
    const query = getQuery(event)
    // Reduced from 100 to improve load time.
    const limit = Math.min(parseInt(query.limit as string) || 50, 200)

    const rows = await useDb().query.notifications.findMany({
      columns: {
        id: true,
        player_id: true,
        type: true,
        match_id: true,
        is_read: true,
        is_dismissed: true,
        created_at: true,
        read_at: true,
        dismissed_at: true,
        metadata: true,
      },
      with: {
        match: {
          columns: {
            id: true,
            player1_id: true,
            player2_id: true,
            scheduled_at: true,
            location: true,
            status: true,
            score: true,
            tournament_id: true,
            match_proposed_by: true,
            match_accepted_by: true,
            match_rejected_by: true,
            score_proposed_by: true,
            score_approved_by: true,
            schedule_proposed_by: true,
            schedule_approved_by: true,
            schedule_rejected_by: true,
            reschedule_proposed_by: true,
            reschedule_approved_by: true,
            reschedule_rejected_by: true,
            acceptance_proposed_scheduled_at: true,
            acceptance_change_approved_by: true,
            acceptance_change_rejected_by: true,
          },
          with: {
            player1: { columns: { id: true, name: true } },
            player2: { columns: { id: true, name: true } },
          },
        },
      },
      where: and(eq(notifications.player_id, currentPlayer.id), eq(notifications.is_dismissed, false)),
      orderBy: desc(notifications.created_at),
      limit,
    })

    // Filter to notifications where the current user has a pending action (mirrors "Acciones Pendientes").
    const actionableNotifications = rows.filter((n) => {
      const match = n.match
      if (!match || match.status === 'cancelled') return false

      const isPlayer1 = match.player1_id === currentPlayer.id
      const isPlayer2 = match.player2_id === currentPlayer.id
      if (!isPlayer1 && !isPlayer2) return false

      if (n.type === 'match_proposal') {
        return Boolean(isPlayer2 && match.match_proposed_by && match.match_proposed_by !== currentPlayer.id && !match.match_accepted_by && !match.match_rejected_by)
      }
      if (n.type === 'score_proposal') {
        return Boolean(match.score_proposed_by && match.score_proposed_by !== currentPlayer.id && !match.score_approved_by)
      }
      if (n.type === 'schedule_proposal') {
        return Boolean(
          match.schedule_proposed_by && match.schedule_proposed_by !== currentPlayer.id && !match.schedule_approved_by && !match.schedule_rejected_by,
        )
      }
      if (n.type === 'reschedule_proposal') {
        return Boolean(
          match.reschedule_proposed_by &&
            match.reschedule_proposed_by !== currentPlayer.id &&
            !match.reschedule_approved_by &&
            !match.reschedule_rejected_by,
        )
      }
      if (n.type === 'acceptance_change') {
        return Boolean(
          isPlayer1 &&
            match.match_proposed_by === currentPlayer.id &&
            match.acceptance_proposed_scheduled_at &&
            !match.acceptance_change_approved_by &&
            !match.acceptance_change_rejected_by,
        )
      }
      // match_created is informational only, no action required.
      return false
    })

    const categorized = {
      match_proposals: actionableNotifications.filter((n) => n.type === 'match_proposal'),
      match_created: actionableNotifications.filter((n) => n.type === 'match_created'),
      score_proposals: actionableNotifications.filter((n) => n.type === 'score_proposal'),
      schedule_proposals: actionableNotifications.filter((n) => n.type === 'schedule_proposal'),
      reschedule_proposals: actionableNotifications.filter((n) => n.type === 'reschedule_proposal'),
      acceptance_changes: actionableNotifications.filter((n) => n.type === 'acceptance_change'),
    }

    const totalCount = actionableNotifications.length
    const unreadCount = actionableNotifications.filter((n) => !n.is_read).length
    const hasMore = actionableNotifications.length >= limit

    return {
      success: true,
      notifications: actionableNotifications,
      categorized,
      count: {
        total: totalCount,
        unread: unreadCount,
        match_proposals: categorized.match_proposals.length,
        match_created: categorized.match_created.length,
        score_proposals: categorized.score_proposals.length,
        schedule_proposals: categorized.schedule_proposals.length,
        reschedule_proposals: categorized.reschedule_proposals.length,
        acceptance_changes: categorized.acceptance_changes.length,
        hasMore,
        displayed: actionableNotifications.length,
      },
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error',
    })
  }
})
