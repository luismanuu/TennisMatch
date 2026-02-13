import { getSupabaseAdmin } from './supabase'
import { 
  calculateGroupStandings, 
  determineGroupQualifiers, 
  generatePlayoffBracket,
  recalculateGroupStandings 
} from './tournament-brackets'
import { logger } from './logger'
import type { Tournament } from '~/types'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Check if group stage is complete (all matches completed)
 * @param tournamentId - Tournament ID
 * @param supabase - Supabase admin client
 * @returns Object with isComplete boolean and details
 */
export async function checkGroupStageComplete(
  tournamentId: string,
  supabase: SupabaseClient
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
  const typedGroupMatches = (groupMatches || []) as unknown as Array<{ match?: { status?: string | null; winner_id?: string | null } | null }>
  const completedMatches = typedGroupMatches.filter((tm) => tm.match?.status === 'completed' && !!tm.match?.winner_id).length
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
  supabase: SupabaseClient
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
  const typedPlayoffMatches = (playoffMatches || []) as unknown as Array<{ match?: { status?: string | null; winner_id?: string | null } | null }>
  const completedMatches = typedPlayoffMatches.filter((tm) => tm.match?.status === 'completed' && !!tm.match?.winner_id).length
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
  supabase: SupabaseClient
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
  supabase: SupabaseClient
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
    
    // Generate playoff brackets automatically
    await generatePlayoffBracketsFromGroups(tournamentId, supabase)
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

/**
 * Generate playoff brackets from completed group stage
 * @param tournamentId - Tournament ID
 * @param supabase - Supabase admin client
 */
async function generatePlayoffBracketsFromGroups(
  tournamentId: string,
  supabase: SupabaseClient
): Promise<void> {
  // Get tournament info
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

  // Check if playoff brackets already exist
  const { data: existingPlayoffs } = await supabase
    .from('tournament_matches')
    .select('id')
    .eq('tournament_id', tournamentId)
    .in('bracket_type', ['main', 'backdraw'])
    .limit(1)

  if (existingPlayoffs && existingPlayoffs.length > 0) {
    // Playoffs already generated, skip
    return
  }

  // Get all groups
  const { data: groups, error: groupsError } = await supabase
    .from('tournament_groups')
    .select('id, group_number')
    .eq('tournament_id', tournamentId)
    .order('group_number', { ascending: true })

  if (groupsError || !groups || groups.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No groups found for tournament'
    })
  }

  // Calculate standings for each group and determine qualifiers
  const groupsWithStandings: Array<{
    groupId: string
    players: Array<{
      playerId: string
      wins: number
      losses: number
      sets_won: number
      sets_lost: number
      games_won: number
      games_lost: number
      points: number
      game_difference: number
      head_to_head: Map<string, number>
    }>
  }> = []

  for (const group of groups) {
    // Recalculate standings for this group
    await recalculateGroupStandings(tournamentId, group.id, supabase)

    // Get group matches to calculate standings
    const { data: groupMatches, error: matchesError } = await supabase
      .from('tournament_matches')
      .select(`
        matches!inner(
          player1_id,
          player2_id,
          winner_id,
          score,
          status
        )
      `)
      .eq('tournament_id', tournamentId)
      .eq('group_id', group.id)
      .eq('bracket_type', 'group')

    if (matchesError) {
      logger.error('Error fetching matches for group', matchesError, { groupId: group.id, tournamentId })
      continue
    }

    // Calculate standings with head-to-head
    const completedMatches = (groupMatches || [])
      .map((tm) => (tm && typeof tm === 'object' ? (tm as Record<string, unknown>) : null))
      .filter((tm): tm is Record<string, unknown> => !!tm)
      .map((tm) => (tm['matches'] && typeof tm['matches'] === 'object') ? (tm['matches'] as Record<string, unknown>) : null)
      .filter((m): m is Record<string, unknown> => !!m)
      .filter((m) => m['status'] === 'completed' && typeof m['winner_id'] === 'string')
      .map((m) => ({
        player1_id: String(m['player1_id']),
        player2_id: String(m['player2_id']),
        winner_id: String(m['winner_id']),
        score: typeof m['score'] === 'string' ? m['score'] : undefined
      }))

    const calculatedStandings = calculateGroupStandings(
      group.id,
      completedMatches,
      tournament as Tournament
    )

    // Convert standings to array format
    const playersArray = Array.from(calculatedStandings.entries()).map(([playerId, standing]) => ({
      playerId,
      ...standing
    }))

    groupsWithStandings.push({
      groupId: group.id,
      players: playersArray
    })
  }

  // Determine qualifiers (top 2 from each group for main bracket, rest for backdraw)
  const advanceCount = 2 // Top 2 advance to main bracket
  const mainQualifiers = determineGroupQualifiers(groupsWithStandings, advanceCount)

  // Get all players who didn't qualify for main bracket
  const allGroupPlayers = new Set<string>()
  groupsWithStandings.forEach(g => {
    g.players.forEach(p => allGroupPlayers.add(p.playerId))
  })
  const backdrawQualifiers = Array.from(allGroupPlayers).filter(
    playerId => !mainQualifiers.includes(playerId)
  )

  // Randomize qualifiers before generating brackets (shuffle arrays)
  const shuffleArray = <T>(array: T[]): T[] => {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const temp = shuffled[i]!
      shuffled[i] = shuffled[j]!
      shuffled[j] = temp
    }
    return shuffled
  }

  const randomizedMainQualifiers = shuffleArray(mainQualifiers)
  const randomizedBackdrawQualifiers = shuffleArray(backdrawQualifiers)

  // Generate main bracket
  if (randomizedMainQualifiers.length > 0) {
    const mainBracket = generatePlayoffBracket(randomizedMainQualifiers, 'main')
    await createPlayoffMatches(tournamentId, mainBracket, 'main', supabase)
  }

  // Generate backdraw bracket (if there are players)
  if (randomizedBackdrawQualifiers.length > 0) {
    const backdrawBracket = generatePlayoffBracket(randomizedBackdrawQualifiers, 'backdraw')
    await createPlayoffMatches(tournamentId, backdrawBracket, 'backdraw', supabase)
  }
}

