import { getSupabaseAdmin } from '~/server/utils/supabase'
import { logger } from '~/server/utils/logger'

export default defineEventHandler(async (event) => {
  try {
    const tournamentId = getRouterParam(event, 'id')

    if (!tournamentId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Tournament ID is required'
      })
    }

    const supabase = getSupabaseAdmin()

    // Get groups with players and standings
    const { data: groups, error: groupsError } = await supabase
      .from('tournament_groups')
      .select(`
        id,
        tournament_id,
        group_name,
        group_number,
        created_at,
        players:tournament_group_players(
          id,
          tournament_id,
          group_id,
          player_id,
          seed_position,
          player:players(id, name)
        ),
        standings:tournament_standings(
          id,
          tournament_id,
          group_id,
          player_id,
          wins,
          losses,
          sets_won,
          sets_lost,
          games_won,
          games_lost,
          head_to_head_wins,
          points,
          game_difference,
          final_position,
          qualified,
          updated_at,
          player:players(id, name)
        )
      `)
      .eq('tournament_id', tournamentId)
      .order('group_number', { ascending: true })

    // Get tournament matches organized by bracket type and round
    const { data: matches, error: matchesError } = await supabase
      .from('tournament_matches')
      .select(`
        *,
        match:matches(
          id,
          player1_id,
          player2_id,
          winner_id,
          status,
          score,
          scheduled_at,
          player1:players!matches_player1_id_fkey(id, name),
          player2:players!matches_player2_id_fkey(id, name),
          winner:players!matches_winner_id_fkey(id, name)
        ),
        group:tournament_groups(
          id,
          group_name,
          group_number
        )
      `)
      .eq('tournament_id', tournamentId)
      .order('round_number', { ascending: true })
      .order('bracket_position', { ascending: true })

    if (groupsError || matchesError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch bracket data',
        data: groupsError || matchesError
      })
    }

    // Organize matches by bracket type and round
    const mainMatches = (matches || []).filter(m => m.bracket_type === 'main')
    const backdrawMatches = (matches || []).filter(m => m.bracket_type === 'backdraw')
    const groupMatches = (matches || []).filter(m => m.bracket_type === 'group')
    
    const bracketData = {
      groups: groups || [],
      main: mainMatches,
      backdraw: backdrawMatches,
      group: groupMatches
    }

    return bracketData
  } catch (error: unknown) {
    handleApiError(error, 'GET /api/tournaments/[id]/bracket')
  }
})

