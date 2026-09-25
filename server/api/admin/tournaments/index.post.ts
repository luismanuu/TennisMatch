import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requirePlayer } from '~/server/utils/session'
import { datetimeLocalToISO } from '~/server/utils/timezone'
import type { CreateTournamentPayload } from '~/types'

export default defineEventHandler(async (event) => {
  // The admin's own player row is recorded as created_by.
  const { player } = await requirePlayer(event, 'admin')

  try {
    const body = await readBody<CreateTournamentPayload>(event)
    const { name, category_id, start_date, end_date, group_size, players_per_group_advance, registration_open, registration_deadline, max_players, min_players, description, rules, location, points_config } = body

    if (!name || !start_date) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: name, start_date'
      })
    }

    const supabase = getSupabaseAdmin()

    // Verify category exists if provided
    if (category_id) {
      const { data: category, error: categoryError } = await supabase
        .from('categories')
        .select('id')
        .eq('id', category_id)
        .single()

      if (categoryError || !category) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Category not found'
        })
      }
    }

    // Convert datetime-local to ISO (treating input as Ecuador time)
    let startDateISO: string
    let endDateISO: string | null = null
    let registrationDeadlineISO: string | null = null
    
    try {
      startDateISO = datetimeLocalToISO(start_date)
      if (end_date) {
        endDateISO = datetimeLocalToISO(end_date)
      }
      if (registration_deadline) {
        registrationDeadlineISO = datetimeLocalToISO(registration_deadline)
      }
    } catch (error: any) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid date format: ${error.message}`
      })
    }

    // Create tournament
    const { data: tournament, error: insertError } = await supabase
      .from('tournaments')
      .insert({
        name: name.trim(),
        category_id: category_id || null, // Allow null for open tournaments
        start_date: startDateISO,
        end_date: endDateISO,
        tournament_type: body.tournament_type || 'groups_playoffs',
        current_phase: 'registration',
        group_size: group_size || 4,
        players_per_group_advance: players_per_group_advance || 2,
        registration_open: registration_open !== false,
        registration_deadline: registrationDeadlineISO,
        max_players: max_players || null,
        min_players: min_players || 4,
        created_by: player.id,
        organizer_id: null, // Admin-created tournaments have no organizer
        description: description?.trim() || null,
        rules: rules?.trim() || null,
        location: location?.trim() || null,
        points_config: points_config || null,
        status: 'upcoming'
      })
      .select(`
        *,
        category:categories(*),
        created_by_player:players!tournaments_created_by_fkey(*)
      `)
      .single()

    if (insertError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to create tournament',
        data: insertError
      })
    }

    return {
      success: true,
      message: 'Tournament created successfully',
      tournament
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

