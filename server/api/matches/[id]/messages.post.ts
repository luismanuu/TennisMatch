import { eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { match_messages, matches, players } from '~/server/db/schema'
import { requireUser } from '~/server/utils/session'
import { verifyOrganizerOwnsTournament } from '~/server/utils/organizer'
import { CHAT_MODERATION_LIMIT, moderateText, PLAYER_MESSAGE_COLUMNS } from '~/server/utils/moderation'
import { isJevFeatureEnabled } from '~/server/utils/jev'
import { consumeRateLimit } from '~/server/utils/rate-limit'
import type { CreateMatchMessagePayload } from '~/types'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  try {
    const matchId = getRouterParam(event, 'id')
    
    if (!matchId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Match ID is required'
      })
    }
    
    const body = await readBody<CreateMatchMessagePayload>(event)
    const { message } = body
    
    if (!message || !message.trim()) {
      throw createError({
        statusCode: 400,
        statusMessage: 'message is required'
      })
    }
    
    const db = useDb()
    
    // Get current player
    const currentPlayer = await db.query.players.findFirst({
      columns: { id: true },
      where: eq(players.user_id, user.id),
    })
    
    if (!currentPlayer) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Player not found'
      })
    }
    
    // Verify match exists and user is part of it or is organizer
    const match = await db.query.matches.findFirst({
      columns: { player1_id: true, player2_id: true, pending_player2_id: true, tournament_id: true },
      with: {
        pending_player2: { columns: { id: true, invited_by_player_id: true } },
        tournament: { columns: { id: true, organizer_id: true, created_by: true } },
      },
      where: eq(matches.id, matchId),
    })
    
    if (!match) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Match not found'
      })
    }
    
    // Verify user is part of the match
    const isPlayer1 = match.player1_id === currentPlayer.id
    const isPlayer2 = match.player2_id === currentPlayer.id
    const isPendingPlayerInviter = match.pending_player2_id &&
      match.pending_player2?.invited_by_player_id === currentPlayer.id
    
    // Admins can act on any match
    const isAdmin = user.role === 'admin'
    
    // Check if user is organizer of the tournament (if match belongs to a tournament)
    let isTournamentOrganizer = false
    if (match.tournament_id && match.tournament) {
      try {
        await verifyOrganizerOwnsTournament(currentPlayer.id, match.tournament_id)
        isTournamentOrganizer = true
      } catch (err) {
        // Not organizer of this tournament
        isTournamentOrganizer = false
      }
    }
    
    // Admins can send messages to any match
    if (!isPlayer1 && !isPlayer2 && !isPendingPlayerInviter && !isTournamentOrganizer && !isAdmin) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Unauthorized: You are not part of this match or organizer of the tournament'
      })
    }
    
    // Held messages stay visible to their sender with a notice until an admin reviews them. Past the
    // per-player limit a message skips moderation and publishes as it did before, with no Jev call.
    const text = message.trim()
    const withinLimit =
      isJevFeatureEnabled('moderation') &&
      (await consumeRateLimit(db, `jev-chat:${currentPlayer.id}`, CHAT_MODERATION_LIMIT)).allowed
    const moderation = withinLimit ? await moderateText('chat', text) : ({ verdict: 'allow', checked: false } as const)
    const [inserted] = await db
      .insert(match_messages)
      .values({
        match_id: matchId,
        player_id: currentPlayer.id,
        message: text,
        moderation_status: moderation.verdict === 'flag' ? 'held' : 'visible',
        moderation_scores: moderation.checked ? moderation.scores : null,
      })
      .returning({ id: match_messages.id })
    const newMessage = inserted
      ? await db.query.match_messages.findFirst({
          where: eq(match_messages.id, inserted.id),
          columns: PLAYER_MESSAGE_COLUMNS,
          with: { player: { columns: { id: true, name: true } } },
        })
      : undefined
    
    if (!newMessage) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to create message'
      })
    }
    
    return newMessage
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

