import { getSupabaseAdmin } from '~/server/utils/supabase'
import { logger } from '~/server/utils/logger'
import { headToHeadQuerySchema, playerIdSchema, validateParam, validateQuery } from '~/server/utils/validation'
import { getQuery } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    const playerId = validateParam(playerIdSchema, getRouterParam(event, 'id'))
    const opponentId = validateParam(playerIdSchema, getRouterParam(event, 'opponentId'))
    const query = validateQuery(headToHeadQuerySchema, getQuery(event))
    const period = query.period || 'all' // month, year, all
    
    const supabase = getSupabaseAdmin()
    
    type MatchRow = {
      id: string
      played_at: string | null
      scheduled_at: string | null
      score: string | null
      winner_id: string | null
    }

    type RatingHistoryRow = {
      id: string
      match_id: string | null
      elo_before: number | null
      elo_after: number | null
      elo_change: number
      was_winner: boolean
      created_at: string
      match?: MatchRow | null
    }

    // Calculate date filter based on period
    let dateFilter: Date | null = null
    if (period === 'month') {
      dateFilter = new Date()
      dateFilter.setMonth(dateFilter.getMonth() - 1)
    } else if (period === 'year') {
      dateFilter = new Date()
      dateFilter.setFullYear(dateFilter.getFullYear() - 1)
    }
    
    // Build query for head-to-head matches
    // First, get rating history without join to avoid issues
    let h2hQuery = supabase
      .from('rating_history')
      .select(`
        id,
        match_id,
        elo_before,
        elo_after,
        elo_change,
        was_winner,
        created_at
      `)
      .eq('player_id', playerId)
      .eq('opponent_id', opponentId)
      .eq('rating_reversed', false)
      .not('match_id', 'is', null) // Only get entries with valid match_id
    
    if (dateFilter) {
      h2hQuery = h2hQuery.gte('created_at', dateFilter.toISOString())
    }
    
    const { data: rawH2hHistory, error: h2hError } = await h2hQuery
      .order('created_at', { ascending: false })
    
    // If we have history, fetch match dates separately
    let h2hHistory: RatingHistoryRow[] | null = rawH2hHistory as unknown as RatingHistoryRow[] | null

    if (h2hHistory && h2hHistory.length > 0) {
      const matchIds = [...new Set(h2hHistory.map((h) => h.match_id).filter((id): id is string => Boolean(id)))]
      
      if (matchIds.length > 0) {
        const { data: matches, error: matchesError } = await supabase
          .from('matches')
          .select('id, played_at, scheduled_at, score, winner_id')
          .in('id', matchIds)
        
        if (!matchesError && matches) {
          // Create a map for quick lookup
          const matchMap = new Map((matches as unknown as MatchRow[]).map((m) => [m.id, m]))

          h2hHistory = h2hHistory.map((entry) => ({
            ...entry,
            match: entry.match_id ? (matchMap.get(entry.match_id) ?? null) : null
          }))
        }
      }
    }
    
    if (h2hError) {
      logger.error('Error fetching head-to-head history', h2hError, {
        details: h2hError.details,
        hint: h2hError.hint,
        code: h2hError.code
      })
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch head-to-head history',
        data: {
          error: h2hError.message,
          details: h2hError.details,
          hint: h2hError.hint,
          code: h2hError.code
        }
      })
    }
    
    if (!h2hHistory || h2hHistory.length === 0) {
      return {
        success: true,
        stats: null,
        message: 'No matches found against this opponent'
      }
    }
    
    // Helper function to get match date
    const getMatchDate = (entry: RatingHistoryRow): Date => {
      try {
        if (entry.match?.played_at) {
          const date = new Date(entry.match.played_at)
          if (!isNaN(date.getTime())) {
            return date
          }
        }
        if (entry.match?.scheduled_at) {
          const date = new Date(entry.match.scheduled_at)
          if (!isNaN(date.getTime())) {
            return date
          }
        }
      } catch (err) {
        logger.warn('Error parsing match date', { error: err, matchId: entry.match?.id })
      }
      // Fallback to created_at
      try {
        const date = new Date(entry.created_at)
        if (!isNaN(date.getTime())) {
          return date
        }
      } catch (err) {
        logger.warn('Error parsing created_at date', { error: err, matchId: entry.match?.id })
      }
      // Ultimate fallback
      return new Date()
    }
    
    // Calculate basic stats
    const wins = h2hHistory.filter(h => h.was_winner).length
    const losses = h2hHistory.filter(h => !h.was_winner).length
    const totalMatches = h2hHistory.length
    const winRate = totalMatches > 0 ? (wins / totalMatches) * 100 : 0
    
    // Calculate current streak
    let currentStreak = 0
    let isWinStreak = true
    for (const entry of h2hHistory) {
      if (entry.was_winner) {
        if (currentStreak === 0 || isWinStreak) {
          currentStreak++
          isWinStreak = true
        } else {
          break
        }
      } else {
        if (currentStreak === 0 || !isWinStreak) {
          currentStreak++
          isWinStreak = false
        } else {
          break
        }
      }
    }
    
    // Get last match date (safely handle empty array)
    const firstEntry = h2hHistory[0]
    const lastMatchDate = firstEntry ? getMatchDate(firstEntry) : new Date()
    
    // Calculate ELO stats
    const winsOnly = h2hHistory.filter(h => h.was_winner)
    const lossesOnly = h2hHistory.filter(h => !h.was_winner)
    
    const maxEloGain = winsOnly.length > 0 
      ? Math.max(...winsOnly.map(h => h.elo_change))
      : 0
    
    const maxEloLoss = lossesOnly.length > 0
      ? Math.abs(Math.min(...lossesOnly.map(h => h.elo_change)))
      : 0
    
    const avgEloGain = winsOnly.length > 0
      ? winsOnly.reduce((sum, h) => sum + h.elo_change, 0) / winsOnly.length
      : 0
    
    const avgEloLoss = lossesOnly.length > 0
      ? Math.abs(lossesOnly.reduce((sum, h) => sum + h.elo_change, 0) / lossesOnly.length)
      : 0
    
    // Find best and worst matches
    const bestMatch = winsOnly.length > 0
      ? winsOnly.reduce((best, current) => 
          current.elo_change > best.elo_change ? current : best
        )
      : null
    
    const worstMatch = lossesOnly.length > 0
      ? lossesOnly.reduce((worst, current) => 
          current.elo_change < worst.elo_change ? current : worst
        )
      : null
    
    // Calculate trend (compare last 5 vs first 5 if available)
    let trend: 'improving' | 'declining' | 'stable' | null = null
    if (h2hHistory.length >= 10) {
      const last5 = h2hHistory.slice(0, 5)
      const first5 = h2hHistory.slice(-5)
      
      const last5Wins = last5.filter(h => h.was_winner).length
      const first5Wins = first5.filter(h => h.was_winner).length
      
      const last5WinRate = (last5Wins / 5) * 100
      const first5WinRate = (first5Wins / 5) * 100
      
      if (last5WinRate > first5WinRate + 10) {
        trend = 'improving'
      } else if (last5WinRate < first5WinRate - 10) {
        trend = 'declining'
      } else {
        trend = 'stable'
      }
    } else if (h2hHistory.length >= 5) {
      // If less than 10 matches, compare last 3 vs first 3
      const last3 = h2hHistory.slice(0, 3)
      const first3 = h2hHistory.slice(-3)
      
      const last3Wins = last3.filter(h => h.was_winner).length
      const first3Wins = first3.filter(h => h.was_winner).length
      
      if (last3Wins > first3Wins) {
        trend = 'improving'
      } else if (last3Wins < first3Wins) {
        trend = 'declining'
      } else {
        trend = 'stable'
      }
    }
    
    // Limit matches to 50 for UI
    const limitedMatches = h2hHistory.slice(0, 50)
    
    return {
      success: true,
      stats: {
        total_matches: totalMatches,
        wins,
        losses,
        win_rate: winRate,
        current_streak: currentStreak,
        is_win_streak: isWinStreak,
        last_match_date: lastMatchDate.toISOString(),
        matches: limitedMatches,
        max_elo_gain: maxEloGain,
        max_elo_loss: maxEloLoss,
        avg_elo_gain: avgEloGain,
        avg_elo_loss: avgEloLoss,
        best_match: bestMatch,
        worst_match: worstMatch,
        trend,
        period
      }
    }
  } catch (error: unknown) {
    handleApiError(error, 'GET /api/players/[id]/head-to-head/[opponentId]')
  }
})
