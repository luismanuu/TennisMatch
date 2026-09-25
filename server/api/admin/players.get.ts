import { count, eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { players } from '~/server/db/schema'
import { requireAdmin } from '~/server/utils/session'
import { getAccountsByIds } from '~/server/utils/users'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const query = getQuery(event)
    const db = useDb()

    const includeDeleted = query.include_deleted === 'true'
    const limit = Math.min(query.limit ? parseInt(query.limit as string) : 50, 500)
    const offset = query.offset ? parseInt(query.offset as string) : 0
    const where = includeDeleted ? undefined : eq(players.status, 'active')

    const [{ n: total }] = await db.select({ n: count() }).from(players).where(where)

    const rows = await db.query.players.findMany({
      columns: {
        id: true,
        user_id: true,
        name: true,
        phone_number: true,
        category_id: true,
        elo: true,
        total_matches_played: true,
        placement_matches_completed: true,
        status: true,
        deleted_at: true,
        created_at: true,
        updated_at: true,
      },
      with: {
        category: { columns: { id: true, name: true, description: true, order: true } },
      },
      where,
      orderBy: (t, { desc }) => desc(t.created_at),
      limit,
      offset,
    })

    // Enrich with email and role from the linked account
    const accounts = await getAccountsByIds(rows.map((p) => p.user_id))
    const playersWithEmail = rows.map((player) => {
      const account = accounts.get(player.user_id)
      return {
        ...player,
        email: account?.email || '',
        role: account?.role || 'player',
      }
    })

    return {
      data: playersWithEmail,
      total,
      page: Math.floor(offset / limit) + 1,
      page_size: limit,
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error',
    })
  }
})
