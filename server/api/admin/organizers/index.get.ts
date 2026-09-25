import { count, desc, eq } from 'drizzle-orm'
import { requireAdmin } from '~/server/utils/session'
import { useDb } from '~/server/db'
import { players, user } from '~/server/db/schema'

// An organizer is an account with role 'tournament_organizer'. The list id is the organizer's player id
// (what /api/admin/organizers/[id] has always taken); an organizer who has not created a player profile
// yet is listed under their account id, which [id] also accepts.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const query = getQuery(event)

    // Pagination parameters
    const limit = Math.min(query.limit ? parseInt(query.limit as string) : 50, 500)
    const offset = query.offset ? parseInt(query.offset as string) : 0

    const db = useDb()
    const isOrganizer = eq(user.role, 'tournament_organizer')

    const [rows, [{ value: totalOrganizers }]] = await Promise.all([
      db
        .select({
          user_id: user.id,
          email: user.email,
          account_name: user.name,
          account_created_at: user.createdAt,
          account_updated_at: user.updatedAt,
          player_id: players.id,
          player_name: players.name,
          player_created_at: players.created_at,
          player_updated_at: players.updated_at,
        })
        .from(user)
        .leftJoin(players, eq(players.user_id, user.id))
        .where(isOrganizer)
        .orderBy(desc(user.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ value: count() }).from(user).where(isOrganizer),
    ])

    const organizers = rows.map((row) => ({
      id: row.player_id ?? row.user_id,
      user_id: row.user_id,
      player_id: row.player_id,
      name: row.player_name ?? row.account_name,
      email: row.email,
      created_at: row.player_created_at ?? row.account_created_at,
      updated_at: row.player_updated_at ?? row.account_updated_at
    }))

    // Organizer invitations no longer exist: an admin promotes an existing account instead.
    return {
      organizers,
      pendingInvitations: [],
      total: totalOrganizers,
      total_pending: 0,
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
