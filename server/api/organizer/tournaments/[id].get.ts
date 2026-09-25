import { eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { tournaments } from '~/server/db/schema'
import { requirePlayer } from '~/server/utils/session'
import { verifyOrganizerOwnsTournament } from '~/server/utils/organizer'
import { getAccountsByIds } from '~/server/utils/users'

export default defineEventHandler(async (event) => {
  const { player: organizer } = await requirePlayer(event, 'organizer')

  try {
    const tournamentId = getRouterParam(event, 'id')

    if (!tournamentId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Tournament ID is required'
      })
    }

    // Verify organizer owns this tournament
    await verifyOrganizerOwnsTournament(organizer.id, tournamentId)

    const tournament = await useDb().query.tournaments.findFirst({
      where: eq(tournaments.id, tournamentId),
      with: {
        category: true,
        registrations: {
          with: {
            player: {
              columns: { id: true, name: true, phone_number: true, user_id: true },
              with: { category: { columns: { id: true, name: true, description: true, order: true } } },
            },
          },
        },
        groups: { with: { players: { with: { player: true } } } },
        rounds: true,
      },
    })

    if (!tournament) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Tournament not found'
      })
    }

    // Enrich registrations with the account email
    const accounts = await getAccountsByIds(tournament.registrations.map((reg) => reg.player.user_id))

    return {
      ...tournament,
      registrations: tournament.registrations.map((reg) => ({
        ...reg,
        player: { ...reg.player, email: accounts.get(reg.player.user_id)?.email ?? null },
      })),
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
