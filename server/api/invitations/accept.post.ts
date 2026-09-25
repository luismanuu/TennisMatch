import { and, eq } from 'drizzle-orm'
import { requireUser } from '~/server/utils/session'
import { eloToMmr } from '~/server/utils/rating-system'
import { useDb } from '~/server/db'
import { categories, matches, pending_players, players } from '~/server/db/schema'

// The only way to accept an invitation: by the secret token from the invitation link.
// Pending-player ids and emails are not secrets (ids appear in match lists, emails are unverified),
// so neither is accepted as proof.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  try {
    const body = await readBody<{ token?: string }>(event)
    const token = typeof body?.token === 'string' ? body.token.trim() : ''

    if (!token) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invitation token is required'
      })
    }

    const playerId = await useDb().transaction(async (tx) => {
      // Claim the invitation first: the conditional update makes a second concurrent accept find nothing.
      const [pending] = await tx
        .update(pending_players)
        .set({ status: 'accepted', updated_at: new Date() })
        .where(and(eq(pending_players.invitation_token, token), eq(pending_players.status, 'pending')))
        .returning({
          id: pending_players.id,
          name: pending_players.name,
          category_id: pending_players.category_id,
          invited_by_player_id: pending_players.invited_by_player_id,
        })

      if (!pending) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Invitation not found or invalid'
        })
      }

      let player = await tx.query.players.findFirst({ columns: { id: true }, where: eq(players.user_id, user.id) })

      if (!player) {
        const category = await tx.query.categories.findFirst({
          columns: { default_elo: true },
          where: eq(categories.id, pending.category_id),
        })
        const elo = category?.default_elo ?? 1000
        const [created] = await tx
          .insert(players)
          .values({
            user_id: user.id,
            name: pending.name,
            category_id: pending.category_id,
            elo,
            mmr: eloToMmr(elo),
            mmr_uncertainty: 2.0 // Initial uncertainty for new players
          })
          .returning({ id: players.id })
        player = created
      }

      const selfMatch = await tx.query.matches.findFirst({
        columns: { id: true },
        where: and(eq(matches.pending_player2_id, pending.id), eq(matches.player1_id, player.id)),
      })
      if (player.id === pending.invited_by_player_id || selfMatch) {
        throw createError({ statusCode: 400, statusMessage: 'No puedes aceptar tu propia invitación' })
      }

      // Matches created against the invitation now belong to the real player.
      await tx
        .update(matches)
        .set({ player2_id: player.id, pending_player2_id: null, updated_at: new Date() })
        .where(eq(matches.pending_player2_id, pending.id))

      return player.id
    })

    const player = await useDb().query.players.findFirst({
      where: eq(players.id, playerId),
      with: { category: { columns: { id: true, name: true, description: true, order: true } } },
    })

    return { success: true, player }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
