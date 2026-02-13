import { getSupabaseAdmin } from '~/server/utils/supabase'
import { getClerkUser } from '~/server/utils/clerk'
import { checkSelfRegistrationAllowed } from '~/server/utils/tournament-status'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<{ clerk_id: string; waitlist?: boolean }>(event)
    const { clerk_id, waitlist = false } = body
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

    // Verify Clerk user exists
    await getClerkUser(clerk_id)

    const supabase = getSupabaseAdmin()

    // Get player ID
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('id, category_id')
      .eq('clerk_id', clerk_id)
      .single()

    if (playerError || !player) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Player profile not found'
      })
    }

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
      .select('id, category_id, max_players')
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
        .select('id', { count: 'exact', head: true })
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
        id,
        tournament_id,
        player_id,
        status,
        registered_at,
        withdrawn_at,
        confirmed_at,
        check_in_status,
        check_in_at,
        player:players(id, name)
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
  } catch (error: unknown) {
    handleApiError(error, 'POST /api/tournaments/[id]/register')
  }
})

