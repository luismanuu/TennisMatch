import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '../logger'

type TournamentMatchRow = {
  id: string
  tournament_id: string
  bracket_type: 'main' | 'backdraw' | 'group'
  round_number: number | null
  bracket_position: number | null
  match_id: string | null
  is_bye: boolean | null
  player_id?: string | null
}

type RoundMatchRow = {
  id: string
  match_id: string | null
  bracket_position: number | null
  is_bye?: boolean | null
  player_id?: string | null
}

type MatchRow = {
  id: string
  status: string | null
  winner_id: string | null
  player1_id?: string | null
  player2_id?: string | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function toTournamentMatchRow(value: unknown): TournamentMatchRow | null {
  const r = asRecord(value)
  if (!r) return null
  const id = r['id']
  const tournament_id = r['tournament_id']
  const bracket_type = r['bracket_type']
  const round_number = r['round_number']
  const bracket_position = r['bracket_position']
  const match_id = r['match_id']
  const is_bye = r['is_bye']
  const player_id = r['player_id']

  if (typeof id !== 'string') return null
  if (typeof tournament_id !== 'string') return null
  if (bracket_type !== 'main' && bracket_type !== 'backdraw' && bracket_type !== 'group') return null
  if (!(round_number === null || typeof round_number === 'number')) return null
  if (!(bracket_position === null || typeof bracket_position === 'number')) return null
  if (!(match_id === null || typeof match_id === 'string')) return null
  if (!(is_bye === null || typeof is_bye === 'boolean')) return null

  return {
    id,
    tournament_id,
    bracket_type,
    round_number,
    bracket_position,
    match_id,
    is_bye,
    player_id: typeof player_id === 'string' ? player_id : player_id === null ? null : undefined
  }
}

/**
 * Generate single-elimination playoff bracket
 */
export function generatePlayoffBracket(
  players: string[],
  bracketType: 'main' | 'backdraw'
): Array<{
  round: number
  matchNumber: number
  player1_id?: string
  player2_id?: string
  is_bye: boolean
}> {
  const bracket: Array<{
    round: number
    matchNumber: number
    player1_id?: string
    player2_id?: string
    is_bye: boolean
  }> = []

  let round = 1
  let currentRoundPlayers = [...players]

  while (currentRoundPlayers.length > 1) {
    const nextRoundPlayers: string[] = []
    let matchNumber = 1

    for (let i = 0; i < currentRoundPlayers.length; i += 2) {
      if (i + 1 < currentRoundPlayers.length) {
        const p1 = currentRoundPlayers[i]
        const p2 = currentRoundPlayers[i + 1]
        if (!p1 || !p2) continue
        bracket.push({
          round,
          matchNumber: matchNumber++,
          player1_id: p1,
          player2_id: p2,
          is_bye: false
        })
        nextRoundPlayers.push(`winner_${round}_${matchNumber - 1}`)
      } else {
        bracket.push({
          round,
          matchNumber: matchNumber++,
          player1_id: currentRoundPlayers[i],
          is_bye: true
        })
        if (currentRoundPlayers[i]) nextRoundPlayers.push(currentRoundPlayers[i] as string)
      }
    }

    currentRoundPlayers = nextRoundPlayers
    round++
  }

  return bracket
}

export function assignByes(players: string[]): string[] {
  return players
}

export function calculateBracketPositions(roundCount: number): Array<{
  round: number
  matchCount: number
  positions: Array<{ x: number; y: number }>
}> {
  const positions: Array<{
    round: number
    matchCount: number
    positions: Array<{ x: number; y: number }>
  }> = []

  for (let round = 1; round <= roundCount; round++) {
    const matchCount = Math.pow(2, roundCount - round)
    const roundPositions: Array<{ x: number; y: number }> = []

    for (let i = 0; i < matchCount; i++) {
      roundPositions.push({
        x: round * 200,
        y: (i + 1) * 100
      })
    }

    positions.push({
      round,
      matchCount,
      positions: roundPositions
    })
  }

  return positions
}

/**
 * Process a bye match to advance the player to the next round
 */
export async function processByeAdvancement(tournamentMatch: TournamentMatchRow, supabase: SupabaseClient): Promise<void> {
  const playerId = tournamentMatch.player_id
  if (!playerId) {
    logger.debug(`[processByeAdvancement] No player_id found for bye match`)
    return
  }

  logger.debug(
    `[processByeAdvancement] Processing bye for round ${tournamentMatch.round_number}, position ${tournamentMatch.bracket_position}, player ${playerId}`
  )

  const currentRound = tournamentMatch.round_number
  if (typeof currentRound !== 'number') return

  let currentMatchNumber = tournamentMatch.bracket_position

  // If bracket_position is null, calculate it based on match order
  if (currentMatchNumber === null || currentMatchNumber === undefined) {
    logger.debug(`[processByeAdvancement] bracket_position is null, calculating from match order...`)

    const { data: roundMatches, error: roundError } = await supabase
      .from('tournament_matches')
      .select('id, match_id, bracket_position, is_bye, player_id')
      .eq('tournament_id', tournamentMatch.tournament_id)
      .eq('bracket_type', tournamentMatch.bracket_type)
      .eq('round_number', currentRound)
      .order('bracket_position', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true })

    if (roundError) {
      logger.error(`[processByeAdvancement] Error fetching round matches:`, roundError)
      currentMatchNumber = 1
    } else {
      const typedRoundMatches = (roundMatches || []) as unknown as RoundMatchRow[]
      const matchIndex = typedRoundMatches.findIndex((tm) => tm.is_bye === true && tm.id === tournamentMatch.id)
      if (matchIndex >= 0) {
        currentMatchNumber = matchIndex + 1
        logger.debug(`[processByeAdvancement] Calculated bracket_position: ${currentMatchNumber} from match order`)
        await supabase
          .from('tournament_matches')
          .update({ bracket_position: currentMatchNumber })
          .eq('id', tournamentMatch.id)
      } else {
        currentMatchNumber = 1
      }
    }
  }

  if (typeof currentMatchNumber !== 'number') currentMatchNumber = 1

  const nextRound = currentRound + 1
  const nextRoundMatchNumber = Math.ceil(currentMatchNumber / 2)
  const isPlayer1Slot = currentMatchNumber % 2 === 1

  const { data: nextRoundMatchRaw, error: findError } = await supabase
    .from('tournament_matches')
    .select('id, match_id, tournament_id, bracket_type, round_number, bracket_position, is_bye, player_id')
    .eq('tournament_id', tournamentMatch.tournament_id)
    .eq('bracket_type', tournamentMatch.bracket_type)
    .eq('round_number', nextRound)
    .eq('bracket_position', nextRoundMatchNumber)
    .single()

  // PGRST116 = not found
  if (findError && (findError as { code?: string }).code !== 'PGRST116') {
    logger.error('Error finding next round match:', findError)
    return
  }

  const nextRoundMatch = toTournamentMatchRow(nextRoundMatchRaw)

  logger.debug(
    `[processByeAdvancement] Round ${currentRound} Bye ${currentMatchNumber} → Round ${nextRound} Match ${nextRoundMatchNumber} (${isPlayer1Slot ? 'player1' : 'player2'})`
  )

  if (nextRoundMatch && nextRoundMatch.match_id) {
    const updateField = isPlayer1Slot ? 'player1_id' : 'player2_id'
    const { error: updateError } = await supabase
      .from('matches')
      .update({ [updateField]: playerId } as Record<string, unknown>)
      .eq('id', nextRoundMatch.match_id)

    if (updateError) logger.error('Error updating next round match with bye player:', updateError)
    return
  }

  // Create next round match if needed (only if nextRound exists)
  const { data: round1Matches, error: round1Error } = await supabase
    .from('tournament_matches')
    .select('match_id, matches!inner(player1_id, player2_id), player_id, is_bye')
    .eq('tournament_id', tournamentMatch.tournament_id)
    .eq('bracket_type', tournamentMatch.bracket_type)
    .eq('round_number', 1)

  if (round1Error) {
    logger.error('Error fetching round 1 matches:', round1Error)
    return
  }

  const uniquePlayers = new Set<string>()
  ;(round1Matches || []).forEach((tmRaw) => {
    const tm = asRecord(tmRaw)
    if (!tm) return
    if (tm['is_bye'] === true && typeof tm['player_id'] === 'string') {
      uniquePlayers.add(tm['player_id'] as string)
      return
    }
    const m = asRecord(tm['matches'])
    if (!m) return
    if (typeof m['player1_id'] === 'string') uniquePlayers.add(m['player1_id'] as string)
    if (typeof m['player2_id'] === 'string') uniquePlayers.add(m['player2_id'] as string)
  })

  const totalPlayers = uniquePlayers.size
  if (totalPlayers === 0) {
    logger.error('processByeAdvancement: No players found in round 1')
    return
  }

  const totalRounds = Math.ceil(Math.log2(totalPlayers))
  if (nextRound > totalRounds) return

  const matchData: Record<string, unknown> = {
    tournament_id: tournamentMatch.tournament_id,
    status: 'scheduled',
    scheduled_at: null
  }
  if (isPlayer1Slot) matchData.player1_id = playerId
  else matchData.player2_id = playerId

  const { data: newMatchRaw, error: createMatchError } = await supabase.from('matches').insert(matchData).select().single()
  const newMatch = asRecord(newMatchRaw)

  if (createMatchError || !newMatch || typeof newMatch['id'] !== 'string') {
    logger.error('Error creating next round match for bye:', createMatchError)
    return
  }

  const { error: createTmError } = await supabase.from('tournament_matches').insert({
    tournament_id: tournamentMatch.tournament_id,
    match_id: newMatch['id'],
    bracket_type: tournamentMatch.bracket_type,
    round_number: nextRound,
    bracket_position: nextRoundMatchNumber,
    is_bye: false
  })

  if (createTmError) logger.error('Error creating tournament match record for bye:', createTmError)
}

