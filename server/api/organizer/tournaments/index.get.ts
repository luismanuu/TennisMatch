import { desc, eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { tournaments } from '~/server/db/schema'
import { requirePlayer } from '~/server/utils/session'

export default defineEventHandler(async (event) => {
  const { player: organizer } = await requirePlayer(event, 'organizer')

  try {
    // Get tournaments created by this organizer
    return await useDb().query.tournaments.findMany({
      where: eq(tournaments.organizer_id, organizer.id),
      orderBy: [desc(tournaments.created_at)],
      with: {
        category: true,
        registrations: { with: { player: true } },
        groups: { with: { players: { with: { player: true } } } },
      },
    })
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to fetch tournaments'
    })
  }
})
