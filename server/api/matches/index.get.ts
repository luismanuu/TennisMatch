import { and, desc, eq, exists, gte, isNotNull, isNull, lte, ne, or, sql, type SQL } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { matches, pending_players, players } from '~/server/db/schema'
import { requireUser } from '~/server/utils/session'

const categoryColumns = { columns: { id: true, name: true, description: true, order: true } } as const
const listedPlayer = {
  columns: { id: true, name: true, elo: true, total_matches_played: true, placement_matches_completed: true },
  with: { category: categoryColumns },
} as const

// The nested keys the matches pages read
const matchListRelations = {
  player1: listedPlayer,
  player2: listedPlayer,
  pending_player2: {
    columns: { id: true, name: true, email: true, status: true, invited_by_player_id: true },
    with: { category: categoryColumns },
  },
  winner: { columns: { id: true, name: true, status: true } },
  tournament: { columns: { id: true, name: true, category_id: true } },
  tournament_match: {
    columns: { id: true, bracket_type: true, round_number: true, group_id: true, round_deadline: true },
    with: { group: { columns: { id: true, group_name: true } } },
  },
} as const

const namedPlayer = { columns: { id: true, name: true } } as const

// Without an opponent filter the list also names who proposed, accepted or rejected each step
const matchListWithActorsRelations = {
  ...matchListRelations,
  match_proposed_by_player: namedPlayer,
  match_accepted_by_player: namedPlayer,
  match_rejected_by_player: namedPlayer,
  acceptance_change_approved_by_player: namedPlayer,
  acceptance_change_rejected_by_player: namedPlayer,
  score_proposed_by_player: namedPlayer,
  score_approved_by_player: namedPlayer,
  reschedule_proposed_by_player: namedPlayer,
  reschedule_approved_by_player: namedPlayer,
  reschedule_rejected_by_player: namedPlayer,
} as const

// scheduled_at descending with NULLS LAST, then newest created first
const matchListOrder = [sql`${matches.scheduled_at} desc nulls last`, desc(matches.created_at)]

// Matches in the date range, or without scheduled_at (pending proposals). The conditions are OR-ed, as they always were.
function dateRangeFilter(startDate: string | undefined, endDate: string | undefined): SQL | undefined {
  const conditions: SQL[] = []
  if (startDate) conditions.push(gte(matches.scheduled_at, new Date(startDate)))
  if (endDate) conditions.push(lte(matches.scheduled_at, new Date(endDate)))
  if (conditions.length === 0) return undefined
  return or(...conditions, isNull(matches.scheduled_at))
}

type MatchSortable = { status: string; played_at: Date | null; scheduled_at: Date | null; created_at: Date | null }

function sortTime(date: Date | null): number | null {
  if (!date) return null
  const time = date.getTime()
  return Number.isNaN(time) ? null : time
}

// Newest first by played_at (completed) or scheduled_at; matches without a date go last
function compareMatchDates(a: MatchSortable, b: MatchSortable, fallbackToCreated = false): number {
  const pick = (m: MatchSortable) =>
    m.status === 'completed' && m.played_at ? m.played_at : (fallbackToCreated ? m.scheduled_at || m.created_at : m.scheduled_at)
  const dateA = sortTime(pick(a))
  const dateB = sortTime(pick(b))
  if (dateA === null && dateB === null) return 0
  if (dateA === null) return 1
  if (dateB === null) return -1
  return dateB - dateA
}

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  try {
    const query = getQuery(event)
    const page = parseInt(query.page as string) || 1
    const limit = parseInt(query.limit as string) || 10
    const offset = (page - 1) * limit
    const status = query.status as string | undefined
    // Default: show matches from last 24 hours if no date filters are set
    const startDate = query.start_date as string | undefined
    const endDate = query.end_date as string | undefined
    const skip24hFilter = query.skip_24h_filter === 'true'
    const opponentId = query.opponent_id as string | undefined
    
    const db = useDb()
    
    // Get current player
    const currentPlayer = await db.query.players.findFirst({
      columns: { id: true },
      where: eq(players.user_id, user.id),
    })
    
    if (!currentPlayer) {
      // If player doesn't exist, return empty array (user hasn't created profile yet)
      return {
        matches: [],
        pagination: {
          page: 1,
          limit,
          total: 0,
          totalPages: 0,
          hasMore: false
        }
      }
    }
    
    const statusFilter = status ? eq(matches.status, status as typeof matches.$inferSelect.status) : ne(matches.status, 'cancelled')
    const last24h = () => or(gte(matches.scheduled_at, new Date(Date.now() - 24 * 60 * 60 * 1000)), isNull(matches.scheduled_at))
    const dateFilter = dateRangeFilter(startDate, endDate) ?? (!status && !skip24hFilter ? last24h() : undefined)
    
    // Opponent filter: matches between the current player and the opponent, in either seat
    if (opponentId) {
      const rows = await db.query.matches.findMany({
        with: matchListRelations,
        where: and(
          or(
            and(eq(matches.player1_id, currentPlayer.id), eq(matches.player2_id, opponentId)),
            and(eq(matches.player1_id, opponentId), eq(matches.player2_id, currentPlayer.id))
          ),
          statusFilter,
          dateFilter
        ),
        orderBy: matchListOrder,
      })
      
      rows.sort((a, b) => compareMatchDates(a, b, true))
      
      // Pending-player matches are not relevant for an opponent filter
      const total = rows.length
      const totalPages = Math.ceil(total / limit)
      
      return {
        matches: rows.slice(offset, offset + limit),
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasMore: page < totalPages
        }
      }
    }
    
    // Matches where the user is player1 or player2
    const ownMatches = await db.query.matches.findMany({
      with: matchListWithActorsRelations,
      where: and(
        or(eq(matches.player1_id, currentPlayer.id), eq(matches.player2_id, currentPlayer.id)),
        statusFilter,
        dateFilter
      ),
      orderBy: matchListOrder,
    })
    
    // Also matches where the user invited the pending_player2 (no 24-hour filter: show all pending matches)
    const invitedMatches = await db.query.matches.findMany({
      with: matchListWithActorsRelations,
      where: and(
        isNotNull(matches.pending_player2_id),
        exists(
          db
            .select({ id: pending_players.id })
            .from(pending_players)
            .where(
              and(
                eq(pending_players.id, matches.pending_player2_id),
                eq(pending_players.invited_by_player_id, currentPlayer.id)
              )
            )
        ),
        statusFilter,
        dateRangeFilter(startDate, endDate)
      ),
      orderBy: matchListOrder,
    })
    
    // Merge and remove duplicates
    const existingIds = new Set(ownMatches.map((m) => m.id))
    const filteredData = [...ownMatches, ...invitedMatches.filter((m) => !existingIds.has(m.id))]
    
    // Newest first: played_at for completed matches, otherwise scheduled_at; undated matches last
    filteredData.sort((a, b) => compareMatchDates(a, b))
    
    // One tournament_match per match: flatten the relation to its first row
    const enrichedData = filteredData.map((match) => ({
      ...match,
      tournament_match: match.tournament_match.length > 0 ? match.tournament_match[0] : match.tournament_match,
    }))
    
    // Calculate pagination
    const total = filteredData.length
    const totalPages = Math.ceil(total / limit)
    const paginatedData = enrichedData.slice(offset, offset + limit)
    
    return {
      matches: paginatedData,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages
      }
    }
  } catch (error: any) {
    console.error('Unexpected error in matches endpoint:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Internal server error',
      data: error.data || error
    })
  }
})

