import { eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { tournaments } from '~/server/db/schema'
import { requirePlayer } from '~/server/utils/session'
import { createTournamentFromPayload } from '~/server/utils/tournament-status'
import type { CreateTournamentPayload } from '~/types'

export default defineEventHandler(async (event) => {
  const { player: organizer } = await requirePlayer(event, 'organizer')

  try {
    const body = await readBody<CreateTournamentPayload>(event)

    if (!body?.name || !body.start_date) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: name, start_date'
      })
    }

    const tournamentId = await createTournamentFromPayload(body, organizer.id, organizer.id)
    const tournament = await useDb().query.tournaments.findFirst({
      where: eq(tournaments.id, tournamentId),
      with: { category: true, organizer: true },
    })

    return {
      success: true,
      message: 'Tournament created successfully',
      tournament
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
