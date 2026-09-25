import { and, eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import {
  matches,
  players,
  tournament_group_players,
  tournament_matches,
  tournament_registrations,
  tournament_standings,
  tournaments,
} from '~/server/db/schema'
import { requireAdmin } from '~/server/utils/session'
import type { WithdrawPlayerPayload } from '~/types'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const body = await readBody<WithdrawPlayerPayload>(event)
    const { player_id, option, replacement_player_id } = body ?? {}
    const tournamentId = getRouterParam(event, 'id')

    if (!tournamentId || !player_id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Tournament ID and Player ID are required'
      })
    }

    if (!option || !['walkover', 'replacement'].includes(option)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Option must be "walkover" or "replacement"'
      })
    }

    if (option === 'replacement' && !replacement_player_id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Replacement player ID is required when option is "replacement"'
      })
    }

    // Every write of a withdrawal lands together or not at all
    await useDb().transaction(async (tx) => {
      const registration = await tx.query.tournament_registrations.findFirst({
        where: and(
          eq(tournament_registrations.tournament_id, tournamentId),
          eq(tournament_registrations.player_id, player_id)
        ),
      })

      if (!registration) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Player is not registered in this tournament'
        })
      }

      if (option === 'replacement' && replacement_player_id) {
        // Verify replacement player exists and is in same category
        const tournament = await tx.query.tournaments.findFirst({
          columns: { category_id: true },
          where: eq(tournaments.id, tournamentId),
        })
        const replacementPlayer = await tx.query.players.findFirst({
          columns: { id: true, category_id: true },
          where: eq(players.id, replacement_player_id),
        })

        if (!replacementPlayer || replacementPlayer.category_id !== tournament?.category_id) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Replacement player must be in the same category as the tournament'
          })
        }

        // Check if replacement is already registered
        const replacementReg = await tx.query.tournament_registrations.findFirst({
          columns: { id: true },
          where: and(
            eq(tournament_registrations.tournament_id, tournamentId),
            eq(tournament_registrations.player_id, replacement_player_id)
          ),
        })

        if (replacementReg) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Replacement player is already registered'
          })
        }

        // Replace player in all tournament matches
        await tx
          .update(matches)
          .set({ player1_id: replacement_player_id })
          .where(and(eq(matches.tournament_id, tournamentId), eq(matches.player1_id, player_id)))
        await tx
          .update(matches)
          .set({ player2_id: replacement_player_id })
          .where(and(eq(matches.tournament_id, tournamentId), eq(matches.player2_id, player_id)))

        // Replace in group assignments
        await tx
          .update(tournament_group_players)
          .set({ player_id: replacement_player_id })
          .where(and(eq(tournament_group_players.tournament_id, tournamentId), eq(tournament_group_players.player_id, player_id)))

        // The group table follows the group seat
        await tx
          .update(tournament_standings)
          .set({ player_id: replacement_player_id })
          .where(and(eq(tournament_standings.tournament_id, tournamentId), eq(tournament_standings.player_id, player_id)))

        // Replace in registrations, then record the original player as withdrawn
        await tx
          .update(tournament_registrations)
          .set({ player_id: replacement_player_id })
          .where(eq(tournament_registrations.id, registration.id))
        await tx.insert(tournament_registrations).values({
          tournament_id: tournamentId,
          player_id,
          status: 'withdrawn',
          withdrawn_at: new Date()
        })
      } else {
        // Walkover: mark all matches as completed with opponent winning
        const tournamentMatches = await tx.query.tournament_matches.findMany({
          columns: { match_id: true },
          where: eq(tournament_matches.tournament_id, tournamentId),
          with: { match: { columns: { id: true, player1_id: true, player2_id: true } } },
        })

        for (const tm of tournamentMatches) {
          const match = tm.match
          if (match && (match.player1_id === player_id || match.player2_id === player_id)) {
            const winnerId = match.player1_id === player_id ? match.player2_id : match.player1_id
            await tx
              .update(matches)
              .set({ winner_id: winnerId, status: 'completed', score: 'Walkover' })
              .where(eq(matches.id, match.id))
          }
        }

        // Mark registration as withdrawn
        await tx
          .update(tournament_registrations)
          .set({ status: 'withdrawn', withdrawn_at: new Date() })
          .where(eq(tournament_registrations.id, registration.id))
      }
    })

    return {
      success: true,
      message: `Player withdrawal handled with ${option} option`
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
