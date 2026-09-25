import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/session'
import { getMonthlyDecayStatus, calculateDecayAmount, MATCHES_REQUIRED_PER_MONTH } from '~/server/utils/rating-system'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const query = getQuery(event)
    
    // Pagination parameters
    const limit = Math.min(query.limit ? parseInt(query.limit as string) : 50, 500)
    const offset = query.offset ? parseInt(query.offset as string) : 0
    
    // Filter: only_at_risk
    const onlyAtRisk = query.only_at_risk === 'true'

    const supabase = getSupabaseAdmin()

    // Get all active players
    let playersQuery = supabase
      .from('players')
      .select(`
        id,
        name,
        elo,
        total_matches_played,
        placement_matches_completed,
        matches_this_month,
        last_decay_check,
        last_match_at,
        created_at,
        category:categories(id, name),
        city:cities(id, name)
      `)
      .eq('status', 'active')
      .gte('total_matches_played', 1)
    
    // Get total count (before filtering by at_risk)
    const { count: totalCount, error: countError } = await playersQuery
      .select('id', { count: 'exact', head: true })
    
    if (countError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to count players',
        data: countError
      })
    }
    
    const { data: players, error: playersError } = await playersQuery

    if (playersError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch players',
        data: playersError
      })
    }

    // Calculate decay status for each player
    const playersWithDecayStatus = (players || []).map(player => {
      const isInPlacement = (player.placement_matches_completed || 0) < 3
      const decayStatus = getMonthlyDecayStatus(
        player.matches_this_month || 0,
        player.last_decay_check,
        player.placement_matches_completed,
        player.created_at
      )

      const estimatedDecay = isInPlacement ? 0 : calculateDecayAmount(player.matches_this_month || 0, decayStatus.matches_required)
      const isAtRisk = !isInPlacement && (player.matches_this_month || 0) < decayStatus.matches_required

      return {
        id: player.id,
        name: player.name,
        elo: player.elo || 0,
        total_matches_played: player.total_matches_played || 0,
        matches_this_month: player.matches_this_month || 0,
        matches_required: MATCHES_REQUIRED_PER_MONTH,
        is_in_placement: isInPlacement,
        is_at_risk: isAtRisk,
        estimated_decay: estimatedDecay,
        will_decay: decayStatus.will_decay,
        days_remaining_in_month: decayStatus.days_remaining_in_month,
        last_decay_check: player.last_decay_check,
        last_match_at: player.last_match_at,
        category: player.category,
        city: player.city
      }
    })

    // Filter players at risk
    const playersAtRisk = playersWithDecayStatus.filter(p => p.is_at_risk)
    
    // Apply filter if only_at_risk is true
    let filteredPlayers = playersWithDecayStatus
    if (onlyAtRisk) {
      filteredPlayers = playersAtRisk
    }
    
    // Apply pagination
    const totalFiltered = filteredPlayers.length
    const paginatedPlayers = filteredPlayers.slice(offset, offset + limit)

    // Calculate statistics (based on all players, not just current page)
    const stats = {
      total_eligible: playersWithDecayStatus.length,
      total_at_risk: playersAtRisk.length,
      total_exempt: playersWithDecayStatus.filter(p => p.is_in_placement).length,
      total_decay_amount: playersAtRisk.reduce((sum, p) => sum + p.estimated_decay, 0),
      average_decay: playersAtRisk.length > 0
        ? Math.round(playersAtRisk.reduce((sum, p) => sum + p.estimated_decay, 0) / playersAtRisk.length)
        : 0
    }

    return {
      success: true,
      players: paginatedPlayers,
      players_at_risk: playersAtRisk,
      statistics: stats,
      total: totalFiltered,
      total_eligible: totalCount || 0,
      page: Math.floor(offset / limit) + 1,
      page_size: limit
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Internal server error',
      data: error.data || error
    })
  }
})