/**
 * Create playoff matches in database
 * @param tournamentId - Tournament ID
 * @param bracket - Bracket structure from generatePlayoffBracket
 * @param bracketType - 'main' or 'backdraw'
 * @param supabase - Supabase admin client
 */
async function createPlayoffMatches(
  tournamentId: string,
  bracket: Array<{
    round: number
    matchNumber: number
    player1_id?: string
    player2_id?: string
    is_bye: boolean
  }>,
  bracketType: 'main' | 'backdraw',
  supabase: SupabaseClient
): Promise<void> {
  const tournamentMatchRecords: Array<{
    tournament_id: string
    match_id: string
    bracket_type: 'main' | 'backdraw'
    round_number: number
    bracket_position: number
    is_bye: boolean
  }> = []

  for (const bracketMatch of bracket) {
    // Skip bye matches (they don't need actual match records)
    if (bracketMatch.is_bye) {
      continue
    }

    // Only create matches for the first round (round 1) where we have actual player IDs
    // Subsequent rounds will be created when previous round matches complete
    if (bracketMatch.round !== 1) {
      continue
    }

    if (!bracketMatch.player1_id || !bracketMatch.player2_id) {
      continue
    }

    // Validate that player IDs are actual UUIDs, not placeholders
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(bracketMatch.player1_id) || !uuidRegex.test(bracketMatch.player2_id)) {
      continue
    }

    // Create match record
    const { data: matchRecord, error: matchError } = await supabase
      .from('matches')
      .insert({
        player1_id: bracketMatch.player1_id,
        player2_id: bracketMatch.player2_id,
        tournament_id: tournamentId,
        status: 'scheduled',
        scheduled_at: null // Players will schedule later
      })
      .select()
      .single()

    if (matchError || !matchRecord) {
      logger.error('Error creating playoff match', matchError, { tournamentId, bracketType })
      continue
    }

    // Create tournament match record
    tournamentMatchRecords.push({
      tournament_id: tournamentId,
      match_id: matchRecord.id,
      bracket_type: bracketType,
      round_number: bracketMatch.round,
      bracket_position: bracketMatch.matchNumber,
      is_bye: false
    })
  }

  // Insert tournament matches
  if (tournamentMatchRecords.length > 0) {
    const { error: tmError } = await supabase
      .from('tournament_matches')
      .insert(tournamentMatchRecords)

    if (tmError) {
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to create ${bracketType} playoff matches`,
        data: tmError
      })
    }
  }
}

