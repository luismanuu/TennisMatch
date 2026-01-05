import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'
import type { WithdrawPlayerPayload } from '~/types'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<WithdrawPlayerPayload & { clerk_id: string }>(event)
    const { clerk_id, player_id, option, replacement_player_id } = body
    const tournamentId = getRouterParam(event, 'id')

    if (!clerk_id) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized - Clerk ID required'
      })
    }

    if (!tournamentId || !player_id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Tournament ID and Player ID are required'
      })
    }

    if (!option || !['walkover', 'replacement'].includes(option)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Option must be "walkover" or "replacement"'
      })
    }

    if (option === 'replacement' && !replacement_player_id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Replacement player ID is required when option is "replacement"'
      })
    }

    await requireAdmin(clerk_id)

    const supabase = getSupabaseAdmin()

    // Get registration
    const { data: registration, error: regError } = await supabase
      .from('tournament_registrations')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('player_id', player_id)
      .single()

    if (regError || !registration) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Player is not registered in this tournament'
      })
    }

    if (option === 'replacement') {
      // Verify replacement player exists and is in same category
      const { data: tournament } = await supabase
        .from('tournaments')
        .select('category_id')
        .eq('id', tournamentId)
        .single()

      const { data: replacementPlayer } = await supabase
        .from('players')
        .select('id, category_id')
        .eq('id', replacement_player_id)
        .single()

      if (!replacementPlayer || replacementPlayer.category_id !== tournament?.category_id) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Replacement player must be in the same category as the tournament'
        })
      }

      // Check if replacement is already registered
      const { data: replacementReg } = await supabase
        .from('tournament_registrations')
        .select('id')
        .eq('tournament_id', tournamentId)
        .eq('player_id', replacement_player_id)
        .single()

      if (replacementReg) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Replacement player is already registered'
        })
      }

      // Replace player in all tournament matches
      const { error: matchUpdateError } = await supabase
        .from('matches')
        .update({
          player1_id: replacement_player_id
        })
        .eq('tournament_id', tournamentId)
        .eq('player1_id', player_id)

      await supabase
        .from('matches')
        .update({
          player2_id: replacement_player_id
        })
        .eq('tournament_id', tournamentId)
        .eq('player2_id', player_id)

      // Replace in group assignments
      await supabase
        .from('tournament_group_players')
        .update({ player_id: replacement_player_id })
        .eq('tournament_id', tournamentId)
        .eq('player_id', player_id)

      // Replace in registrations
      await supabase
        .from('tournament_registrations')
        .update({ player_id: replacement_player_id })
        .eq('id', registration.id)

      // Withdraw original player
      await supabase
        .from('tournament_registrations')
        .insert({
          tournament_id: tournamentId,
          player_id: player_id,
          status: 'withdrawn',
          withdrawn_at: new Date().toISOString()
        })
        .select()
        .single()
    } else {
      // Walkover: mark all matches as completed with opponent winning
      const { data: matches } = await supabase
        .from('tournament_matches')
        .select('match_id, match:matches(*)')
        .eq('tournament_id', tournamentId)

      for (const tm of matches || []) {
        const match = tm.match as any
        if (match && (match.player1_id === player_id || match.player2_id === player_id)) {
          const winnerId = match.player1_id === player_id ? match.player2_id : match.player1_id
          await supabase
            .from('matches')
            .update({
              winner_id: winnerId,
              status: 'completed',
              score: 'Walkover'
            })
            .eq('id', match.id)
        }
      }

      // Mark registration as withdrawn
      await supabase
        .from('tournament_registrations')
        .update({
          status: 'withdrawn',
          withdrawn_at: new Date().toISOString()
        })
        .eq('id', registration.id)
    }

    return {
      success: true,
      message: `Player withdrawal handled with ${option} option`
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

