import { getSupabaseAdmin } from '~/server/utils/supabase'

export default defineEventHandler(async (event) => {
  try {
    const playerId = getRouterParam(event, 'id')
    const query = getQuery(event)
    const limit = parseInt(query.limit as string) || 20
    const offset = parseInt(query.offset as string) || 0
    const period = (query.period as string) || 'year' // month, year, all
    
    if (!playerId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Player ID is required'
      })
    }
    
    const supabase = getSupabaseAdmin()
    
    // Calculate date filter based on period
    let dateFilter: Date | null = null
    if (period === 'month') {
      dateFilter = new Date()
      dateFilter.setMonth(dateFilter.getMonth() - 1)
    } else if (period === 'year') {
      dateFilter = new Date()
      dateFilter.setFullYear(dateFilter.getFullYear() - 1)
    }
    
    // Build query with date filter if needed
    let historyQuery = supabase
      .from('rating_history')
      .select(`
        id,
        match_id,
        elo_before,
        elo_after,
        elo_change,
        mmr_before,
        mmr_after,
        mmr_change,
        k_factor,
        expected_score,
        actual_score,
        is_placement_match,
        is_unrated_match,
        win_streak_bonus,
        opponent_id,
        opponent_elo,
        was_winner,
        rating_reversed,
        created_at,
        opponent:players!rating_history_opponent_id_fkey(
          id,
          name,
          category:categories(id, name)
        ),
        match:matches(
          id,
          played_at,
          scheduled_at
        )
      `, { count: 'exact' })
      .eq('player_id', playerId)
      .eq('rating_reversed', false)
    
    if (dateFilter) {
      historyQuery = historyQuery.gte('created_at', dateFilter.toISOString())
    }
    
    const { data: history, error: historyError, count } = await historyQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    if (historyError) {
      console.error('Error fetching rating history:', historyError)
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch rating history'
      })
    }
    
    // For advanced stats, we need all history in the period (not just paginated)
    let allHistoryQuery = supabase
      .from('rating_history')
      .select(`
        id,
        match_id,
        elo_before,
        elo_after,
        elo_change,
        was_winner,
        created_at,
        match:matches!rating_history_match_id_fkey(
          played_at,
          scheduled_at
        )
      `)
      .eq('player_id', playerId)
      .eq('rating_reversed', false)
    
    if (dateFilter) {
      allHistoryQuery = allHistoryQuery.gte('created_at', dateFilter.toISOString())
    }
    
    const { data: allHistory, error: allHistoryError } = await allHistoryQuery
      .order('created_at', { ascending: false })
    
    if (allHistoryError) {
      console.error('Error fetching all history for stats:', allHistoryError)
      // Continue with empty array rather than failing completely
    }
    
    // Debug: log if we have history but no match data
    if (allHistory && allHistory.length > 0) {
      const entriesWithMatchData = allHistory.filter(e => e.match).length
      if (entriesWithMatchData === 0) {
        console.warn(`Player ${playerId} has ${allHistory.length} matches but no match data in join. Using created_at as fallback.`)
      }
    }
    
    // Calculate basic stats
    const wins = history?.filter(h => h.was_winner).length ?? 0
    const losses = history?.filter(h => !h.was_winner).length ?? 0
    const totalEloChange = history?.reduce((sum, h) => sum + h.elo_change, 0) ?? 0
    const peakElo = history?.length ? Math.max(...history.map(h => h.elo_after)) : 0
    
    // Helper function to get match date - always fallback to created_at
    const getMatchDate = (entry: any): Date => {
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
      } catch (e) {
        // Fall through to created_at
      }
      // Always fallback to created_at from rating_history
      return new Date(entry.created_at)
    }
    
    // Convert to Ecuador timezone
    const toEcuadorTime = (date: Date): Date => {
      try {
        // Use a more reliable method to convert timezone
        const utc = date.getTime() + (date.getTimezoneOffset() * 60000)
        const ecuadorOffset = -5 * 3600000 // UTC-5 for Ecuador
        return new Date(utc + ecuadorOffset)
      } catch {
        return date
      }
    }
    
    // Calculate streaks
    let currentWinStreak = 0
    let currentLosingStreak = 0
    let bestWinStreak = 0
    
    if (allHistory && allHistory.length > 0) {
      // Current streak (from most recent, which is first in array since we order DESC)
      const firstEntry = allHistory[0]
      if (firstEntry.was_winner) {
        for (const entry of allHistory) {
          if (entry.was_winner) {
            currentWinStreak++
          } else {
            break
          }
        }
      } else {
        for (const entry of allHistory) {
          if (!entry.was_winner) {
            currentLosingStreak++
          } else {
            break
          }
        }
      }
      
      // Best win streak (iterate through all, reversed to go chronologically)
      let tempStreak = 0
      for (const entry of allHistory.slice().reverse()) {
        if (entry.was_winner) {
          tempStreak++
          bestWinStreak = Math.max(bestWinStreak, tempStreak)
        } else {
          tempStreak = 0
        }
      }
    }
    
    // Calculate day of week stats
    const dayOfWeekStats: { [key: string]: { wins: number; losses: number; win_rate: number } } = {}
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
    
    if (allHistory && allHistory.length > 0) {
      for (const entry of allHistory) {
        try {
          const matchDate = getMatchDate(entry)
          if (isNaN(matchDate.getTime())) {
            continue // Skip invalid dates
          }
          const ecuadorDate = toEcuadorTime(matchDate)
          const dayName = dayNames[ecuadorDate.getDay()]
          
          if (!dayOfWeekStats[dayName]) {
            dayOfWeekStats[dayName] = { wins: 0, losses: 0, win_rate: 0 }
          }
          
          if (entry.was_winner) {
            dayOfWeekStats[dayName].wins++
          } else {
            dayOfWeekStats[dayName].losses++
          }
        } catch (e) {
          // Skip entries with date errors
          console.warn('Error processing day of week for entry:', entry.id, e)
        }
      }
      
      // Calculate win rates
      for (const day in dayOfWeekStats) {
        const total = dayOfWeekStats[day].wins + dayOfWeekStats[day].losses
        dayOfWeekStats[day].win_rate = total > 0 ? (dayOfWeekStats[day].wins / total) * 100 : 0
      }
    }
    
    // Calculate time of day stats
    const timeOfDayStats: { [key: string]: { wins: number; losses: number; win_rate: number } } = {
      morning: { wins: 0, losses: 0, win_rate: 0 },
      afternoon: { wins: 0, losses: 0, win_rate: 0 },
      evening: { wins: 0, losses: 0, win_rate: 0 },
      night: { wins: 0, losses: 0, win_rate: 0 }
    }
    
    if (allHistory && allHistory.length > 0) {
      for (const entry of allHistory) {
        try {
          const matchDate = getMatchDate(entry)
          if (isNaN(matchDate.getTime())) {
            continue // Skip invalid dates
          }
          const ecuadorDate = toEcuadorTime(matchDate)
          const hour = ecuadorDate.getHours()
          
          let period: 'morning' | 'afternoon' | 'evening' | 'night'
          if (hour >= 6 && hour < 12) {
            period = 'morning'
          } else if (hour >= 12 && hour < 18) {
            period = 'afternoon'
          } else if (hour >= 18 && hour < 24) {
            period = 'evening'
          } else {
            period = 'night'
          }
          
          if (entry.was_winner) {
            timeOfDayStats[period].wins++
          } else {
            timeOfDayStats[period].losses++
          }
        } catch (e) {
          // Skip entries with date errors
          console.warn('Error processing time of day for entry:', entry.id, e)
        }
      }
      
      // Calculate win rates
      for (const period in timeOfDayStats) {
        const total = timeOfDayStats[period].wins + timeOfDayStats[period].losses
        timeOfDayStats[period].win_rate = total > 0 ? (timeOfDayStats[period].wins / total) * 100 : 0
      }
    }
    
    // Calculate best month
    const monthStats: { [key: string]: { wins: number; losses: number; win_rate: number; matches: number; monthName: string } } = {}
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    let bestMonth: { month: string; win_rate: number; matches: number } | null = null
    
    if (allHistory && allHistory.length > 0) {
      for (const entry of allHistory) {
        try {
          const matchDate = getMatchDate(entry)
          if (isNaN(matchDate.getTime())) {
            continue // Skip invalid dates
          }
          const ecuadorDate = toEcuadorTime(matchDate)
          const monthKey = `${ecuadorDate.getFullYear()}-${ecuadorDate.getMonth()}`
          const monthName = `${monthNames[ecuadorDate.getMonth()]} ${ecuadorDate.getFullYear()}`
          
          if (!monthStats[monthKey]) {
            monthStats[monthKey] = { wins: 0, losses: 0, win_rate: 0, matches: 0, monthName }
          }
          
          monthStats[monthKey].matches++
          if (entry.was_winner) {
            monthStats[monthKey].wins++
          } else {
            monthStats[monthKey].losses++
          }
        } catch (e) {
          // Skip entries with date errors
          console.warn('Error processing month for entry:', entry.id, e)
        }
      }
      
      // Calculate win rates and find best month
      for (const key in monthStats) {
        const total = monthStats[key].wins + monthStats[key].losses
        monthStats[key].win_rate = total > 0 ? (monthStats[key].wins / total) * 100 : 0
        
        if (!bestMonth || monthStats[key].win_rate > bestMonth.win_rate) {
          bestMonth = {
            month: monthStats[key].monthName,
            win_rate: monthStats[key].win_rate,
            matches: monthStats[key].matches
          }
        }
      }
    }
    
    // Calculate days since last match
    let daysSinceLastMatch = 0
    if (allHistory && allHistory.length > 0) {
      try {
        const lastMatchDate = getMatchDate(allHistory[0])
        if (!isNaN(lastMatchDate.getTime())) {
          const now = new Date()
          const diffTime = now.getTime() - lastMatchDate.getTime()
          daysSinceLastMatch = Math.floor(diffTime / (1000 * 60 * 60 * 24))
        }
      } catch (e) {
        console.warn('Error calculating days since last match:', e)
        // If we can't get the date, assume it's recent (0 days) so it shows
        daysSinceLastMatch = 0
      }
    }
    
    // Validate sufficient data - be more lenient
    const totalMatches = allHistory?.length || 0
    const uniqueDays = new Set(
      allHistory?.map(entry => {
        try {
          const matchDate = getMatchDate(entry)
          const ecuadorDate = toEcuadorTime(matchDate)
          return ecuadorDate.getDay()
        } catch {
          return -1 // Skip invalid dates
        }
      }).filter(d => d !== -1) || []
    ).size
    
    const uniqueHours = new Set(
      allHistory?.map(entry => {
        try {
          const matchDate = getMatchDate(entry)
          const ecuadorDate = toEcuadorTime(matchDate)
          return ecuadorDate.getHours()
        } catch {
          return -1 // Skip invalid dates
        }
      }).filter(h => h !== -1) || []
    ).size
    
    const uniqueMonths = new Set(
      allHistory?.map(entry => {
        try {
          const matchDate = getMatchDate(entry)
          const ecuadorDate = toEcuadorTime(matchDate)
          return `${ecuadorDate.getFullYear()}-${ecuadorDate.getMonth()}`
        } catch {
          return '' // Skip invalid dates
        }
      }).filter(m => m !== '') || []
    ).size
    
    // More lenient validation: if we have matches, show stats even with less diversity
    // For day_of_week: need at least 2 different days OR 5+ matches
    // For time_of_day: need at least 2 different hours OR 5+ matches  
    // For best_month: need at least 2 months OR 10+ matches
    
    return {
      success: true,
      history: history ?? [],
      pagination: {
        total: count ?? 0,
        limit,
        offset,
        has_more: (count ?? 0) > offset + limit,
      },
      stats: {
        wins,
        losses,
        win_rate: wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0,
        total_elo_change: totalEloChange,
        peak_elo: peakElo,
        current_win_streak: currentWinStreak,
        best_win_streak: bestWinStreak,
        current_losing_streak: currentLosingStreak,
        win_rate_by_day_of_week: dayOfWeekStats,
        win_rate_by_time_of_day: timeOfDayStats,
        best_month: bestMonth || null,
        days_since_last_match: daysSinceLastMatch,
        period,
        has_sufficient_data: {
          streaks: totalMatches >= 1,
          day_of_week: uniqueDays >= 2 || totalMatches >= 5,
          time_of_day: uniqueHours >= 2 || totalMatches >= 5,
          best_month: uniqueMonths >= 2 || totalMatches >= 10,
          last_match: totalMatches >= 1
        }
      }
    }
  } catch (error: any) {
    console.error('Error in rating-history endpoint:', error)
    console.error('Stack:', error.stack)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Internal server error'
    })
  }
})
