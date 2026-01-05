import { getSupabaseAdmin } from './supabase'

/**
 * Create group stage deadline (one deadline for all group matches)
 * @param tournamentId - Tournament ID
 * @param deadline - Deadline timestamp
 * @param supabase - Supabase admin client
 */
export async function createGroupStageDeadline(
  tournamentId: string,
  deadline: string,
  supabase: any
): Promise<void> {
  // Check if group stage round already exists
  const { data: existingRound } = await supabase
    .from('tournament_rounds')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('bracket_type', 'group')
    .eq('round_number', 1)
    .single()

  if (existingRound) {
    // Update existing deadline
    const { error } = await supabase
      .from('tournament_rounds')
      .update({
        deadline,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingRound.id)

    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to update group stage deadline',
        data: error
      })
    }
  } else {
    // Create new deadline
    const { error } = await supabase
      .from('tournament_rounds')
      .insert({
        tournament_id: tournamentId,
        round_number: 1,
        round_name: 'Group Stage',
        bracket_type: 'group',
        deadline,
        status: 'upcoming'
      })

    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to create group stage deadline',
        data: error
      })
    }
  }

  // Update all group matches with this deadline
  const { error: updateError } = await supabase
    .from('tournament_matches')
    .update({ round_deadline: deadline })
    .eq('tournament_id', tournamentId)
    .eq('bracket_type', 'group')

  if (updateError) {
    console.error('Error updating group match deadlines:', updateError)
  }
}

/**
 * Create playoff round deadlines (individual deadline per round)
 * @param tournamentId - Tournament ID
 * @param bracketType - 'main' or 'backdraw'
 * @param rounds - Array of round configurations
 * @param supabase - Supabase admin client
 */
export async function createPlayoffRoundDeadlines(
  tournamentId: string,
  bracketType: 'main' | 'backdraw',
  rounds: Array<{
    round_number: number
    round_name: string
    deadline: string
  }>,
  supabase: any
): Promise<void> {
  for (const round of rounds) {
    // Check if round already exists
    const { data: existingRound } = await supabase
      .from('tournament_rounds')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('bracket_type', bracketType)
      .eq('round_number', round.round_number)
      .single()

    if (existingRound) {
      // Update existing deadline
      const { error } = await supabase
        .from('tournament_rounds')
        .update({
          deadline: round.deadline,
          round_name: round.round_name,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingRound.id)

      if (error) {
        throw createError({
          statusCode: 500,
          statusMessage: `Failed to update ${bracketType} ${round.round_name} deadline`,
          data: error
        })
      }
    } else {
      // Create new deadline
      const { error } = await supabase
        .from('tournament_rounds')
        .insert({
          tournament_id: tournamentId,
          round_number: round.round_number,
          round_name: round.round_name,
          bracket_type: bracketType,
          deadline: round.deadline,
          status: 'upcoming'
        })

      if (error) {
        throw createError({
          statusCode: 500,
          statusMessage: `Failed to create ${bracketType} ${round.round_name} deadline`,
          data: error
        })
      }
    }

    // Update all matches in this round with the deadline
    const { error: updateError } = await supabase
      .from('tournament_matches')
      .update({ round_deadline: round.deadline })
      .eq('tournament_id', tournamentId)
      .eq('bracket_type', bracketType)
      .eq('round_number', round.round_number)

    if (updateError) {
      console.error(`Error updating ${bracketType} round ${round.round_number} match deadlines:`, updateError)
    }
  }
}

/**
 * Extend round deadline
 * @param tournamentId - Tournament ID
 * @param roundId - Round ID
 * @param newDeadline - New deadline timestamp
 * @param supabase - Supabase admin client
 */
export async function extendRoundDeadline(
  tournamentId: string,
  roundId: string,
  newDeadline: string,
  supabase: any
): Promise<void> {
  // Get round info
  const { data: round, error: roundError } = await supabase
    .from('tournament_rounds')
    .select('*')
    .eq('id', roundId)
    .eq('tournament_id', tournamentId)
    .single()

  if (roundError || !round) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Round not found'
    })
  }

  // Update round deadline
  const { error: updateError } = await supabase
    .from('tournament_rounds')
    .update({
      deadline: newDeadline,
      updated_at: new Date().toISOString()
    })
    .eq('id', roundId)

  if (updateError) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to extend deadline',
      data: updateError
    })
  }

  // Update all matches in this round
  const { error: matchUpdateError } = await supabase
    .from('tournament_matches')
    .update({ round_deadline: newDeadline })
    .eq('tournament_id', tournamentId)
    .eq('bracket_type', round.bracket_type)
    .eq('round_number', round.round_number)

  if (matchUpdateError) {
    console.error('Error updating match deadlines:', matchUpdateError)
  }
}

