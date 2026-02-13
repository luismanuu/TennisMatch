import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'
import type { UpdateTournamentPayload } from '~/types'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<UpdateTournamentPayload & { clerk_id: string }>(event)
    const { clerk_id, name, category_id, start_date, end_date, status, group_size, players_per_group_advance, registration_open, registration_deadline, max_players, min_players, description, rules, location, points_config } = body
    const tournamentId = getRouterParam(event, 'id')

    if (!clerk_id) {
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

    await requireAdmin(clerk_id)

    const supabase = getSupabaseAdmin()

    // Build update object
    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name.trim()
    if (start_date !== undefined) updateData.start_date = start_date
    if (end_date !== undefined) updateData.end_date = end_date || null
    if (status !== undefined) updateData.status = status
    if (group_size !== undefined) updateData.group_size = group_size
    if (players_per_group_advance !== undefined) updateData.players_per_group_advance = players_per_group_advance
    if (registration_open !== undefined) updateData.registration_open = registration_open
    if (registration_deadline !== undefined) updateData.registration_deadline = registration_deadline || null
    if (max_players !== undefined) updateData.max_players = max_players || null
    if (min_players !== undefined) updateData.min_players = min_players
    if (description !== undefined) updateData.description = description?.trim() || null
    if (rules !== undefined) updateData.rules = rules?.trim() || null
    if (location !== undefined) updateData.location = location?.trim() || null
    if (points_config !== undefined) updateData.points_config = points_config || null

    // Verify tournament exists
    const { data: existingTournament, error: fetchError } = await supabase
      .from('tournaments')
      .select('id')
      .eq('id', tournamentId)
      .single()

    if (fetchError || !existingTournament) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Tournament not found'
      })
    }

    // Verify category if updating (allow null for open tournaments)
    if (category_id !== undefined && category_id !== null) {
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
    
    // Allow setting category_id to null
    if (category_id !== undefined) {
      updateData.category_id = category_id || null
    }

    // Update tournament
    const { data: tournament, error: updateError } = await supabase
      .from('tournaments')
      .update(updateData)
      .eq('id', tournamentId)
      .select(`
        *,
        category:categories(*),
        created_by_player:players!tournaments_created_by_fkey(*),
        organizer:players!tournaments_organizer_id_fkey(*)
      `)
      .single()

    if (updateError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to update tournament',
        data: updateError
      })
    }

    return {
      success: true,
      message: 'Tournament updated successfully',
      tournament
    }
  } catch (error: unknown) {
    handleApiError(error, 'PUT /api/admin/tournaments/[id]')
  }
})

