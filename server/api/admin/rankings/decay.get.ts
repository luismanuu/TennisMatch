import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'
import { getMonthlyDecayStatus, calculateDecayAmount, MATCHES_REQUIRED_PER_MONTH } from '~/server/utils/rating-system'
import { adminDecayStatusListQuerySchema, validateQuery } from '~/server/utils/validation'
import { getQuery } from 'h3'
import { getOrSetTtlCache } from '~/server/utils/ttl-cache'

export default defineEventHandler(async (event) => {
  try {
    const query = validateQuery(adminDecayStatusListQuerySchema, getQuery(event))
    const clerkId = query.clerk_id
    const limit = query.limit ?? 50
    const offset = query.offset ?? 0
    const onlyAtRisk = query.only_at_risk ?? false

    await requireAdmin(clerkId)

    const cacheKey = `admin:rankings:decay:v1:${onlyAtRisk ? '1' : '0'}:${offset}:${limit}`
    return await getOrSetTtlCache(cacheKey, 60_000, async () => {
      const supabase = getSupabaseAdmin()

      type EligiblePlayerRow = {
        id: string
        name: string | null
        elo: number | null
        total_matches_played: number | null
        placement_matches_completed: number | null
        matches_this_month: number | null
        last_decay_check: string | null
        last_match_at: string | null
        created_at: string
      }

      // Total eligible players count (fast)
      const { count: totalCount, error: countError } = await supabase
        .from('players')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
        .gte('total_matches_played', 1)
    
      if (countError) {
        throw createError({
          statusCode: 500,
          statusMessage: 'Failed to count players',
          data: countError
        })
      }
    
      // Fetch lightweight rows for all eligible players (no joins) to compute decay + filtering
      const { data: eligiblePlayers, error: playersError } = await supabase
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
          created_at
        `)
        .eq('status', 'active')
        .gte('total_matches_played', 1)
        .order('created_at', { ascending: false })

      if (playersError) {
        throw createError({
          statusCode: 500,
          statusMessage: 'Failed to fetch players',
          data: playersError
        })
      }

    // Calculate decay status for each player
    const typedEligible = (eligiblePlayers || []) as unknown as EligiblePlayerRow[]
    const playersWithDecayStatus = typedEligible.map((player) => {
      const isInPlacement = (player.placement_matches_completed || 0) < 3
      const decayStatus = getMonthlyDecayStatus(
        player.matches_this_month || 0,
        player.last_decay_check,
        player.placement_matches_completed ?? undefined,
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
        matches_required: decayStatus.matches_required ?? MATCHES_REQUIRED_PER_MONTH,
        is_in_placement: isInPlacement,
        is_at_risk: isAtRisk,
        estimated_decay: estimatedDecay,
        will_decay: decayStatus.will_decay,
        days_remaining_in_month: decayStatus.days_remaining_in_month,
        last_decay_check: player.last_decay_check,
        last_match_at: player.last_match_at,
        // joins are fetched only for the current page
        category: undefined,
        city: undefined
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
    const paginatedSlice = filteredPlayers.slice(offset, offset + limit)
    const paginatedIds = paginatedSlice.map(p => p.id)

    // Fetch joins only for the current page (avoid heavy over-fetch)
    type PlayerDetailRow = { id: string; category: unknown; city: unknown }
    let detailsById = new Map<string, { category: unknown; city: unknown }>()
    if (paginatedIds.length > 0) {
      const { data: detailRows, error: detailError } = await supabase
        .from('players')
        .select(`
          id,
          category:categories(id, name),
          city:cities(id, name)
        `)
        .in('id', paginatedIds)

      if (detailError) {
        throw createError({
          statusCode: 500,
          statusMessage: 'Failed to fetch player details',
          data: detailError
        })
      }

      const typedDetailRows = (detailRows || []) as unknown as PlayerDetailRow[]
      detailsById = new Map(typedDetailRows.map((r) => [r.id, { category: r.category, city: r.city }]))
    }

    const paginatedPlayers = paginatedSlice.map(p => {
      const detail = detailsById.get(p.id)
      return {
        ...p,
        category: detail?.category,
        city: detail?.city
      }
    })

    // Calculate statistics (based on all players, not just current page)
    const stats = {
      total_eligible: totalCount || playersWithDecayStatus.length,
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
    })
  } catch (error: unknown) {
    handleApiError(error, 'GET /api/admin/rankings/decay')
  }
})
