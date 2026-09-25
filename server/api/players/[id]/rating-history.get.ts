import { and, count, eq, gte } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { rating_history } from '~/server/db/schema'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type HistoryEntry = { was_winner: boolean; elo_after: number; elo_change: number; created_at: Date | null }
type AllHistoryEntry = HistoryEntry & { match: { played_at: Date | null; scheduled_at: Date | null } | null }

function getMatchDate(entry: AllHistoryEntry): Date {
  const playedAt = entry.match?.played_at ?? entry.match?.scheduled_at
  if (playedAt) {
    const date = new Date(playedAt)
    if (!isNaN(date.getTime())) return date
  }
  return entry.created_at ? new Date(entry.created_at) : new Date()
}

// Ecuador is UTC-5 year-round (no DST).
function toEcuadorTime(date: Date): Date {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000
  return new Date(utc - 5 * 3600000)
}

export default defineEventHandler(async (event) => {
  const playerId = getRouterParam(event, 'id')
  const query = getQuery(event)
  const limit = parseInt(query.limit as string) || 20
  const offset = parseInt(query.offset as string) || 0
  const period = (query.period as string) || 'year'

  if (!playerId) {
    throw createError({ statusCode: 400, statusMessage: 'Player ID is required' })
  }

  try {
    const db = useDb()

    let dateFilter: Date | null = null
    if (period === 'month') {
      dateFilter = new Date()
      dateFilter.setMonth(dateFilter.getMonth() - 1)
    } else if (period === 'year') {
      dateFilter = new Date()
      dateFilter.setFullYear(dateFilter.getFullYear() - 1)
    }

    const baseWhere = UUID.test(playerId)
      ? and(
          eq(rating_history.player_id, playerId),
          eq(rating_history.rating_reversed, false),
          ...(dateFilter ? [gte(rating_history.created_at, dateFilter)] : []),
        )
      : undefined

    const historyCols = {
      id: true,
      match_id: true,
      elo_before: true,
      elo_after: true,
      elo_change: true,
      mmr_before: true,
      mmr_after: true,
      mmr_change: true,
      k_factor: true,
      expected_score: true,
      actual_score: true,
      is_placement_match: true,
      is_unrated_match: true,
      win_streak_bonus: true,
      opponent_id: true,
      opponent_elo: true,
      was_winner: true,
      rating_reversed: true,
      created_at: true,
    } as const

    const [history, countRows, allHistory] = baseWhere
      ? await Promise.all([
          db.query.rating_history.findMany({
            columns: historyCols,
            with: {
              opponent: { columns: { id: true, name: true }, with: { category: { columns: { id: true, name: true } } } },
              match: { columns: { id: true, played_at: true, scheduled_at: true } },
            },
            where: baseWhere,
            orderBy: (t, { desc }) => desc(t.created_at),
            limit,
            offset,
          }),
          db.select({ n: count() }).from(rating_history).where(baseWhere),
          db.query.rating_history.findMany({
            columns: { id: true, match_id: true, elo_before: true, elo_after: true, elo_change: true, was_winner: true, created_at: true },
            with: { match: { columns: { played_at: true, scheduled_at: true } } },
            where: baseWhere,
            orderBy: (t, { desc }) => desc(t.created_at),
          }),
        ])
      : [[], [{ n: 0 }], []]

    const totalCount = countRows[0]?.n ?? 0

    const wins = history.filter((h) => h.was_winner).length
    const losses = history.filter((h) => !h.was_winner).length
    const totalEloChange = history.reduce((sum, h) => sum + h.elo_change, 0)
    const peakElo = history.length ? Math.max(...history.map((h) => h.elo_after)) : 0

    // Streaks
    let currentWinStreak = 0
    let currentLosingStreak = 0
    let bestWinStreak = 0

    if (allHistory.length > 0) {
      const firstEntry = allHistory[0]
      if (firstEntry.was_winner) {
        for (const entry of allHistory) {
          if (entry.was_winner) currentWinStreak++
          else break
        }
      } else {
        for (const entry of allHistory) {
          if (!entry.was_winner) currentLosingStreak++
          else break
        }
      }

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

    const dayOfWeekStats: Record<string, { wins: number; losses: number; win_rate: number }> = {}
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
    const timeOfDayStats: Record<string, { wins: number; losses: number; win_rate: number }> = {
      morning: { wins: 0, losses: 0, win_rate: 0 },
      afternoon: { wins: 0, losses: 0, win_rate: 0 },
      evening: { wins: 0, losses: 0, win_rate: 0 },
      night: { wins: 0, losses: 0, win_rate: 0 },
    }
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ]
    const monthStats: Record<string, { wins: number; losses: number; win_rate: number; matches: number; monthName: string }> = {}
    let bestMonth: { month: string; win_rate: number; matches: number } | null = null

    for (const entry of allHistory) {
      const matchDate = getMatchDate(entry)
      if (isNaN(matchDate.getTime())) continue
      const ecuadorDate = toEcuadorTime(matchDate)

      const dayName = dayNames[ecuadorDate.getDay()]
      dayOfWeekStats[dayName] ??= { wins: 0, losses: 0, win_rate: 0 }
      entry.was_winner ? dayOfWeekStats[dayName].wins++ : dayOfWeekStats[dayName].losses++

      const hour = ecuadorDate.getHours()
      const timePeriod = hour >= 6 && hour < 12 ? 'morning' : hour >= 12 && hour < 18 ? 'afternoon' : hour >= 18 && hour < 24 ? 'evening' : 'night'
      entry.was_winner ? timeOfDayStats[timePeriod].wins++ : timeOfDayStats[timePeriod].losses++

      const monthKey = `${ecuadorDate.getFullYear()}-${ecuadorDate.getMonth()}`
      const monthName = `${monthNames[ecuadorDate.getMonth()]} ${ecuadorDate.getFullYear()}`
      monthStats[monthKey] ??= { wins: 0, losses: 0, win_rate: 0, matches: 0, monthName }
      monthStats[monthKey].matches++
      entry.was_winner ? monthStats[monthKey].wins++ : monthStats[monthKey].losses++
    }

    for (const day in dayOfWeekStats) {
      const total = dayOfWeekStats[day].wins + dayOfWeekStats[day].losses
      dayOfWeekStats[day].win_rate = total > 0 ? (dayOfWeekStats[day].wins / total) * 100 : 0
    }
    for (const p in timeOfDayStats) {
      const total = timeOfDayStats[p].wins + timeOfDayStats[p].losses
      timeOfDayStats[p].win_rate = total > 0 ? (timeOfDayStats[p].wins / total) * 100 : 0
    }
    for (const key in monthStats) {
      const total = monthStats[key].wins + monthStats[key].losses
      monthStats[key].win_rate = total > 0 ? (monthStats[key].wins / total) * 100 : 0
      if (!bestMonth || monthStats[key].win_rate > bestMonth.win_rate) {
        bestMonth = { month: monthStats[key].monthName, win_rate: monthStats[key].win_rate, matches: monthStats[key].matches }
      }
    }

    // Days since last match (compared in Ecuador local dates)
    let daysSinceLastMatch = 0
    if (allHistory.length > 0) {
      const lastMatchDate = getMatchDate(allHistory[0])
      if (!isNaN(lastMatchDate.getTime())) {
        const getEcuadorDateString = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' })
        const now = new Date()
        const [ny, nm, nd] = getEcuadorDateString(now).split('-').map(Number)
        const [ly, lm, ld] = getEcuadorDateString(lastMatchDate).split('-').map(Number)
        const diffTime = new Date(ny, nm - 1, nd).getTime() - new Date(ly, lm - 1, ld).getTime()
        daysSinceLastMatch = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)))
      }
    }

    const totalMatches = allHistory.length
    const uniqueDays = new Set(allHistory.map((e) => toEcuadorTime(getMatchDate(e)).getDay())).size
    const uniqueHours = new Set(allHistory.map((e) => toEcuadorTime(getMatchDate(e)).getHours())).size
    const uniqueMonths = new Set(
      allHistory.map((e) => {
        const d = toEcuadorTime(getMatchDate(e))
        return `${d.getFullYear()}-${d.getMonth()}`
      }),
    ).size

    const historyWithMatchDate = history.map((entry) => ({
      ...entry,
      match_date: getMatchDate(entry as unknown as AllHistoryEntry).toISOString(),
    }))

    return {
      success: true,
      history: historyWithMatchDate,
      pagination: {
        total: totalCount,
        limit,
        offset,
        has_more: totalCount > offset + limit,
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
        best_month: bestMonth,
        days_since_last_match: daysSinceLastMatch,
        period,
        has_sufficient_data: {
          streaks: totalMatches >= 1,
          day_of_week: uniqueDays >= 2 || totalMatches >= 5,
          time_of_day: uniqueHours >= 2 || totalMatches >= 5,
          best_month: uniqueMonths >= 2 || totalMatches >= 10,
          last_match: totalMatches >= 1,
        },
      },
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Internal server error',
    })
  }
})
