import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireOrganizer, verifyOrganizerOwnsTournament } from '~/server/utils/organizer'
import { getClerkClient } from '~/server/utils/clerk'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const clerkId = query.clerk_id as string
    const tournamentId = getRouterParam(event, 'id')

    if (!clerkId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized - Clerk ID required'
      })
    }

    if (!tournamentId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Tournament ID is required'
      })
    }

    await requireOrganizer(clerkId)

    const supabase = getSupabaseAdmin()
    const clerkClient = getClerkClient()

    // Get organizer's player ID
    const { data: organizer, error: organizerError } = await supabase
      .from('players')
      .select('id')
      .eq('clerk_id', clerkId)
      .single()

    if (organizerError || !organizer) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Organizer not found'
      })
    }

    // Verify organizer owns this tournament
    await verifyOrganizerOwnsTournament(organizer.id, tournamentId, supabase)

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
            clerk_id,
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

    // Enrich registrations with email from Clerk
    if (tournament.registrations && tournament.registrations.length > 0) {
      const enrichedRegistrations = await Promise.all(
        tournament.registrations.map(async (reg: any) => {
          if (reg.player?.clerk_id) {
            try {
              const clerkUser = await clerkClient.users.getUser(reg.player.clerk_id)
              const email = clerkUser.emailAddresses[0]?.emailAddress || null
              return {
                ...reg,
                player: {
                  ...reg.player,
                  email
                }
              }
            } catch (err) {
              // If we can't get Clerk user, just return without email
              return {
                ...reg,
                player: {
                  ...reg.player,
                  email: null
                }
              }
            }
          }
          return reg
        })
      )
      tournament.registrations = enrichedRegistrations
    }

    return tournament
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