/**
 * Update bracket after match completion
 */
export async function updateBracketAfterMatch(matchId: string, winnerId: string, supabase: SupabaseClient): Promise<void> {
  logger.debug(`[updateBracketAfterMatch] Called for match ${matchId}, winner ${winnerId}`)

  const { data: tournamentMatchRaw, error: tmError } = await supabase
    .from('tournament_matches')
    .select('id, tournament_id, bracket_type, round_number, bracket_position, is_bye, match_id, player_id')
    .eq('match_id', matchId)
    .single()

  if (tmError || !tournamentMatchRaw) return
  const tournamentMatch = toTournamentMatchRow(tournamentMatchRaw)
  if (!tournamentMatch) return

  if (tournamentMatch.is_bye) {
    await processByeAdvancement(tournamentMatch, supabase)
    return
  }

  if (tournamentMatch.bracket_type !== 'main' && tournamentMatch.bracket_type !== 'backdraw') return

  const currentRound = tournamentMatch.round_number
  if (typeof currentRound !== 'number') return

  let currentMatchNumber = tournamentMatch.bracket_position

  if (currentMatchNumber === null || currentMatchNumber === undefined) {
    const { data: roundMatches, error: roundError } = await supabase
      .from('tournament_matches')
      .select('id, match_id, bracket_position')
      .eq('tournament_id', tournamentMatch.tournament_id)
      .eq('bracket_type', tournamentMatch.bracket_type)
      .eq('round_number', currentRound)
      .order('bracket_position', { ascending: true, nullsFirst: false })
      .order('match_id', { ascending: true })

    if (roundError) currentMatchNumber = 1
    else {
      const typedRoundMatches = (roundMatches || []) as unknown as Array<{ match_id: string | null }>
      const matchIndex = typedRoundMatches.findIndex((tm) => tm.match_id === matchId)
      currentMatchNumber = matchIndex >= 0 ? matchIndex + 1 : 1
      await supabase.from('tournament_matches').update({ bracket_position: currentMatchNumber }).eq('id', tournamentMatch.id)
    }
  }

  if (typeof currentMatchNumber !== 'number') currentMatchNumber = 1

  const nextRound = currentRound + 1
  const nextRoundMatchNumber = Math.ceil(currentMatchNumber / 2)
  const isPlayer1Slot = currentMatchNumber % 2 === 1

  const { data: nextRoundMatchRaw, error: findError } = await supabase
    .from('tournament_matches')
    .select('id, match_id, tournament_id, bracket_type, round_number, bracket_position, is_bye, player_id')
    .eq('tournament_id', tournamentMatch.tournament_id)
    .eq('bracket_type', tournamentMatch.bracket_type)
    .eq('round_number', nextRound)
    .eq('bracket_position', nextRoundMatchNumber)
    .single()

  if (findError && (findError as { code?: string }).code !== 'PGRST116') return

  const nextRoundMatch = toTournamentMatchRow(nextRoundMatchRaw)
  if (nextRoundMatch && nextRoundMatch.match_id) {
    const updateField = isPlayer1Slot ? 'player1_id' : 'player2_id'
    await supabase.from('matches').update({ [updateField]: winnerId } as Record<string, unknown>).eq('id', nextRoundMatch.match_id)
    return
  }

  const { data: round1Matches, error: round1Error } = await supabase
    .from('tournament_matches')
    .select('match_id, matches!inner(player1_id, player2_id)')
    .eq('tournament_id', tournamentMatch.tournament_id)
    .eq('bracket_type', tournamentMatch.bracket_type)
    .eq('round_number', 1)

  if (round1Error) return

  const uniquePlayers = new Set<string>()
  ;(round1Matches || []).forEach((tmRaw) => {
    const tm = asRecord(tmRaw)
    const m = tm ? asRecord(tm['matches']) : null
    if (!m) return
    if (typeof m['player1_id'] === 'string') uniquePlayers.add(m['player1_id'] as string)
    if (typeof m['player2_id'] === 'string') uniquePlayers.add(m['player2_id'] as string)
  })

  const totalPlayers = uniquePlayers.size
  if (totalPlayers === 0) return

  const totalRounds = Math.ceil(Math.log2(totalPlayers))
  if (nextRound > totalRounds) return

  const matchData: Record<string, unknown> = {
    tournament_id: tournamentMatch.tournament_id,
    status: 'scheduled',
    scheduled_at: null
  }
  if (isPlayer1Slot) matchData.player1_id = winnerId
  else matchData.player2_id = winnerId

  const { data: newMatchRaw, error: createMatchError } = await supabase.from('matches').insert(matchData).select().single()
  const newMatch = asRecord(newMatchRaw)
  if (createMatchError || !newMatch || typeof newMatch['id'] !== 'string') return

  await supabase.from('tournament_matches').insert({
    tournament_id: tournamentMatch.tournament_id,
    match_id: newMatch['id'],
    bracket_type: tournamentMatch.bracket_type,
    round_number: nextRound,
    bracket_position: nextRoundMatchNumber,
    is_bye: false
  })
}

