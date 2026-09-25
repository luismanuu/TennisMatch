import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requirePlayer } from '~/server/utils/session'
import { checkSelfRegistrationAllowed } from '~/server/utils/tournament-status'

export default defineEventHandler(async (event) => {
  const { player } = await requirePlayer(event)

  try {
    const body = await readBody<{ waitlist?: boolean }>(event)
    const { waitlist = false } = body
    const tournamentId = getRouterParam(event, 'id')

    if (!tournamentId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Tournament ID is required'
      })
    }

    const supabase = getSupabaseAdmin()

    // Check if self-registration is allowed
    const allowed = await checkSelfRegistrationAllowed(tournamentId, supabase)
    if (!allowed) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Self-registration is not allowed for this tournament'
      })
    }

    // Get tournament
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single()

    if (tournamentError || !tournament) {
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

    // Check if already registered
    const { data: existingRegistration } = await supabase
      .from('tournament_registrations')
      .select('id, status')
      .eq('tournament_id', tournamentId)
      .eq('player_id', player.id)
      .single()

    if (existingRegistration) {
      throw createError({
        statusCode: 400,
        statusMessage: 'You are already registered for this tournament'
      })
    }

    // If player explicitly wants to join waitlist
    if (waitlist) {
      const { error: waitlistError } = await supabase
        .from('tournament_registrations')
        .insert({
          tournament_id: tournamentId,
          player_id: player.id,
          status: 'waitlisted'
        })

      if (waitlistError) {
        throw createError({
          statusCode: 500,
          statusMessage: 'Failed to add to waitlist',
          data: waitlistError
        })
      }

      return {
        success: true,
        message: 'Added to waitlist',
        waitlisted: true
      }
    }

    // Check max players limit
    if (tournament.max_players) {
      const { count } = await supabase
        .from('tournament_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_id', tournamentId)
        .eq('status', 'confirmed')
        .is('withdrawn_at', null)

      if (count && count >= tournament.max_players) {
        // Add to waitlist automatically if tournament is full
        const { error: waitlistError } = await supabase
          .from('tournament_registrations')
          .insert({
            tournament_id: tournamentId,
            player_id: player.id,
            status: 'waitlisted'
          })

        if (waitlistError) {
          throw createError({
            statusCode: 500,
            statusMessage: 'Failed to add to waitlist',
            data: waitlistError
          })
        }

        return {
          success: true,
          message: 'Added to waitlist',
          waitlisted: true
        }
      }
    }

    // Register player
    const { data: registration, error: registerError } = await supabase
      .from('tournament_registrations')
      .insert({
        tournament_id: tournamentId,
        player_id: player.id,
        status: 'confirmed',
        confirmed_at: new Date().toISOString()
      })
      .select(`
        *,
        player:players(*)
      `)
      .single()

    if (registerError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to register',
        data: registerError
      })
    }

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