/**
 * Get unscheduled matches for a tournament
 * @param tournamentId - Tournament ID
 * @param supabase - Supabase admin client
 * @returns Array of unscheduled matches
 */
export async function getUnscheduledMatches(
  tournamentId: string,
  supabase: any
): Promise<any[]> {
  const { data: matches, error } = await supabase
    .from('tournament_matches')
    .select(`
      *,
      match:matches(
        id,
        player1_id,
        player2_id,
        scheduled_at,
        status
      )
    `)
    .eq('tournament_id', tournamentId)
    .is('match.scheduled_at', null)

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch unscheduled matches',
      data: error
    })
  }

  return matches || []
}

/**
 * Get round deadline for a match
 * @param tournamentId - Tournament ID
 * @param bracketType - 'group', 'main', or 'backdraw'
 * @param roundNumber - Round number
 * @param supabase - Supabase admin client
 * @returns Deadline timestamp or null
 */
async function getRoundDeadline(
  tournamentId: string,
  bracketType: 'group' | 'main' | 'backdraw',
  roundNumber: number,
  supabase: any
): Promise<string | null> {
  const { data: round, error } = await supabase
    .from('tournament_rounds')
    .select('deadline')
    .eq('tournament_id', tournamentId)
    .eq('bracket_type', bracketType)
    .eq('round_number', roundNumber)
    .single()

  if (error || !round) {
    return null
  }

  return round.deadline
}

/**
 * Validate match scheduling against round deadline
 * @param scheduledAt - Proposed scheduled time
 * @param roundDeadline - Round deadline
 * @returns true if valid, throws error if invalid
 */
function validateMatchScheduling(
  scheduledAt: string,
  roundDeadline: string | null
): boolean {
  if (!roundDeadline) {
    return true // No deadline set
  }

  const scheduled = new Date(scheduledAt)
  const deadline = new Date(roundDeadline)

  if (scheduled > deadline) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Match must be scheduled before round deadline'
    })
  }

  return true
}

/**
 * Validate and set match scheduling for tournament matches
 * @param matchId - Match ID
 * @param scheduledAt - Proposed scheduled time
 * @param supabase - Supabase admin client
 * @returns true if valid
 */
export async function validateAndSetMatchScheduling(
  matchId: string,
  scheduledAt: string,
  supabase: any
): Promise<boolean> {
  // Get tournament match info
  const { data: tournamentMatch, error: tmError } = await supabase
    .from('tournament_matches')
    .select('tournament_id, bracket_type, round_number, round_deadline')
    .eq('match_id', matchId)
    .single()

  if (tmError || !tournamentMatch) {
    // Not a tournament match, allow scheduling
    return true
  }

  // Validate against deadline
  const deadline = tournamentMatch.round_deadline || await getRoundDeadline(
    tournamentMatch.tournament_id,
    tournamentMatch.bracket_type,
    tournamentMatch.round_number || 1,
    supabase
  )

  validateMatchScheduling(scheduledAt, deadline)

  return true
}

