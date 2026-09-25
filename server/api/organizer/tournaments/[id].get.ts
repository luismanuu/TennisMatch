import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requirePlayer } from '~/server/utils/session'
import { verifyOrganizerOwnsTournament } from '~/server/utils/organizer'
import { getAccountsByIds } from '~/server/utils/users'

export default defineEventHandler(async (event) => {
  const { player: organizer } = await requirePlayer(event, 'organizer')

  try {
    const tournamentId = getRouterParam(event, 'id')

    if (!tournamentId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Tournament ID is required'
      })
    }

    const supabase = getSupabaseAdmin()

    // Verify organizer owns this tournament
    await verifyOrganizerOwnsTournament(organizer.id, tournamentId)

    const { data: tournament, error } = await supabase
      .from('tournaments')
      .select(`
        *,
        category:categories(*),
        registrations:tournament_registrations(
          *,
          player:players(
            id,
            name,
            phone_number,
            user_id,
            category:categories(id, name, description, order)
          )
        ),
        groups:tournament_groups(
          *,
          players:tournament_group_players(
            *,
            player:players(*)
          )
        ),
        rounds:tournament_rounds(*)
      `)
      .eq('id', tournamentId)
      .single()

    if (error || !tournament) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Tournament not found'
      })
    }

    // Enrich registrations with the account email
    if (tournament.registrations && tournament.registrations.length > 0) {
      const accounts = await getAccountsByIds(
        tournament.registrations.map((reg: any) => reg.player?.user_id).filter(Boolean)
      )
      tournament.registrations = tournament.registrations.map((reg: any) => {
        if (!reg.player?.user_id) {
          return reg
        }
        return {
          ...reg,
          player: {
            ...reg.player,
            email: accounts.get(reg.player.user_id)?.email ?? null
          }
        }
      })
    }

    return tournament
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

