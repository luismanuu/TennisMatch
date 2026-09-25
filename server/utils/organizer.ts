import { createError } from 'h3'
import { eq } from 'drizzle-orm'
import { useDb } from '../db'
import { tournaments } from '../db/schema'

export async function verifyOrganizerOwnsTournament(organizerPlayerId: string, tournamentId: string): Promise<void> {
  const tournament = await useDb().query.tournaments.findFirst({
    columns: { id: true, organizer_id: true, created_by: true },
    where: eq(tournaments.id, tournamentId),
  })
  if (!tournament) {
    throw createError({ statusCode: 404, statusMessage: 'Tournament not found' })
  }
  if (tournament.organizer_id !== organizerPlayerId && tournament.created_by !== organizerPlayerId) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden - You can only manage tournaments you created' })
  }
}
