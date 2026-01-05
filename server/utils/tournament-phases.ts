import { getSupabaseAdmin } from './supabase'

/**
 * Check if group stage is complete (all matches completed)
 * @param tournamentId - Tournament ID
 * @param supabase - Supabase admin client
 * @returns Object with isComplete boolean and details
 */
export async function checkGroupStageComplete(
  tournamentId: string,
  supabase: any
): Promise<{ isComplete: boolean; totalMatches: number; completedMatches: number; pendingMatches: number }> {
  // Get all group matches for this tournament
  const { data: groupMatches, error } = await supabase
    .from('tournament_matches')
    .select(`
      match:matches(
        id,
        status,
        winner_id
      )
    `)
    .eq('tournament_id', tournamentId)
    .eq('bracket_type', 'group')

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to check group stage status',
      data: error
    })
  }

  const totalMatches = groupMatches?.length || 0
  const completedMatches = groupMatches?.filter((tm: any) => 
    tm.match?.status === 'completed' && tm.match?.winner_id
  ).length || 0
  const pendingMatches = totalMatches - completedMatches

  return {
    isComplete: totalMatches > 0 && pendingMatches === 0,
    totalMatches,
    completedMatches,
    pendingMatches
  }
}

/**
 * Check if playoffs are complete (all matches completed)
 * @param tournamentId - Tournament ID
 * @param bracketType - 'main' or 'backdraw'
 * @param supabase - Supabase admin client
 * @returns Object with isComplete boolean and details
 */
export async function checkPlayoffsComplete(
  tournamentId: string,
  bracketType: 'main' | 'backdraw',
  supabase: any
): Promise<{ isComplete: boolean; totalMatches: number; completedMatches: number; pendingMatches: number }> {
  // Get all playoff matches for this tournament and bracket type
  const { data: playoffMatches, error } = await supabase
    .from('tournament_matches')
    .select(`
      match:matches(
        id,
        status,
        winner_id
      )
    `)
    .eq('tournament_id', tournamentId)
    .eq('bracket_type', bracketType)

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to check playoffs status',
      data: error
    })
  }

  const totalMatches = playoffMatches?.length || 0
  const completedMatches = playoffMatches?.filter((tm: any) => 
    tm.match?.status === 'completed' && tm.match?.winner_id
  ).length || 0
  const pendingMatches = totalMatches - completedMatches

  return {
    isComplete: totalMatches > 0 && pendingMatches === 0,
    totalMatches,
    completedMatches,
    pendingMatches
  }
}

/**
 * Get current phase status for a tournament
 * @param tournamentId - Tournament ID
 * @param supabase - Supabase admin client
 * @returns Phase status object
 */
export async function getTournamentPhaseStatus(
  tournamentId: string,
  supabase: any
): Promise<{
  currentPhase: string
  groupStageStatus?: { isComplete: boolean; totalMatches: number; completedMatches: number; pendingMatches: number }
  mainPlayoffsStatus?: { isComplete: boolean; totalMatches: number; completedMatches: number; pendingMatches: number }
  backdrawPlayoffsStatus?: { isComplete: boolean; totalMatches: number; completedMatches: number; pendingMatches: number }
  canAdvanceToPlayoffs: boolean
  canCompleteTournament: boolean
}> {
  // Get tournament info
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('current_phase, tournament_type')
    .eq('id', tournamentId)
    .single()

  if (tournamentError || !tournament) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Tournament not found'
    })
  }

  // Check if tournament has groups
  const { data: groups, error: groupsError } = await supabase
    .from('tournament_groups')
    .select('id')
    .eq('tournament_id', tournamentId)
    .limit(1)

  const currentPhase = tournament.current_phase || 'registration'
  const hasGroups = groups && groups.length > 0

  let groupStageStatus
  let mainPlayoffsStatus
  let backdrawPlayoffsStatus
  let canAdvanceToPlayoffs = false
  let canCompleteTournament = false

  // Check group stage if tournament has groups
  if (hasGroups && currentPhase === 'group_stage') {
    groupStageStatus = await checkGroupStageComplete(tournamentId, supabase)
    canAdvanceToPlayoffs = groupStageStatus.isComplete
  }

  // Check playoffs if tournament is in playoffs phase
  if (currentPhase === 'playoffs') {
    // Check if groups exist (groups_playoffs format)
    if (hasGroups) {
      mainPlayoffsStatus = await checkPlayoffsComplete(tournamentId, 'main', supabase)
      backdrawPlayoffsStatus = await checkPlayoffsComplete(tournamentId, 'backdraw', supabase)
      canCompleteTournament = mainPlayoffsStatus.isComplete && backdrawPlayoffsStatus.isComplete
    } else {
      // Single elimination format
      mainPlayoffsStatus = await checkPlayoffsComplete(tournamentId, 'main', supabase)
      canCompleteTournament = mainPlayoffsStatus.isComplete
    }
  }

  return {
    currentPhase,
    groupStageStatus,
    mainPlayoffsStatus,
    backdrawPlayoffsStatus,
    canAdvanceToPlayoffs,
    canCompleteTournament
  }
}

/**
 * Advance tournament to next phase
 * @param tournamentId - Tournament ID
 * @param supabase - Supabase admin client
 * @returns New phase
 */
export async function advanceTournamentPhase(
  tournamentId: string,
  supabase: any
): Promise<string> {
  // Get current tournament phase
  const phaseStatus = await getTournamentPhaseStatus(tournamentId, supabase)

  let newPhase: string

  if (phaseStatus.currentPhase === 'registration') {
    // Can only advance to group_stage if brackets are generated
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('groups')
      .eq('id', tournamentId)
      .single()

    if (tournament?.groups && tournament.groups.length > 0) {
      newPhase = 'group_stage'
    } else {
      throw createError({
        statusCode: 400,
        statusMessage: 'Cannot advance to group stage: brackets not generated yet'
      })
    }
  } else if (phaseStatus.currentPhase === 'group_stage') {
    if (!phaseStatus.canAdvanceToPlayoffs) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Cannot advance to playoffs: group stage not complete'
      })
    }
    newPhase = 'playoffs'
  } else if (phaseStatus.currentPhase === 'playoffs') {
    if (!phaseStatus.canCompleteTournament) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Cannot complete tournament: playoffs not complete'
      })
    }
    newPhase = 'completed'
  } else {
    throw createError({
      statusCode: 400,
      statusMessage: `Cannot advance from phase: ${phaseStatus.currentPhase}`
    })
  }

  // Update tournament phase
  const { error: updateError } = await supabase
    .from('tournaments')
    .update({
      current_phase: newPhase,
      updated_at: new Date().toISOString()
    })
    .eq('id', tournamentId)

  if (updateError) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to advance tournament phase',
      data: updateError
    })
  }

  // If advancing to completed, also update status
  if (newPhase === 'completed') {
    await supabase
      .from('tournaments')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', tournamentId)
  }

  return newPhase
}

