import { getSupabaseAdmin } from './supabase'
import type { Tournament, TournamentGroup, TournamentMatch } from '~/types'

/**
 * Get default points configuration
 * @returns Default points configuration object
 */
export function getDefaultPointsConfig(): {
  group_stage: number
  playoffs: number
} {
  return {
    group_stage: 3,
    playoffs: 5
  }
}

/**
 * Get points value for a match based on tournament configuration
 * @param tournament - Tournament object with points_config
 * @param bracketType - 'group', 'main', or 'backdraw'
 * @param roundNumber - Round number (for playoffs: 1=quarterfinals, 2=semifinals, 3=final)
 * @returns Points value for winning this match
 */
export function getPointsForMatch(
  tournament: Tournament,
  bracketType: 'group' | 'main' | 'backdraw',
  roundNumber?: number
): number {
  const pointsConfig = tournament.points_config || getDefaultPointsConfig()
  
  if (bracketType === 'group') {
    return pointsConfig.group_stage || 3
  } else {
    // Playoffs (main or backdraw)
    if (typeof pointsConfig.playoffs === 'number') {
      return pointsConfig.playoffs
    } else if (pointsConfig.playoffs && typeof pointsConfig.playoffs === 'object') {
      // Per-round configuration
      const roundPoints: Record<number, number> = {
        1: pointsConfig.playoffs.quarterfinals || 5,
        2: pointsConfig.playoffs.semifinals || 7,
        3: pointsConfig.playoffs.final || 10
      }
      return roundPoints[roundNumber || 1] || 5
    } else {
      return 5 // Default playoff points
    }
  }
}

/**
 * Calculate total points for a player across all tournament matches
 * @param playerId - Player ID
 * @param matches - Array of completed matches with tournament info
 * @param tournament - Tournament object
 * @returns Total accumulated points
 */
export function calculatePlayerPoints(
  playerId: string,
  matches: Array<{
    player1_id: string
    player2_id: string
    winner_id?: string
    bracket_type?: 'group' | 'main' | 'backdraw'
    round_number?: number
  }>,
  tournament: Tournament
): number {
  let totalPoints = 0
  
  matches.forEach(match => {
    // Only count matches where this player won
    if (match.winner_id === playerId && match.bracket_type && match.round_number !== undefined) {
      const points = getPointsForMatch(tournament, match.bracket_type, match.round_number)
      totalPoints += points
    }
  })
  
  return totalPoints
}

/**
 * Create groups by randomly distributing players
 * @param players - Array of player IDs
 * @param groupSize - Number of players per group
 * @returns Array of groups with assigned players
 */
export function createGroups(
  players: string[],
  groupSize: number
): Array<{ players: string[]; groupNumber: number }> {
  // Shuffle players randomly
  const shuffled = [...players].sort(() => Math.random() - 0.5)
  
  const groups: Array<{ players: string[]; groupNumber: number }> = []
  let groupNumber = 1
  
  for (let i = 0; i < shuffled.length; i += groupSize) {
    const groupPlayers = shuffled.slice(i, i + groupSize)
    groups.push({
      players: groupPlayers,
      groupNumber: groupNumber++
    })
  }
  
  return groups
}

/**
 * Generate round-robin matches for a group
 * @param groupPlayers - Array of player IDs in the group
 * @param tournamentId - Tournament ID
 * @param groupId - Group ID
 * @returns Array of match pairs (player1_id, player2_id)
 */
export function generateGroupMatches(
  groupPlayers: string[]
): Array<{ player1_id: string; player2_id: string }> {
  const matches: Array<{ player1_id: string; player2_id: string }> = []
  
  // Round-robin: each player plays every other player
  for (let i = 0; i < groupPlayers.length; i++) {
    for (let j = i + 1; j < groupPlayers.length; j++) {
      matches.push({
        player1_id: groupPlayers[i],
        player2_id: groupPlayers[j]
      })
    }
  }
  
  return matches
}

/**
 * Calculate group standings from matches
 * @param groupId - Group ID
 * @param matches - Array of completed matches
 * @param tournament - Tournament object (optional, for points calculation)
 * @returns Standings for each player
 */
