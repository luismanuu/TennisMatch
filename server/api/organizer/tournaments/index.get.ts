import { desc, eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { tournaments } from '~/server/db/schema'
import { publicPlayer } from '~/server/utils/public-player'
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
        registrations: { with: { player: publicPlayer } },
        groups: { with: { players: { with: { player: publicPlayer } } } },
      },
    })
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to fetch tournaments'
    })
  }
})
