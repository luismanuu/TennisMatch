import { count, desc, eq } from 'drizzle-orm'
import { requireAdmin } from '~/server/utils/session'
import { useDb } from '~/server/db'
import { pending_players } from '~/server/db/schema'

// Invitations are pending_players rows; the invitation id is pending_players.id.
const invitationColumns = {
  columns: {
    id: true,
    name: true,
    email: true,
    category_id: true,
    invited_by_player_id: true,
    status: true,
    created_at: true,
    updated_at: true,
  },
  with: {
    category: { columns: { id: true, name: true, description: true, order: true } },
    invited_by_player: { columns: { id: true, name: true } },
  },
} as const

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const query = getQuery(event)

    // Pagination parameters
    const limit = Math.min(query.limit ? parseInt(query.limit as string) : 50, 500)
    const offset = query.offset ? parseInt(query.offset as string) : 0

    const db = useDb()
    const isPending = eq(pending_players.status, 'pending')

    const [pending, all, [{ value: totalPending }], [{ value: totalAll }]] = await Promise.all([
      db.query.pending_players.findMany({
        ...invitationColumns,
        where: isPending,
        orderBy: desc(pending_players.created_at),
        limit,
        offset,
      }),
      db.query.pending_players.findMany({
        ...invitationColumns,
        orderBy: desc(pending_players.created_at),
        limit,
        offset,
      }),
      db.select({ value: count() }).from(pending_players).where(isPending),
      db.select({ value: count() }).from(pending_players),
    ])

    return {
      invitations: pending,
      allInvitations: all,
      total: totalPending,
      total_all: totalAll,
      page: Math.floor(offset / limit) + 1,
      page_size: limit
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
