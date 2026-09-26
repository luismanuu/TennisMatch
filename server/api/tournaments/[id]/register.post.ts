import { and, count, eq, isNull } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { tournament_registrations, tournaments } from '~/server/db/schema'
import { requirePlayer } from '~/server/utils/session'
import { publicPlayer } from '~/server/utils/public-player'
import { checkSelfRegistrationAllowed } from '~/server/utils/tournament-status'

export default defineEventHandler(async (event) => {
  const { player } = await requirePlayer(event)

  try {
    const body = await readBody<{ waitlist?: boolean }>(event)
    const { waitlist = false } = body ?? {}
    const tournamentId = getRouterParam(event, 'id')

    if (!tournamentId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Tournament ID is required'
      })
    }

    const db = useDb()

    // Check if self-registration is allowed
    const allowed = await checkSelfRegistrationAllowed(tournamentId)
    if (!allowed) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Self-registration is not allowed for this tournament'
      })
    }

    const tournament = await db.query.tournaments.findFirst({ where: eq(tournaments.id, tournamentId) })

    if (!tournament) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Tournament not found'
      })
    }

    // Verify player is in tournament category (if tournament has a category)
    // If tournament.category_id is null, tournament is open to all players
    if (tournament.category_id && player.category_id !== tournament.category_id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'You must be in the tournament category to register'
      })
    }

    const alreadyRegistered = () =>
      createError({
        statusCode: 400,
        statusMessage: 'You are already registered for this tournament'
      })

    // Check if already registered
    const existingRegistration = await db.query.tournament_registrations.findFirst({
      columns: { id: true, status: true },
      where: and(
        eq(tournament_registrations.tournament_id, tournamentId),
        eq(tournament_registrations.player_id, player.id)
      ),
    })

    if (existingRegistration) {
      throw alreadyRegistered()
    }

    // The unique (tournament, player) index settles a concurrent double registration: the loser inserts nothing
    const insertRegistration = async (status: 'waitlisted' | 'confirmed', statusMessage: string) => {
      let inserted
      try {
        inserted = await db
          .insert(tournament_registrations)
          .values({
            tournament_id: tournamentId,
            player_id: player.id,
            status,
            ...(status === 'confirmed' ? { confirmed_at: new Date() } : {})
          })
          .onConflictDoNothing()
          .returning({ id: tournament_registrations.id })
      } catch (error) {
        throw createError({ statusCode: 500, statusMessage, data: error })
      }
      if (inserted.length === 0) {
        throw alreadyRegistered()
      }
      return inserted[0].id
    }

    // If player explicitly wants to join waitlist
    if (waitlist) {
      await insertRegistration('waitlisted', 'Failed to add to waitlist')
      return {
        success: true,
        message: 'Added to waitlist',
        waitlisted: true
      }
    }

    // Check max players limit
    if (tournament.max_players) {
      const [{ n }] = await db
        .select({ n: count() })
        .from(tournament_registrations)
        .where(
          and(
            eq(tournament_registrations.tournament_id, tournamentId),
            eq(tournament_registrations.status, 'confirmed'),
            isNull(tournament_registrations.withdrawn_at)
          )
        )

      if (n >= tournament.max_players) {
        // Add to waitlist automatically if tournament is full
        await insertRegistration('waitlisted', 'Failed to add to waitlist')
        return {
          success: true,
          message: 'Added to waitlist',
          waitlisted: true
        }
      }
    }

    // Register player
    const registrationId = await insertRegistration('confirmed', 'Failed to register')
    const registration = await db.query.tournament_registrations.findFirst({
      where: eq(tournament_registrations.id, registrationId),
      with: { player: publicPlayer },
    })

    return {
      success: true,
      message: 'Registered successfully',
      registration
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
