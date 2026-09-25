import { eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { tournaments } from '~/server/db/schema'
import { requirePlayer } from '~/server/utils/session'
import { createTournamentFromPayload } from '~/server/utils/tournament-status'
import type { CreateTournamentPayload } from '~/types'

export default defineEventHandler(async (event) => {
  // The admin's own player row is recorded as created_by.
  const { player } = await requirePlayer(event, 'admin')

  try {
    const body = await readBody<CreateTournamentPayload>(event)

    if (!body?.name || !body.start_date) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: name, start_date'
      })
    }

    // Admin-created tournaments have no organizer
    const tournamentId = await createTournamentFromPayload(body, player.id, null)
    const tournament = await useDb().query.tournaments.findFirst({
      where: eq(tournaments.id, tournamentId),
      with: { category: true, created_by_player: true },
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
