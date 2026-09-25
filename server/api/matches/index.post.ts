import { and, count, eq, gte, lt, or } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { matches, pending_players, players } from '~/server/db/schema'
import { requireUser } from '~/server/utils/session'
import { validateAndSetMatchScheduling } from '~/server/utils/tournament-scheduling'
import { createMatchNotification } from '~/server/utils/notifications'
import { datetimeLocalToISO, isDateInPast } from '~/server/utils/timezone'
import type { CreateMatchPayload } from '~/types'

const namedPlayer = { columns: { id: true, name: true } } as const
const categoryColumns = { columns: { id: true, name: true, description: true, order: true } } as const

// The match as this route has always returned it (the Vue pages read these nested keys)
const matchResponseRelations = {
  player1: { columns: { id: true, name: true }, with: { category: categoryColumns } },
  player2: { columns: { id: true, name: true }, with: { category: categoryColumns } },
  pending_player2: { columns: { id: true, name: true, email: true, status: true }, with: { category: categoryColumns } },
  match_proposed_by_player: namedPlayer,
  match_accepted_by_player: namedPlayer,
  match_rejected_by_player: namedPlayer,
  acceptance_change_approved_by_player: namedPlayer,
  acceptance_change_rejected_by_player: namedPlayer,
  score_proposed_by_player: namedPlayer,
  score_approved_by_player: namedPlayer,
  winner: namedPlayer,
} as const

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  try {
    const body = await readBody<CreateMatchPayload>(event)
    const { player1_id, player2_id, pending_player2_id, scheduled_at, location, is_competitive } = body
    
    if (!player1_id || !scheduled_at) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: player1_id, scheduled_at'
      })
    }
    
    // Convert datetime-local to ISO (treating input as Ecuador time)
    let scheduledAtISO: string
    try {
      scheduledAtISO = datetimeLocalToISO(scheduled_at)
    } catch (error: any) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid date format: ${error.message}`
      })
    }
    
    // Validate scheduled_at is not in the past
    if (isDateInPast(scheduledAtISO)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Cannot schedule a match in the past'
      })
    }
    
    // Check if this is a tournament match and validate round deadline
    // Note: tournament_id will be set when bracket is generated, so we check after match creation
    
    // Validate that either player2_id or pending_player2_id is provided, but not both
    if (!player2_id && !pending_player2_id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Either player2_id or pending_player2_id must be provided'
      })
    }
    
    if (player2_id && pending_player2_id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Cannot provide both player2_id and pending_player2_id'
      })
    }
    
    const db = useDb()
    
    // Verify player1 exists and belongs to the authenticated user
    const player1 = await db.query.players.findFirst({
      columns: { id: true, user_id: true },
      where: and(eq(players.id, player1_id), eq(players.user_id, user.id)),
    })
    
    if (!player1) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Unauthorized: player1_id does not match authenticated user'
      })
    }
    
    // If player2_id is provided, verify it exists
    if (player2_id) {
      const player2 = await db.query.players.findFirst({
        columns: { id: true },
        where: eq(players.id, player2_id),
      })
      
      if (!player2) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid player2_id'
        })
      }
      
      // Competitive matches only: at most 4 completed competitive matches between the same players per month.
      // Friendly matches are allowed.
      const isCompetitive = is_competitive !== undefined ? is_competitive : true
      if (isCompetitive) {
        const now = new Date()
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const firstDayOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
        
        // A failed count logs and does not block match creation (as before)
        const monthlyMatches = await db
          .select({ n: count() })
          .from(matches)
          .where(
            and(
              eq(matches.status, 'completed'),
              eq(matches.is_competitive, true),
              or(
                and(eq(matches.player1_id, player1_id), eq(matches.player2_id, player2_id)),
                and(eq(matches.player1_id, player2_id), eq(matches.player2_id, player1_id))
              ),
              gte(matches.played_at, firstDayOfMonth),
              lt(matches.played_at, firstDayOfNextMonth)
            )
          )
          .then(([row]) => row?.n ?? 0)
          .catch((countError: unknown) => {
            console.error('Error counting monthly matches:', countError)
            return 0
          })
        
        if (monthlyMatches >= 4) {
          throw createError({
            statusCode: 400,
            statusMessage: 'No puedes programar más de 4 partidos competitivos con el mismo jugador en un mes. Puedes programar un partido amistoso en su lugar.'
          })
        }
      }
    }
    
    // If pending_player2_id is provided, verify it exists
    if (pending_player2_id) {
      const pendingPlayer = await db.query.pending_players.findFirst({
        columns: { id: true, invited_by_player_id: true, status: true },
        where: eq(pending_players.id, pending_player2_id),
      })
      
      if (!pendingPlayer) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid pending_player2_id'
        })
      }
      
      // Verify the pending player was invited by the current user
      if (pendingPlayer.invited_by_player_id !== player1_id) {
        throw createError({
          statusCode: 403,
          statusMessage: 'Unauthorized: pending player was not invited by you'
        })
      }
    }
    
    // Create the match with status 'scheduled'
    // is_competitive defaults to true if not specified
    // match_proposed_by is set to player1 (the creator) UNLESS it's a tournament match
    // Tournament matches don't require acceptance - they're assigned by admin/organizer
    
    // scheduledAtISO is already converted above using datetimeLocalToISO
    const matchData: typeof matches.$inferInsert = {
      player1_id,
      scheduled_at: new Date(scheduledAtISO),
      status: 'scheduled',
      location: location || null,
      is_competitive: is_competitive !== undefined ? is_competitive : true
    }
    
    // Only set match_proposed_by for non-tournament matches
    // Tournament matches are assigned by admin/organizer and don't need acceptance.
    // A client-sent tournament_id skips the opponent's acceptance, so only those roles may use it.
    const bodyWithTournament = body as CreateMatchPayload & { tournament_id?: string }
    const canAssignTournamentMatch = user.role === 'admin' || user.role === 'tournament_organizer'
    if (!bodyWithTournament.tournament_id || !canAssignTournamentMatch) {
      matchData.match_proposed_by = player1_id // The creator proposes the match
    }
    
    if (player2_id) {
      matchData.player2_id = player2_id
    } else {
      matchData.pending_player2_id = pending_player2_id
    }
    
    const [inserted] = await db.insert(matches).values(matchData).returning({ id: matches.id })
    const match = inserted
      ? await db.query.matches.findFirst({ where: eq(matches.id, inserted.id), with: matchResponseRelations })
      : undefined
    
    if (!match) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to create match'
      })
    }
    
    // If this is a tournament match, validate round deadline
    if (match.tournament_id) {
      await validateAndSetMatchScheduling(match.id, scheduled_at)
    }
    
    // Create notifications for both players
    // For non-tournament matches: player2 gets proposal notification, player1 gets created notification
    // For tournament matches: both get created notification (no proposal needed)
    if (player2_id) {
      if (match.match_proposed_by) {
        // Non-tournament match: notify player2 they have a proposal to accept
        await createMatchNotification(
          player2_id,
          match.id,
          'match_proposal',
          { 
            proposed_by: match.player1?.name || 'Unknown',
            scheduled_at: match.scheduled_at,
            location: match.location
          }
        )
        
        // Notify player1 that match was created (informational)
        await createMatchNotification(
          player1_id,
          match.id,
          'match_created',
          { 
            with_player: match.player2?.name || 'Unknown',
            scheduled_at: match.scheduled_at
          }
        )
      } else {
        // Tournament match: notify both players that match is confirmed
        await Promise.all([
          createMatchNotification(
            player1_id,
            match.id,
            'match_created',
            { 
              with_player: match.player2?.name || 'Unknown',
              scheduled_at: match.scheduled_at,
              is_tournament: true
            }
          ),
          createMatchNotification(
            player2_id,
            match.id,
            'match_created',
            { 
              with_player: match.player1?.name || 'Unknown',
              scheduled_at: match.scheduled_at,
              is_tournament: true
            }
          )
        ])
      }
    } else if (pending_player2_id) {
      // Match with pending player: notify player1 that match was created
      await createMatchNotification(
        player1_id,
        match.id,
        'match_created',
        { 
          with_player: match.pending_player2?.name || 'Unknown',
          is_pending_player: true,
          scheduled_at: match.scheduled_at
        }
      )
    }
    
    return match
  } catch (error: any) {
    console.error('Error in matches POST endpoint:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Internal server error',
      data: error.data || error
    })
  }
})

