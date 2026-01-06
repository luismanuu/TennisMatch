import { getSupabaseAdmin } from '~/server/utils/supabase'

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
        *,
        players:tournament_group_players(
          *,
          player:players(*)
        ),
        standings:tournament_standings(
          *,
          player:players(*)
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
    
    // Debug: Log matches by round
    const mainByRound = new Map<number, any[]>()
    mainMatches.forEach((m: any) => {
      const round = m.round_number || 1
      if (!mainByRound.has(round)) {
        mainByRound.set(round, [])
      }
      mainByRound.get(round)!.push(m)
    })
    
    console.log(`[Bracket API] Tournament ${tournamentId} - Main bracket matches by round:`)
    mainByRound.forEach((matches, round) => {
      console.log(`  Round ${round}: ${matches.length} matches`)
      matches.forEach((m: any) => {
        console.log(`    - Match ${m.bracket_position || '?'}: ${m.match_id || 'NO MATCH ID'} (has match: ${!!m.match}, player1: ${m.match?.player1_id || 'null'}, player2: ${m.match?.player2_id || 'null'})`)
      })
    })
    
    const bracketData = {
      groups: groups || [],
      main: mainMatches,
      backdraw: backdrawMatches,
      group: groupMatches
    }

    return bracketData
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

