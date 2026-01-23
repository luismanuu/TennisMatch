import { getSupabaseAdmin } from '~/server/utils/supabase'

export default defineEventHandler(async (event) => {
  try {
    const playerId = getRouterParam(event, 'id')
    const query = getQuery(event)
    const limit = parseInt(query.limit as string) || 10
    const offset = parseInt(query.offset as string) || 0
    const status = query.status as string | undefined
    const startDate = query.start_date as string | undefined
    const endDate = query.end_date as string | undefined
    
    if (!playerId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Player ID is required'
      })
    }
    
    const supabase = getSupabaseAdmin()
    
    // Verify player exists
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('id')
      .eq('id', playerId)
      .single()
    
    if (playerError || !player) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Player not found'
      })
    }
    
    // Build base query for matches
    let matchesQuery = supabase
      .from('matches')
      .select(`
        *,
        player1:players!player1_id(
          id,
          name,
          category:categories(id, name, description, order)
        ),
        player2:players!player2_id(
          id,
          name,
          category:categories(id, name, description, order)
        ),
        pending_player2:pending_players!pending_player2_id(
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
        ),
        tournament:tournaments(
          id,
          name,
          category_id
        )
      `, { count: 'exact' })
      .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
    
    // Apply status filter
    if (status) {
      matchesQuery = matchesQuery.eq('status', status)
    }
    
    // Apply date filters
    // For date filtering, we use played_at for completed matches and scheduled_at/created_at for others
    if (startDate || endDate) {
      if (status === 'completed') {
        // For completed matches, filter by played_at
        if (startDate) {
          matchesQuery = matchesQuery.gte('played_at', startDate)
        }
        if (endDate) {
          // Set end date to end of day
          const endDateValue = new Date(endDate)
          endDateValue.setHours(23, 59, 59, 999)
          matchesQuery = matchesQuery.lte('played_at', endDateValue.toISOString())
        }
      } else {
        // For other statuses, filter by scheduled_at (preferred) or created_at (fallback)
        // Include matches with scheduled_at in range OR matches without scheduled_at but created_at in range
        if (startDate && endDate) {
          const endDateValue = new Date(endDate)
          endDateValue.setHours(23, 59, 59, 999)
          // Matches with scheduled_at in range OR (no scheduled_at AND created_at in range)
          matchesQuery = matchesQuery.or(`and(scheduled_at.gte.${startDate},scheduled_at.lte.${endDateValue.toISOString()}),and(scheduled_at.is.null,created_at.gte.${startDate},created_at.lte.${endDateValue.toISOString()})`)
        } else if (startDate) {
          // scheduled_at >= start OR (no scheduled_at AND created_at >= start)
          matchesQuery = matchesQuery.or(`scheduled_at.gte.${startDate},and(scheduled_at.is.null,created_at.gte.${startDate})`)
        } else if (endDate) {
          const endDateValue = new Date(endDate)
          endDateValue.setHours(23, 59, 59, 999)
          // scheduled_at <= end OR (no scheduled_at AND created_at <= end)
          matchesQuery = matchesQuery.or(`scheduled_at.lte.${endDateValue.toISOString()},and(scheduled_at.is.null,created_at.lte.${endDateValue.toISOString()})`)
        }
      }
    }
    
    // Get total count with same filters
    let countQuery = supabase
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
    
    if (status) {
      countQuery = countQuery.eq('status', status)
    }
    
    if (startDate || endDate) {
      if (status === 'completed') {
        if (startDate) {
          countQuery = countQuery.gte('played_at', startDate)
        }
        if (endDate) {
          const endDateValue = new Date(endDate)
          endDateValue.setHours(23, 59, 59, 999)
          countQuery = countQuery.lte('played_at', endDateValue.toISOString())
        }
      } else {
        if (startDate && endDate) {
          const endDateValue = new Date(endDate)
          endDateValue.setHours(23, 59, 59, 999)
          countQuery = countQuery.or(`and(scheduled_at.gte.${startDate},scheduled_at.lte.${endDateValue.toISOString()}),and(scheduled_at.is.null,created_at.gte.${startDate},created_at.lte.${endDateValue.toISOString()})`)
        } else if (startDate) {
          countQuery = countQuery.or(`scheduled_at.gte.${startDate},and(scheduled_at.is.null,created_at.gte.${startDate})`)
        } else if (endDate) {
          const endDateValue = new Date(endDate)
          endDateValue.setHours(23, 59, 59, 999)
          countQuery = countQuery.or(`scheduled_at.lte.${endDateValue.toISOString()},and(scheduled_at.is.null,created_at.lte.${endDateValue.toISOString()})`)
        }
      }
    }
    
    const { count: totalMatches } = await countQuery
    
    // Fetch matches with filters applied
    const { data: matches, error: matchesError } = await matchesQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    if (matchesError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch matches'
      })
    }
    
    // For competitive completed matches, get rating history
    const matchesWithRating = await Promise.all((matches || []).map(async (match: any) => {
      if (match.is_competitive && match.status === 'completed' && match.id) {
        try {
          // Get rating history for this match
          const { data: ratingHistory } = await supabase
            .from('rating_history')
            .select('player_id, elo_change, was_winner')
            .eq('match_id', match.id)
            .eq('rating_reversed', false)
            .eq('player_id', playerId)
            .single()
          
          if (ratingHistory) {
            match.elo_change = ratingHistory.elo_change
            match.was_winner = ratingHistory.was_winner
          }
        } catch (err) {
          // Silently fail - rating history is optional
        }
      }
      return match
    }))
    
    const totalPages = Math.ceil((totalMatches || 0) / limit)
    
    return {
      success: true,
      matches: matchesWithRating || [],
      pagination: {
        total: totalMatches || 0,
        limit,
        offset,
        total_pages: totalPages,
        current_page: Math.floor(offset / limit) + 1,
        has_next: offset + limit < (totalMatches || 0),
        has_previous: offset > 0
      }
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
