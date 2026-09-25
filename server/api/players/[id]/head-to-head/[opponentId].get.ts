import { and, desc, eq, gte, isNotNull } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { rating_history } from '~/server/db/schema'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type HistoryEntry = Awaited<ReturnType<typeof fetchHistory>>[number]

async function fetchHistory(playerId: string, opponentId: string, dateFilter: Date | null) {
  return useDb().query.rating_history.findMany({
    columns: {
      id: true,
      match_id: true,
      elo_before: true,
      elo_after: true,
      elo_change: true,
      was_winner: true,
      created_at: true,
    },
    with: {
      match: { columns: { played_at: true, scheduled_at: true } },
    },
    where: and(
      eq(rating_history.player_id, playerId),
      eq(rating_history.opponent_id, opponentId),
      eq(rating_history.rating_reversed, false),
      isNotNull(rating_history.match_id),
      ...(dateFilter ? [gte(rating_history.created_at, dateFilter)] : []),
    ),
    orderBy: desc(rating_history.created_at),
  })
}

function getMatchDate(entry: HistoryEntry): Date {
  const playedAt = entry.match?.played_at ?? entry.match?.scheduled_at
  if (playedAt) {
    const date = new Date(playedAt)
    if (!isNaN(date.getTime())) return date
  }
  if (entry.created_at) {
    const created = new Date(entry.created_at)
    if (!isNaN(created.getTime())) return created
  }
  return new Date()
}

export default defineEventHandler(async (event) => {
  const playerId = getRouterParam(event, 'id')
  const opponentId = getRouterParam(event, 'opponentId')
  const query = getQuery(event)
  const period = (query.period as string) || 'all' // month, year, all

  if (!playerId) {
    throw createError({ statusCode: 400, statusMessage: 'Player ID is required' })
  }
  if (!opponentId) {
    throw createError({ statusCode: 400, statusMessage: 'Opponent ID is required' })
  }

  try {
  let dateFilter: Date | null = null
  if (period === 'month') {
    dateFilter = new Date()
    dateFilter.setMonth(dateFilter.getMonth() - 1)
  } else if (period === 'year') {
    dateFilter = new Date()
    dateFilter.setFullYear(dateFilter.getFullYear() - 1)
  }

  const h2hHistory =
    UUID.test(playerId) && UUID.test(opponentId) ? await fetchHistory(playerId, opponentId, dateFilter) : []

  if (h2hHistory.length === 0) {
    return {
      success: true,
      stats: null,
      message: 'No matches found against this opponent',
    }
  }

  const wins = h2hHistory.filter((h) => h.was_winner).length
  const losses = h2hHistory.filter((h) => !h.was_winner).length
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

  const lastMatchDate = getMatchDate(h2hHistory[0])

  const winsOnly = h2hHistory.filter((h) => h.was_winner)
  const lossesOnly = h2hHistory.filter((h) => !h.was_winner)

  const maxEloGain = winsOnly.length > 0 ? Math.max(...winsOnly.map((h) => h.elo_change)) : 0
  const maxEloLoss = lossesOnly.length > 0 ? Math.abs(Math.min(...lossesOnly.map((h) => h.elo_change))) : 0
  const avgEloGain = winsOnly.length > 0 ? winsOnly.reduce((sum, h) => sum + h.elo_change, 0) / winsOnly.length : 0
  const avgEloLoss =
    lossesOnly.length > 0 ? Math.abs(lossesOnly.reduce((sum, h) => sum + h.elo_change, 0) / lossesOnly.length) : 0

  const bestMatch =
    winsOnly.length > 0 ? winsOnly.reduce((best, current) => (current.elo_change > best.elo_change ? current : best)) : null
  const worstMatch =
    lossesOnly.length > 0
      ? lossesOnly.reduce((worst, current) => (current.elo_change < worst.elo_change ? current : worst))
      : null

  // Trend (compare last 5 vs first 5, or last 3 vs first 3 for smaller samples)
  let trend: 'improving' | 'declining' | 'stable' | null = null
  if (h2hHistory.length >= 10) {
    const last5Wins = h2hHistory.slice(0, 5).filter((h) => h.was_winner).length
    const first5Wins = h2hHistory.slice(-5).filter((h) => h.was_winner).length
    const last5WinRate = (last5Wins / 5) * 100
    const first5WinRate = (first5Wins / 5) * 100
    trend = last5WinRate > first5WinRate + 10 ? 'improving' : last5WinRate < first5WinRate - 10 ? 'declining' : 'stable'
  } else if (h2hHistory.length >= 5) {
    const last3Wins = h2hHistory.slice(0, 3).filter((h) => h.was_winner).length
    const first3Wins = h2hHistory.slice(-3).filter((h) => h.was_winner).length
    trend = last3Wins > first3Wins ? 'improving' : last3Wins < first3Wins ? 'declining' : 'stable'
  }

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
      period,
    },
  }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Internal server error',
    })
  }
})