export function calculateGroupStandings(
  groupId: string,
  matches: Array<{
    player1_id: string
    player2_id: string
    winner_id?: string
    score?: string
  }>,
  tournament?: Tournament
): Map<string, {
  wins: number
  losses: number
  sets_won: number
  sets_lost: number
  games_won: number
  games_lost: number
  points: number
  game_difference: number
  head_to_head: Map<string, number>
}> {
  const standings = new Map<string, any>()
  
  // Initialize standings for all players in group
  const allPlayers = new Set<string>()
  matches.forEach(m => {
    allPlayers.add(m.player1_id)
    allPlayers.add(m.player2_id)
  })
  
  allPlayers.forEach(playerId => {
    standings.set(playerId, {
      wins: 0,
      losses: 0,
      sets_won: 0,
      sets_lost: 0,
      games_won: 0,
      games_lost: 0,
      points: 0,
      game_difference: 0,
      head_to_head: new Map<string, number>()
    })
  })
  
  // Get points per win for group stage
  const pointsPerWin = tournament ? getPointsForMatch(tournament, 'group') : 3
  
  // Process matches
  matches.forEach(match => {
    if (!match.winner_id || !match.score) return
    
    const player1Standing = standings.get(match.player1_id)!
    const player2Standing = standings.get(match.player2_id)!
    
    // Check if it's a walkover (WO)
    const isWalkover = match.score.trim().toUpperCase() === 'WO'
    
    let player1Sets = 0
    let player2Sets = 0
    let player1Games = 0
    let player2Games = 0
    
    if (!isWalkover) {
      // Parse score with robust error handling for various formats
      // Handles: "6-4, 6-3", "6-4,6-3", "6-4, 6-3, 6-2", "8-6" (pro set), "6-4 6-3" (space instead of comma)
      let scoreToParse = match.score.trim()
      
      // Normalize: replace multiple spaces with single space, then replace space-comma or comma-space patterns
      scoreToParse = scoreToParse.replace(/\s+/g, ' ') // Multiple spaces -> single space
      scoreToParse = scoreToParse.replace(/\s*,\s*/g, ',') // Normalize comma spacing
      scoreToParse = scoreToParse.replace(/\s+/g, ',') // Replace remaining spaces with commas (handles "6-4 6-3")
      
      // Split by comma or treat as single set if no comma
      const sets = scoreToParse.includes(',')
        ? scoreToParse.split(',').map(s => s.trim()).filter(s => s.length > 0)
        : [scoreToParse.trim()]
      
      let parsedSets: Array<{ p1Games: number; p2Games: number }> = []
      
      sets.forEach(set => {
        // Clean up the set string: remove extra spaces, handle various dash formats
        const cleanedSet = set.trim().replace(/\s*-\s*/g, '-') // Normalize dash spacing
        
        // Split by dash
        const parts = cleanedSet.split('-')
        if (parts.length !== 2) {
          // Invalid format, skip this set
          return
        }
        
        // Parse games, handling non-numeric characters
        const p1Games = parseInt(parts[0].replace(/[^0-9]/g, '')) || 0 // Extract only digits
        const p2Games = parseInt(parts[1].replace(/[^0-9]/g, '')) || 0 // Extract only digits
        
        // Only process if we got valid numbers
        if (p1Games > 0 || p2Games > 0) {
          parsedSets.push({ p1Games, p2Games })
        }
      })
      
      // Determine winner based on parsed scores
      let scoreBasedWinnerIsPlayer1 = false
      let p1SetsFromScore = 0
      let p2SetsFromScore = 0
      
      parsedSets.forEach(set => {
        if (set.p1Games > set.p2Games) {
          p1SetsFromScore++
          scoreBasedWinnerIsPlayer1 = true
        } else if (set.p2Games > set.p1Games) {
          p2SetsFromScore++
          scoreBasedWinnerIsPlayer1 = false
        }
      })
      
      // If the score-based winner doesn't match the actual winner_id, invert the score
      // This handles cases where score is entered as "2-8" but player1 (left) won
      const needsInversion = (match.winner_id === match.player1_id && !scoreBasedWinnerIsPlayer1) ||
                            (match.winner_id === match.player2_id && scoreBasedWinnerIsPlayer1)
      
      parsedSets.forEach(set => {
        const finalP1Games = needsInversion ? set.p2Games : set.p1Games
        const finalP2Games = needsInversion ? set.p1Games : set.p2Games
        
        player1Games += finalP1Games
        player2Games += finalP2Games
        
        if (finalP1Games > finalP2Games) player1Sets++
        else if (finalP2Games > finalP1Games) player2Sets++
      })
    }
    // For walkovers: sets and games remain 0 (no games/sets played)
    
    // Update standings
    if (match.winner_id === match.player1_id) {
      player1Standing.wins++
      player2Standing.losses++
      player1Standing.points += pointsPerWin
      player1Standing.head_to_head.set(match.player2_id, (player1Standing.head_to_head.get(match.player2_id) || 0) + 1)
    } else {
      player2Standing.wins++
      player1Standing.losses++
      player2Standing.points += pointsPerWin
      player2Standing.head_to_head.set(match.player1_id, (player2Standing.head_to_head.get(match.player1_id) || 0) + 1)
    }
    
    // Only add sets/games if not a walkover
    if (!isWalkover) {
      player1Standing.sets_won += player1Sets
      player1Standing.sets_lost += player2Sets
      player1Standing.games_won += player1Games
      player1Standing.games_lost += player2Games
      
      player2Standing.sets_won += player2Sets
      player2Standing.sets_lost += player1Sets
      player2Standing.games_won += player2Games
      player2Standing.games_lost += player1Games
    }
    // For walkovers: sets and games stay at 0
  })
  
  // Calculate game_difference for all players
  standings.forEach((standing, playerId) => {
    standing.game_difference = standing.games_won - standing.games_lost
  })
  
  return standings
}