/**
 * Update bracket progression for all completed playoff matches in a tournament
 */
export async function updateBracketFromCompletedMatches(
  tournamentId: string,
  bracketType: 'main' | 'backdraw' | 'all',
  supabase: SupabaseClient
): Promise<void> {
  const bracketTypes = bracketType === 'all' ? (['main', 'backdraw'] as const) : ([bracketType] as const)

  for (const bt of bracketTypes) {
    const { data: tournamentMatches, error: tmError } = await supabase
      .from('tournament_matches')
      .select('id, match_id, round_number, bracket_position, is_bye, player_id, tournament_id, bracket_type')
      .eq('tournament_id', tournamentId)
      .eq('bracket_type', bt)
      .order('round_number', { ascending: true })
      .order('bracket_position', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true })

    if (tmError || !tournamentMatches || tournamentMatches.length === 0) continue

    const typedTournamentMatches = (tournamentMatches as unknown[]).map(toTournamentMatchRow).filter((x): x is TournamentMatchRow => !!x)
    const matchIds = typedTournamentMatches.map((tm) => tm.match_id).filter((id): id is string => typeof id === 'string')
    if (matchIds.length === 0) continue

    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select('id, status, winner_id')
      .in('id', matchIds)

    if (matchesError) continue
    const typedMatches = (matches || []) as unknown as MatchRow[]

    const completedMatches = typedTournamentMatches.map((tm) => {
      const match = typedMatches.find((m) => m.id === tm.match_id) || null
      return { tm, match }
    })

    const byeMatches = typedTournamentMatches.filter((tm) => tm.is_bye === true)
    for (const tm of byeMatches) {
      if (tm.player_id) {
        try {
          await processByeAdvancement(tm, supabase)
        } catch (err) {
          logger.error(`[updateBracketFromCompletedMatches] Error processing bye:`, err)
        }
      }
    }

    const matchesToProcess = completedMatches.filter((x) => x.match?.status === 'completed' && !!x.match?.winner_id)
    for (const x of matchesToProcess) {
      if (x.tm.match_id && x.match?.winner_id) {
        try {
          await updateBracketAfterMatch(x.tm.match_id, x.match.winner_id, supabase)
        } catch (err) {
          logger.error(`[updateBracketFromCompletedMatches] Error processing match ${x.tm.match_id}:`, err)
        }
      }
    }
  }
}

