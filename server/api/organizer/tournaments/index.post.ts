import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireOrganizer } from '~/server/utils/organizer'
import type { CreateTournamentPayload } from '~/types'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<CreateTournamentPayload & { clerk_id: string }>(event)
    const { clerk_id, name, category_id, start_date, end_date, group_size, players_per_group_advance, registration_open, registration_deadline, max_players, min_players, description, rules, location } = body

    if (!clerk_id) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized - Clerk ID required'
      })
    }

    await requireOrganizer(clerk_id)

    if (!name || !start_date) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: name, start_date'
      })
    }

    const supabase = getSupabaseAdmin()

    // Get organizer's player ID
    const { data: organizer, error: organizerError } = await supabase
      .from('players')
      .select('id')
      .eq('clerk_id', clerk_id)
      .single()

    if (organizerError || !organizer) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Organizer not found'
      })
    }

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

    // Create tournament with organizer_id
    const { data: tournament, error: insertError } = await supabase
      .from('tournaments')
      .insert({
        name: name.trim(),
        category_id: category_id || null, // Allow null for open tournaments
        start_date,
        end_date: end_date || null,
        tournament_type: body.tournament_type || 'groups_playoffs',
        current_phase: 'registration',
        group_size: group_size || 4,
        players_per_group_advance: players_per_group_advance || 2,
        registration_open: registration_open !== false,
        registration_deadline: registration_deadline || null,
        max_players: max_players || null,
        min_players: min_players || 4,
        created_by: organizer.id,
        organizer_id: organizer.id, // Set organizer_id
        description: description?.trim() || null,
        rules: rules?.trim() || null,
        location: location?.trim() || null,
        status: 'upcoming'
      })
      .select(`
        *,
        category:categories(*),
        organizer:players!tournaments_organizer_id_fkey(*)
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