/**
 * Resolve tie-breakers between players
 * @param players - Array of player IDs with same wins
 * @param standings - Standings map
 * @returns Sorted array of player IDs (best to worst)
 */
export function resolveTieBreakers(
  players: string[],
  standings: Map<string, any>
): string[] {
  return players.sort((a, b) => {
    const standingA = standings.get(a)!
    const standingB = standings.get(b)!
    
    // 1. Points (if same wins)
    if (standingA.points !== undefined && standingB.points !== undefined) {
      if (standingA.points !== standingB.points) {
        return standingB.points - standingA.points
      }
    }
    
    // 2. Game difference
    if (standingA.game_difference !== undefined && standingB.game_difference !== undefined) {
      if (standingA.game_difference !== standingB.game_difference) {
        return standingB.game_difference - standingA.game_difference
      }
    }
    
    // 3. Head-to-head (if 2 players)
    if (players.length === 2) {
      const h2hA = standingA.head_to_head?.get(b) || 0
      const h2hB = standingB.head_to_head?.get(a) || 0
      if (h2hA !== h2hB) return h2hB - h2hA
    }
    
    // 4. Sets difference
    const setsDiffA = standingA.sets_won - standingA.sets_lost
    const setsDiffB = standingB.sets_won - standingB.sets_lost
    if (setsDiffA !== setsDiffB) {
      return setsDiffB - setsDiffA
    }
    
    return 0
  })
}

/**
 * Determine qualifiers from groups
 * @param groups - Array of groups with standings
 * @param advanceCount - Number of players to advance per group
 * @returns Array of qualifier player IDs
 */
export function determineGroupQualifiers(
  groups: Array<{
    groupId: string
    players: Array<{
      playerId: string
      wins: number
      losses: number
      sets_won: number
      sets_lost: number
      games_won: number
      games_lost: number
      points?: number
      game_difference?: number
      head_to_head: Map<string, number>
    }>
  }>,
  advanceCount: number
): string[] {
  const qualifiers: string[] = []
  
  groups.forEach(group => {
    // Sort players by wins, then tie-breakers (Points → Game Difference → Head-to-head → Sets Difference)
    const sorted = group.players.sort((a, b) => {
      if (a.wins !== b.wins) return b.wins - a.wins
      
      // Apply tie-breakers
      const tiedPlayers = group.players.filter(p => p.wins === a.wins).map(p => p.playerId)
      if (tiedPlayers.length > 1) {
        const standings = new Map()
        group.players.forEach(p => {
          standings.set(p.playerId, {
            ...p,
            head_to_head: p.head_to_head || new Map()
          })
        })
        const resolved = resolveTieBreakers(tiedPlayers, standings)
        const aIndex = resolved.indexOf(a.playerId)
        const bIndex = resolved.indexOf(b.playerId)
        return aIndex - bIndex
      }
      
      return 0
    })
    
    // Take top advanceCount players
    const groupQualifiers = sorted.slice(0, advanceCount).map(p => p.playerId)
    qualifiers.push(...groupQualifiers)
  })
  
  return qualifiers
}

