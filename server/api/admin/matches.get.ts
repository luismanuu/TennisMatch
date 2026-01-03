import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const clerkId = query.clerk_id as string
    const status = query.status as string | undefined
    const playerId = query.player_id as string | undefined
    const startDate = query.start_date as string | undefined
    const endDate = query.end_date as string | undefined

    if (!clerkId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized - Clerk ID required'
      })
    }

    await requireAdmin(clerkId)

    const supabase = getSupabaseAdmin()

    // Build query
    let queryBuilder = supabase
      .from('matches')
      .select(`
        *,
        player1:players!player1_id(
          id,
          name,
          status,
          category:categories(id, name, description, order)
        ),
        player2:players!player2_id(
          id,
          name,
          status,
          category:categories(id, name, description, order)
        ),
        pending_player2:pending_players(
          id,
          name,
          email,
          category:categories(id, name, description, order),
          status
        ),
        winner:players!winner_id(
          id,
          name,
          status
        )
      `)

    // Apply filters
    if (status) {
      queryBuilder = queryBuilder.eq('status', status)
    }

    if (playerId) {
      queryBuilder = queryBuilder.or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
    }

    if (startDate) {
      queryBuilder = queryBuilder.gte('scheduled_at', startDate)
    }

    if (endDate) {
      queryBuilder = queryBuilder.lte('scheduled_at', endDate)
    }

    const { data: matches, error: fetchError } = await queryBuilder
      .order('scheduled_at', { ascending: false })
      .limit(1000) // Limit to prevent performance issues

    if (fetchError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch matches',
        data: fetchError
      })
    }

    // Collect all player IDs from optional relationships for batch lookup
    // Only if matches exist and have these fields
    const allPlayerIds = new Set<string>()
    if (matches && Array.isArray(matches)) {
      matches.forEach((match: any) => {
        if (match && typeof match === 'object') {
          if (match.score_proposed_by && typeof match.score_proposed_by === 'string') {
            allPlayerIds.add(match.score_proposed_by)
          }
          if (match.score_approved_by && typeof match.score_approved_by === 'string') {
            allPlayerIds.add(match.score_approved_by)
          }
          if (match.reschedule_proposed_by && typeof match.reschedule_proposed_by === 'string') {
            allPlayerIds.add(match.reschedule_proposed_by)
          }
          if (match.reschedule_approved_by && typeof match.reschedule_approved_by === 'string') {
            allPlayerIds.add(match.reschedule_approved_by)
          }
          if (match.reschedule_rejected_by && typeof match.reschedule_rejected_by === 'string') {
            allPlayerIds.add(match.reschedule_rejected_by)
          }
        }
      })
    }

    // Batch fetch all optional player relationships in a single query
    let playerMap = new Map<string, { id: string; name: string }>()
    if (allPlayerIds.size > 0) {
      const playerIdsArray = Array.from(allPlayerIds)
      if (playerIdsArray.length > 0) {
        const { data: players, error: playersError } = await supabase
          .from('players')
          .select('id, name')
          .in('id', playerIdsArray)
        
        if (!playersError && players && Array.isArray(players)) {
          playerMap = new Map(players.map((p: any) => [p.id, p]))
        }
      }
    }

    // Enrich matches with optional player relationships using the batched data
    const enrichedMatches = Array.isArray(matches) 
      ? matches.map((match: any) => {
          if (!match || typeof match !== 'object') {
            return match
          }
          
          const enriched: any = { ...match }
          
          // Only add these fields if they exist in the original match
          if (match.score_proposed_by) {
            enriched.score_proposed_by_player = playerMap.get(match.score_proposed_by) || null
          }
          if (match.score_approved_by) {
            enriched.score_approved_by_player = playerMap.get(match.score_approved_by) || null
          }
          if (match.reschedule_proposed_by) {
            enriched.reschedule_proposed_by_player = playerMap.get(match.reschedule_proposed_by) || null
          }
          if (match.reschedule_approved_by) {
            enriched.reschedule_approved_by_player = playerMap.get(match.reschedule_approved_by) || null
          }
          if (match.reschedule_rejected_by) {
            enriched.reschedule_rejected_by_player = playerMap.get(match.reschedule_rejected_by) || null
          }
          
          return enriched
        })
      : []

    return enrichedMatches
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Internal server error',
      data: error.data || error
    })
  }
})

