import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireOrganizer, verifyOrganizerOwnsTournament } from '~/server/utils/organizer'
import { createGroups, generateGroupMatches, generatePlayoffBracket } from '~/server/utils/tournament-brackets'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<{ clerk_id: string }>(event)
    const { clerk_id } = body
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

    // Get tournament details
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single()

    if (tournamentError || !tournament) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Tournament not found'
      })
    }

    // Get confirmed registrations
    const { data: registrations, error: regError } = await supabase
      .from('tournament_registrations')
      .select('player_id')
      .eq('tournament_id', tournamentId)
      .eq('status', 'confirmed')
      .is('withdrawn_at', null)

    if (regError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch registrations',
        data: regError
      })
    }

    const playerIds = (registrations || []).map(r => r.player_id)

    // Validate minimum players
    if (playerIds.length < tournament.min_players) {
      throw createError({
        statusCode: 400,
        statusMessage: `Tournament requires at least ${tournament.min_players} players, but only ${playerIds.length} are registered`
      })
    }

    // Check if brackets already exist
    const { data: existingGroups } = await supabase
      .from('tournament_groups')
      .select('id')
      .eq('tournament_id', tournamentId)
      .limit(1)

    if (existingGroups && existingGroups.length > 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Brackets have already been generated for this tournament'
      })
    }

    // Step 1: Create groups
    const groups = createGroups(playerIds, tournament.group_size)
    
    // Create group records
    const groupRecords = groups.map(g => ({
      tournament_id: tournamentId,
      group_name: `Group ${String.fromCharCode(64 + g.groupNumber)}`,
      group_number: g.groupNumber
    }))

    const { data: createdGroups, error: groupsError } = await supabase
      .from('tournament_groups')
      .insert(groupRecords)
      .select()

    if (groupsError || !createdGroups) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to create groups',
        data: groupsError
      })
    }

    // Step 2: Assign players to groups
    const groupPlayerRecords: any[] = []
    createdGroups.forEach((group, index) => {
      groups[index].players.forEach((playerId, playerIndex) => {
        groupPlayerRecords.push({
          tournament_id: tournamentId,
          group_id: group.id,
          player_id: playerId,
          seed_position: playerIndex + 1
        })
      })
    })

    if (groupPlayerRecords.length > 0) {
      const { error: groupPlayersError } = await supabase
        .from('tournament_group_players')
        .insert(groupPlayerRecords)

      if (groupPlayersError) {
        throw createError({
          statusCode: 500,
          statusMessage: 'Failed to assign players to groups',
          data: groupPlayersError
        })
      }
    }

    // Step 3: Generate group stage matches
    const tournamentMatchRecords: any[] = []

    for (const group of createdGroups) {
      const groupPlayers = groups[group.group_number - 1].players
      const matches = generateGroupMatches(groupPlayers)

      for (const match of matches) {
        // Create match record
        const { data: matchRecord, error: matchError } = await supabase
          .from('matches')
          .insert({
            player1_id: match.player1_id,
            player2_id: match.player2_id,
            tournament_id: tournamentId,
            status: 'scheduled',
            scheduled_at: null
          })
          .select()
          .single()

        if (matchError || !matchRecord) {
          console.error('Error creating match:', matchError)
          continue
        }

        // Create tournament match record
        tournamentMatchRecords.push({
          tournament_id: tournamentId,
          match_id: matchRecord.id,
          bracket_type: 'group',
          round_number: 1,
          group_id: group.id,
          is_bye: false
        })
      }
    }

    // Insert tournament matches
    if (tournamentMatchRecords.length > 0) {
      const { error: tmError } = await supabase
        .from('tournament_matches')
        .insert(tournamentMatchRecords)

      if (tmError) {
        throw createError({
          statusCode: 500,
          statusMessage: 'Failed to create tournament matches',
          data: tmError
        })
      }
    }

    // Update tournament phase to group_stage
    const { error: phaseError } = await supabase
      .from('tournaments')
      .update({
        current_phase: 'group_stage',
        updated_at: new Date().toISOString()
      })
      .eq('id', tournamentId)

    if (phaseError) {
      console.error('Error updating tournament phase:', phaseError)
      // Don't fail the request, just log the error
    }

    return {
      success: true,
      message: 'Brackets generated successfully',
      groups: createdGroups.length,
      groupMatches: tournamentMatchRecords.length
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