/**
 * Generate single-elimination playoff bracket
 * @param players - Array of player IDs
 * @param bracketType - 'main' or 'backdraw'
 * @returns Bracket structure with matches
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
  
  // Calculate number of rounds needed
  let playerCount = players.length
  let round = 1
  let currentRoundPlayers = [...players]
  
  while (currentRoundPlayers.length > 1) {
    const nextRoundPlayers: string[] = []
    let matchNumber = 1
    
    // Pair up players (or assign byes)
    for (let i = 0; i < currentRoundPlayers.length; i += 2) {
      if (i + 1 < currentRoundPlayers.length) {
        // Normal match
        bracket.push({
          round,
          matchNumber: matchNumber++,
          player1_id: currentRoundPlayers[i],
          player2_id: currentRoundPlayers[i + 1],
          is_bye: false
        })
        // Winner placeholder (will be filled when match completes)
        nextRoundPlayers.push(`winner_${round}_${matchNumber - 1}`)
      } else {
        // Bye - player advances automatically
        bracket.push({
          round,
          matchNumber: matchNumber++,
          player1_id: currentRoundPlayers[i],
          is_bye: true
        })
        nextRoundPlayers.push(currentRoundPlayers[i])
      }
    }
    
    currentRoundPlayers = nextRoundPlayers
    round++
  }
  
  return bracket
}

/**
 * Assign byes for odd-numbered brackets
 * @param players - Array of player IDs
 * @returns Array with byes assigned
 */
export function assignByes(players: string[]): string[] {
  // For now, byes are handled in generatePlayoffBracket
  // This function can be used for more complex bye assignment logic
  return players
}

/**
 * Calculate bracket positions for visualization
 * @param roundCount - Number of rounds in bracket
 * @returns Position data for each round
 */
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
        x: round * 200, // Horizontal spacing
        y: (i + 1) * 100 // Vertical spacing
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
 * Update bracket after match completion
 * @param matchId - Match ID
 * @param winnerId - Winner player ID
 * @param supabase - Supabase admin client
 */
export async function updateBracketAfterMatch(
  matchId: string,
  winnerId: string,
  supabase: any
): Promise<void> {
  // Get tournament match info
  const { data: tournamentMatch, error: tmError } = await supabase
    .from('tournament_matches')
    .select('tournament_id, bracket_type, round_number, bracket_position')
    .eq('match_id', matchId)
    .single()
  
  if (tmError || !tournamentMatch) {
    return // Not a tournament match
  }
  
  // Only update for playoff matches (main or backdraw)
  if (tournamentMatch.bracket_type !== 'main' && tournamentMatch.bracket_type !== 'backdraw') {
    return
  }
  
  const currentRound = tournamentMatch.round_number!
  const currentMatchNumber = tournamentMatch.bracket_position || 1
  const nextRound = currentRound + 1
  
  // Calculate next round match number and slot
  // Round 1 Match 1 winner → Round 2 Match 1 player1
  // Round 1 Match 2 winner → Round 2 Match 1 player2
  // Round 1 Match 3 winner → Round 2 Match 2 player1
  // Round 1 Match 4 winner → Round 2 Match 2 player2
  const nextRoundMatchNumber = Math.ceil(currentMatchNumber / 2)
  const isPlayer1Slot = (currentMatchNumber % 2 === 1)
  
  // Check if next round match exists
  const { data: nextRoundMatch, error: findError } = await supabase
    .from('tournament_matches')
    .select('id, match_id')
    .eq('tournament_id', tournamentMatch.tournament_id)
    .eq('bracket_type', tournamentMatch.bracket_type)
    .eq('round_number', nextRound)
    .eq('bracket_position', nextRoundMatchNumber)
    .single()
  
  if (findError && findError.code !== 'PGRST116') { // PGRST116 = not found
    console.error('Error finding next round match:', findError)
    return
  }
  
  if (nextRoundMatch && nextRoundMatch.match_id) {
    // Match exists, update it with the winner
    const updateField = isPlayer1Slot ? 'player1_id' : 'player2_id'
    
    const { error: updateError } = await supabase
      .from('matches')
      .update({ [updateField]: winnerId })
      .eq('id', nextRoundMatch.match_id)
    
    if (updateError) {
      console.error('Error updating next round match with winner:', updateError)
    }
  } else {
    // Match doesn't exist, create it
    // First, check if we need to create the match record
    const { data: newMatch, error: createMatchError } = await supabase
      .from('matches')
      .insert({
        [isPlayer1Slot ? 'player1_id' : 'player2_id']: winnerId,
        tournament_id: tournamentMatch.tournament_id,
        status: 'scheduled',
        scheduled_at: null
      })
      .select()
      .single()
    
    if (createMatchError || !newMatch) {
      console.error('Error creating next round match:', createMatchError)
      return
    }
    
    // Create tournament match record
    const { error: createTmError } = await supabase
      .from('tournament_matches')
      .insert({
        tournament_id: tournamentMatch.tournament_id,
        match_id: newMatch.id,
        bracket_type: tournamentMatch.bracket_type,
        round_number: nextRound,
        bracket_position: nextRoundMatchNumber,
        is_bye: false
      })
    
    if (createTmError) {
      console.error('Error creating tournament match record:', createTmError)
    }
  }
}

