import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireOrganizer, verifyOrganizerOwnsTournament } from '~/server/utils/organizer'
import { getClerkClient } from '~/server/utils/clerk'
import { clerkIdQuerySchema, tournamentIdSchema, validateParam, validateQuery } from '~/server/utils/validation'
import { getQuery } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    const query = validateQuery(clerkIdQuerySchema, getQuery(event))
    const clerkId = query.clerk_id
    const tournamentId = validateParam(tournamentIdSchema, getRouterParam(event, 'id'))

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
        id,
        name,
        status,
        start_date,
        end_date,
        description,
        category_id,
        organizer_id,
        current_phase,
        tournament_type,
        registration_open,
        group_size,
        players_per_group_advance,
        min_players,
        max_players,
        points_config,
        category:categories(id, name, description, order),
        registrations:tournament_registrations(
          id,
          status,
          withdrawn_at,
          player:players(
            id,
            name,
            phone_number,
            clerk_id,
            category:categories(id, name, description, order)
          )
        ),
        groups:tournament_groups(id),
        rounds:tournament_rounds(
          id,
          bracket_type,
          round_number,
          deadline
        )
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
    type RegistrationRow = {
      id: string
      status: string | null
      withdrawn_at: string | null
      player: Array<Record<string, unknown> & { clerk_id?: string | null }>
    }

    const tournamentRecord = tournament as unknown as Record<string, unknown>
    const registrations = tournamentRecord['registrations'] as unknown as RegistrationRow[] | undefined

    if (registrations && registrations.length > 0) {
      const enrichedRegistrations = await Promise.all(
        registrations.map(async (reg) => {
          const firstPlayer = Array.isArray(reg.player) ? reg.player[0] : undefined
          const clerkIdValue = firstPlayer && typeof firstPlayer.clerk_id === 'string' ? firstPlayer.clerk_id : null
          if (!clerkIdValue) return reg

          try {
            const clerkUser = await clerkClient.users.getUser(clerkIdValue)
            const email = clerkUser.emailAddresses[0]?.emailAddress || null
            const newFirstPlayer = { ...firstPlayer, email }
            return { ...reg, player: [newFirstPlayer, ...reg.player.slice(1)] }
          } catch {
            const newFirstPlayer = { ...firstPlayer, email: null }
            return { ...reg, player: [newFirstPlayer, ...reg.player.slice(1)] }
          }
        })
      )

      return { ...tournamentRecord, registrations: enrichedRegistrations }
    }

    return tournament
  } catch (error: unknown) {
    handleApiError(error, 'GET /api/organizer/tournaments/[id]')
  }
})

