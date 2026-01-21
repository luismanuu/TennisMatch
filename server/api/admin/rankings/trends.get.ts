import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'
import { getRatingTier, RATING_TIERS } from '~/server/utils/rating-system'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const clerkId = query.clerk_id as string
    const timeRange = (query.time_range as string) || '30d' // 7d, 30d, 90d, 1y
    const granularity = (query.granularity as string) || 'daily' // daily, weekly, monthly

    if (!clerkId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized - Clerk ID required'
      })
    }

    await requireAdmin(clerkId)

    const supabase = getSupabaseAdmin()

    // Limit time range to prevent excessive data processing
    const maxDays = timeRange === '1y' ? 365 : timeRange === '90d' ? 90 : timeRange === '7d' ? 7 : 30

    // Calculate date range
    const now = new Date()
    let startDate = new Date()
    
    switch (timeRange) {
      case '7d':
        startDate.setDate(now.getDate() - 7)
        break
      case '30d':
        startDate.setDate(now.getDate() - 30)
        break
      case '90d':
        startDate.setDate(now.getDate() - 90)
        break
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1)
        break
      default:
        startDate.setDate(now.getDate() - 30)
    }

    // Get rating history for the time period (limit to prevent memory issues)
    const { data: ratingHistory, error: historyError } = await supabase
      .from('rating_history')
      .select(`
        id,
        player_id,
        elo_after,
        elo_before,
        created_at
      `)
      .gte('created_at', startDate.toISOString())
      .eq('rating_reversed', false) // Only non-reversed ratings
      .order('created_at', { ascending: true })
      .limit(10000) // Limit to prevent memory issues

    if (historyError) {
      console.error('Rating history error:', historyError)
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch rating history',
        data: historyError
      })
    }

    // If no rating history, return empty trends
    if (!ratingHistory || ratingHistory.length === 0) {
      return {
        time_range: timeRange,
        granularity,
        start_date: startDate.toISOString(),
        end_date: now.toISOString(),
        trends: []
      }
    }

    // Get all players' current state for baseline
    const { data: currentPlayers, error: playersError } = await supabase
      .from('players')
      .select('id, elo, total_matches_played, placement_matches_completed, created_at')
      .eq('status', 'active')

    if (playersError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch players',
        data: playersError
      })
    }

    // Group data by time period
    const timeSeriesData: Record<string, {
      date: string
      average_elo: number
      tier_population: Record<string, number>
      new_players: number
      tier_promotions: number
      tier_demotions: number
      elo_volatility: number
    }> = {}

    // Helper to get date key based on granularity
    const getDateKey = (date: Date): string => {
      const d = new Date(date)
      switch (granularity) {
        case 'daily':
          return d.toISOString().split('T')[0]
        case 'weekly':
          const weekStart = new Date(d)
          weekStart.setDate(d.getDate() - d.getDay())
          return weekStart.toISOString().split('T')[0]
        case 'monthly':
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        default:
          return d.toISOString().split('T')[0]
      }
    }

    // Initialize time series buckets - simplified approach
    const currentDate = new Date(startDate)
    const maxIterations = maxDays * (granularity === 'monthly' ? 1 : granularity === 'weekly' ? 1 : 1) + 100
    let iterations = 0
    
    while (currentDate <= now && iterations < maxIterations) {
      try {
        const key = getDateKey(currentDate)
        if (!timeSeriesData[key]) {
          timeSeriesData[key] = {
            date: key,
            average_elo: 0,
            tier_population: {},
            new_players: 0,
            tier_promotions: 0,
            tier_demotions: 0,
            elo_volatility: 0
          }
          RATING_TIERS.forEach(tier => {
            timeSeriesData[key].tier_population[tier.tier] = 0
          })
        }
        
        // Increment date based on granularity
        if (granularity === 'daily') {
          currentDate.setDate(currentDate.getDate() + 1)
        } else if (granularity === 'weekly') {
          currentDate.setDate(currentDate.getDate() + 7)
        } else if (granularity === 'monthly') {
          currentDate.setMonth(currentDate.getMonth() + 1)
        } else {
          currentDate.setDate(currentDate.getDate() + 1)
        }
        
        iterations++
      } catch (err) {
        console.error('Error initializing time series bucket:', err)
        break
      }
    }

    // Process rating history to build time series - simplified
    const playerEloHistory: Record<string, Array<{ date: string; elo: number; tier: string }>> = {}
    
    if (ratingHistory && ratingHistory.length > 0) {
      try {
        ratingHistory.forEach(entry => {
          try {
            const entryDate = new Date(entry.created_at)
            if (isNaN(entryDate.getTime())) {
              return // Skip invalid dates
            }
            
            const dateKey = getDateKey(entryDate)
            const playerId = entry.player_id
            
            if (!playerEloHistory[playerId]) {
              playerEloHistory[playerId] = []
            }
            
            const tierBefore = getRatingTier(entry.elo_before || 0).tier
            const tierAfter = getRatingTier(entry.elo_after || 0).tier
            
            playerEloHistory[playerId].push({
              date: dateKey,
              elo: entry.elo_after || 0,
              tier: tierAfter
            })

            // Track tier changes
            if (tierBefore !== tierAfter && timeSeriesData[dateKey]) {
              const tierBeforeIndex = RATING_TIERS.findIndex(t => t.tier === tierBefore)
              const tierAfterIndex = RATING_TIERS.findIndex(t => t.tier === tierAfter)
              
              if (tierAfterIndex > tierBeforeIndex && tierAfterIndex >= 0 && tierBeforeIndex >= 0) {
                timeSeriesData[dateKey].tier_promotions++
              } else if (tierAfterIndex < tierBeforeIndex && tierAfterIndex >= 0 && tierBeforeIndex >= 0) {
                timeSeriesData[dateKey].tier_demotions++
              }
            }
          } catch (err) {
            console.warn('Error processing rating history entry:', err)
            // Continue with next entry
          }
        })
      } catch (err) {
        console.error('Error processing rating history:', err)
      }
    }

    // Calculate average ELO and tier population for each time period
    Object.keys(timeSeriesData).forEach(dateKey => {
      try {
        // Handle different date formats
        let date: Date
        if (granularity === 'monthly' && dateKey.includes('-') && !dateKey.includes('T')) {
          // Format: YYYY-MM
          const [year, month] = dateKey.split('-').map(Number)
          date = new Date(year, month - 1, 1)
        } else {
          date = new Date(dateKey)
        }
        
        if (isNaN(date.getTime())) {
          console.warn('Invalid date key:', dateKey)
          return
        }
        
        const elos: number[] = []
        const tierCounts: Record<string, number> = {}
        
        RATING_TIERS.forEach(tier => {
          tierCounts[tier.tier] = 0
        })

        // Get players that existed at this point in time
        currentPlayers?.forEach(player => {
          try {
            const playerCreated = new Date(player.created_at)
            if (isNaN(playerCreated.getTime())) {
              return
            }
            
            if (playerCreated <= date) {
              // Find the most recent rating history entry before or on this date
              const history = playerEloHistory[player.id] || []
              const relevantEntry = history
                .filter(h => {
                  if (granularity === 'monthly') {
                    const hDate = new Date(h.date)
                    return hDate.getFullYear() === date.getFullYear() && 
                           hDate.getMonth() === date.getMonth()
                  }
                  return h.date <= dateKey
                })
                .sort((a, b) => b.date.localeCompare(a.date))[0]
              
              if (relevantEntry) {
                elos.push(relevantEntry.elo)
                tierCounts[relevantEntry.tier] = (tierCounts[relevantEntry.tier] || 0) + 1
              } else {
                // Use current ELO if no history
                elos.push(player.elo || 0)
                const tier = getRatingTier(player.elo || 0)
                tierCounts[tier.tier] = (tierCounts[tier.tier] || 0) + 1
              }
            }
          } catch (err) {
            console.warn('Error processing player:', player.id, err)
          }
        })

        if (elos.length > 0) {
          timeSeriesData[dateKey].average_elo = Math.round(
            elos.reduce((a, b) => a + b, 0) / elos.length
          )
        }
        timeSeriesData[dateKey].tier_population = tierCounts
      } catch (err) {
        console.error('Error processing date key:', dateKey, err)
      }
    })

    // Count new players per period
    currentPlayers?.forEach(player => {
      try {
        const playerCreated = new Date(player.created_at)
        if (isNaN(playerCreated.getTime())) {
          // Skip invalid dates
          return
        }
        
        if (playerCreated >= startDate) {
          const dateKey = getDateKey(playerCreated)
          if (timeSeriesData[dateKey]) {
            timeSeriesData[dateKey].new_players++
          }
        }
      } catch (err) {
        // Skip players with invalid data
        console.warn('Error processing new player:', player.id, err)
      }
    })

    // Calculate ELO volatility (simplified - average absolute change)
    Object.keys(timeSeriesData).forEach(dateKey => {
      try {
        const eloChanges: number[] = []
        
        if (ratingHistory && ratingHistory.length > 0) {
          ratingHistory.forEach(entry => {
            try {
              const entryDate = new Date(entry.created_at)
              if (isNaN(entryDate.getTime())) {
                return
              }
              
              if (getDateKey(entryDate) === dateKey) {
                const change = Math.abs((entry.elo_after || 0) - (entry.elo_before || 0))
                if (!isNaN(change)) {
                  eloChanges.push(change)
                }
              }
            } catch (err) {
              // Skip invalid entries
            }
          })
        }

        if (eloChanges.length > 0) {
          // Simplified: use average instead of standard deviation
          const avgChange = eloChanges.reduce((a, b) => a + b, 0) / eloChanges.length
          timeSeriesData[dateKey].elo_volatility = Math.round(avgChange)
        }
      } catch (err) {
        console.warn('Error calculating volatility for:', dateKey, err)
      }
    })

    // Convert to array and sort by date
    const trends = Object.values(timeSeriesData)
      .sort((a, b) => a.date.localeCompare(b.date))

    return {
      time_range: timeRange,
      granularity,
      start_date: startDate.toISOString(),
      end_date: now.toISOString(),
      trends
    }
  } catch (error: any) {
    console.error('Trends endpoint error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Internal server error',
      data: error.data || error
    })
  }
})
