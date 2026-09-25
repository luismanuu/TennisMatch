import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requirePlayer } from '~/server/utils/session'

export default defineEventHandler(async (event) => {
  const { player: organizer } = await requirePlayer(event, 'organizer')

  try {
    const supabase = getSupabaseAdmin()

    // Get tournaments created by this organizer
    const { data: tournaments, error } = await supabase
      .from('tournaments')
      .select(`
        *,
        category:categories(*),
        registrations:tournament_registrations(
          *,
          player:players(*)
        ),
        groups:tournament_groups(
          *,
          players:tournament_group_players(
            *,
            player:players(*)
          )
        )
      `)
      .eq('organizer_id', organizer.id)
      .order('created_at', { ascending: false })

    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch tournaments',
        data: error
      })
    }

    return tournaments || []
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

