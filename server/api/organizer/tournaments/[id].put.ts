import { getSupabaseAdmin } from '~/server/utils/supabase'
import { logger } from '~/server/utils/logger'
import { requireOrganizer, verifyOrganizerOwnsTournament } from '~/server/utils/organizer'
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

    await requireOrganizer(clerk_id)

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

    // Verify organizer owns this tournament
    await verifyOrganizerOwnsTournament(organizer.id, tournamentId, supabase)

    // If status is being changed to 'active', verify brackets are generated
    if (status === 'active') {
      const { data: tournament } = await supabase
        .from('tournaments')
        .select('groups:tournament_groups(id)')
        .eq('id', tournamentId)
        .single()

      // Check if groups exist (brackets generated)
      const { data: groups } = await supabase
        .from('tournament_groups')
        .select('id')
        .eq('tournament_id', tournamentId)
        .limit(1)

      if (!groups || groups.length === 0) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Cannot start tournament: brackets must be generated first'
        })
      }

      // Verify that matches exist for the groups
      const { data: groupMatches } = await supabase
        .from('tournament_matches')
        .select('id')
        .eq('tournament_id', tournamentId)
        .eq('bracket_type', 'group')
        .limit(1)

      if (!groupMatches || groupMatches.length === 0) {
        // Matches don't exist, but groups do - this shouldn't happen if brackets were generated correctly
        // But we'll allow it and let the organizer generate brackets manually
        logger.warn('Tournament has groups but no matches. Organizer should generate brackets.', { tournamentId })
      }
    }

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
    handleApiError(error, 'PUT /api/organizer/tournaments/[id]')
  }
})

