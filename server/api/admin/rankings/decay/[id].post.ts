import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'
import { checkAndApplyMonthlyDecay, applyDecay, calculateDecayAmount, ELO_DECAY_FLOOR, MATCHES_REQUIRED_PER_MONTH } from '~/server/utils/rating-system'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const body = await readBody(event)
    const clerkId = query.clerk_id as string
    const playerId = getRouterParam(event, 'id')
    const action = body.action as 'trigger' | 'exempt'

    if (!clerkId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized - Clerk ID required'
      })
    }

    if (!playerId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Player ID is required'
      })
    }

    if (!action || !['trigger', 'exempt'].includes(action)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid action. Must be "trigger" or "exempt"'
      })
    }

    await requireAdmin(clerkId)

    const supabase = getSupabaseAdmin()

    // Get player
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('id, name, elo, matches_this_month, last_decay_check, total_matches_played, placement_matches_completed')
      .eq('id', playerId)
      .eq('status', 'active')
      .single()

    if (playerError || !player) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Player not found',
        data: playerError
      })
    }

    if (action === 'trigger') {
      // Manually trigger decay
      const isInPlacement = (player.placement_matches_completed || 0) < 3
      
      if (isInPlacement) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Cannot apply decay to players in placement matches'
        })
      }

      // Calculate decay amount
      const decayAmount = calculateDecayAmount(player.matches_this_month || 0)
      const newElo = applyDecay(player.elo || 0, decayAmount)

      // Apply decay
      const { error: updateError } = await supabase
        .from('players')
        .update({
          elo: newElo,
          last_decay_check: new Date().toISOString().split('T')[0],
          matches_this_month: 0 // Reset for new month
        })
        .eq('id', playerId)

      if (updateError) {
        throw createError({
          statusCode: 500,
          statusMessage: 'Failed to apply decay',
          data: updateError
        })
      }

      return {
        success: true,
        message: `Decay applied to ${player.name}`,
        player: {
          id: player.id,
          name: player.name,
          elo_before: player.elo,
          elo_after: newElo,
          decay_amount: decayAmount
        }
      }
    } else if (action === 'exempt') {
      // Exempt player from decay (by setting matches_this_month to required amount)
      const { error: updateError } = await supabase
        .from('players')
        .update({
          matches_this_month: MATCHES_REQUIRED_PER_MONTH
        })
        .eq('id', playerId)

      if (updateError) {
        throw createError({
          statusCode: 500,
          statusMessage: 'Failed to exempt player from decay',
          data: updateError
        })
      }

      return {
        success: true,
        message: `${player.name} exempted from decay`,
        player: {
          id: player.id,
          name: player.name,
          matches_this_month: MATCHES_REQUIRED_PER_MONTH
        }
      }
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Internal server error',
      data: error.data || error
    })
  }
})
