import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'
import { checkRegistrationAllowed } from '~/server/utils/tournament-status'
import type { RegisterPlayerPayload } from '~/types'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<RegisterPlayerPayload & { clerk_id: string }>(event)
    const { clerk_id, player_id } = body
    const tournamentId = getRouterParam(event, 'id')

    if (!clerk_id) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized - Clerk ID required'
      })
    }

    if (!tournamentId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Tournament ID is required'
      })
    }

    if (!player_id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Player ID is required'
      })
    }

    await requireAdmin(clerk_id)

    const supabase = getSupabaseAdmin()

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

    // Verify player exists and belongs to tournament category
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('id, category_id')
      .eq('id', player_id)
      .single()

    if (playerError || !player) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Player not found'
      })
    }

    // Verify player is in tournament category (if tournament has a category)
    // If tournament.category_id is null, tournament is open to all players
    if (tournament.category_id && player.category_id !== tournament.category_id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Player does not belong to tournament category'
      })
    }

    // Check if already registered
    const { data: existingRegistration } = await supabase
      .from('tournament_registrations')
      .select('id, status')
      .eq('tournament_id', tournamentId)
      .eq('player_id', player_id)
      .single()

    if (existingRegistration) {
      if (existingRegistration.status === 'withdrawn') {
        // Re-register withdrawn player
        const { error: updateError } = await supabase
          .from('tournament_registrations')
          .update({
            status: 'confirmed',
            withdrawn_at: null,
            confirmed_at: new Date().toISOString()
          })
          .eq('id', existingRegistration.id)

        if (updateError) {
          throw createError({
            statusCode: 500,
            statusMessage: 'Failed to re-register player',
            data: updateError
          })
        }

        return {
          success: true,
          message: 'Player re-registered successfully'
        }
      } else {
        throw createError({
          statusCode: 400,
          statusMessage: 'Player is already registered'
        })
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
        // Add to waitlist
        const { error: waitlistError } = await supabase
          .from('tournament_registrations')
          .insert({
            tournament_id: tournamentId,
            player_id: player_id,
            status: 'waitlisted'
          })

        if (waitlistError) {
          throw createError({
            statusCode: 500,
            statusMessage: 'Failed to add player to waitlist',
            data: waitlistError
          })
        }

        return {
          success: true,
          message: 'Player added to waitlist',
          waitlisted: true
        }
      }
    }

    // Register player
    const { data: registration, error: registerError } = await supabase
      .from('tournament_registrations')
      .insert({
        tournament_id: tournamentId,
        player_id: player_id,
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
        statusMessage: 'Failed to register player',
        data: registerError
      })
    }

    return {
      success: true,
      message: 'Player registered successfully',
      registration
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