/**
 * Persist calculated standings to tournament_standings table
 * @param tournamentId - Tournament ID
 * @param groupId - Group ID
 * @param standings - Calculated standings map
 * @param supabase - Supabase admin client
 */
export async function updateStandingsInDatabase(
  tournamentId: string,
  groupId: string,
  standings: Map<string, {
    wins: number
    losses: number
    sets_won: number
    sets_lost: number
    games_won: number
    games_lost: number
    points: number
    game_difference: number
    head_to_head: Map<string, number>
  }>,
  supabase: any
): Promise<void> {
  // Convert standings map to array for database operations
  const standingsArray = Array.from(standings.entries()).map(([playerId, standing]) => ({
    tournament_id: tournamentId,
    group_id: groupId,
    player_id: playerId,
    wins: standing.wins,
    losses: standing.losses,
    sets_won: standing.sets_won,
    sets_lost: standing.sets_lost,
    games_won: standing.games_won,
    games_lost: standing.games_lost,
    points: standing.points || 0,
    game_difference: standing.game_difference || 0,
    head_to_head_wins: 0 // This is calculated separately if needed
  }))

  // Upsert standings (update if exists, insert if not)
  for (const standing of standingsArray) {
    const { error } = await supabase
      .from('tournament_standings')
      .upsert(standing, {
        onConflict: 'tournament_id,group_id,player_id'
      })

    if (error) {
      console.error(`Error updating standings for player ${standing.player_id}:`, error)
    }
  }
}

/**
 * Recalculate and persist standings for a group
 * @param tournamentId - Tournament ID
 * @param groupId - Group ID
 * @param supabase - Supabase admin client
 */
export async function recalculateGroupStandings(
  tournamentId: string,
  groupId: string,
  supabase: any
): Promise<void> {
  // Get tournament to access points_config
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .single()

  if (tournamentError || !tournament) {
    throw new Error(`Tournament ${tournamentId} not found`)
  }

  // Get all matches for this group
  const { data: tournamentMatches, error: matchesError } = await supabase
    .from('tournament_matches')
    .select(`
      match_id,
      bracket_type,
      round_number,
      matches!inner(
        id,
        player1_id,
        player2_id,
        winner_id,
        score,
        status
      )
    `)
    .eq('tournament_id', tournamentId)
    .eq('group_id', groupId)
    .eq('bracket_type', 'group')

  if (matchesError) {
    throw new Error(`Failed to fetch matches for group ${groupId}: ${matchesError.message}`)
  }

  // Filter completed matches and format for calculateGroupStandings
  const completedMatches = (tournamentMatches || [])
    .filter(tm => tm.matches && tm.matches.status === 'completed' && tm.matches.winner_id && tm.matches.score)
    .map(tm => ({
      player1_id: tm.matches.player1_id,
      player2_id: tm.matches.player2_id,
      winner_id: tm.matches.winner_id,
      score: tm.matches.score
    }))

  // Calculate standings
  const standings = calculateGroupStandings(groupId, completedMatches, tournament as Tournament)

  // Persist to database
  await updateStandingsInDatabase(tournamentId, groupId, standings, supabase)
}


