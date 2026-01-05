import { getSupabaseAdmin } from './supabase'
import type { Tournament, TournamentGroup, TournamentMatch } from '~/types'

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
 * @returns Standings for each player
 */
export function calculateGroupStandings(
  groupId: string,
  matches: Array<{
    player1_id: string
    player2_id: string
    winner_id?: string
    score?: string
  }>
): Map<string, {
  wins: number
  losses: number
  sets_won: number
  sets_lost: number
  games_won: number
  games_lost: number
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
      head_to_head: new Map<string, number>()
    })
  })
  
  // Process matches
  matches.forEach(match => {
    if (!match.winner_id || !match.score) return
    
    const player1Standing = standings.get(match.player1_id)!
    const player2Standing = standings.get(match.player2_id)!
    
    // Parse score (format: "6-4, 6-3" or similar)
    const sets = match.score.split(',').map(s => s.trim())
    let player1Sets = 0
    let player2Sets = 0
    let player1Games = 0
    let player2Games = 0
    
    sets.forEach(set => {
      const [p1Games, p2Games] = set.split('-').map(s => parseInt(s.trim()) || 0)
      player1Games += p1Games
      player2Games += p2Games
      if (p1Games > p2Games) player1Sets++
      else if (p2Games > p1Games) player2Sets++
    })
    
    // Update standings
    if (match.winner_id === match.player1_id) {
      player1Standing.wins++
      player2Standing.losses++
      player1Standing.head_to_head.set(match.player2_id, (player1Standing.head_to_head.get(match.player2_id) || 0) + 1)
    } else {
      player2Standing.wins++
      player1Standing.losses++
      player2Standing.head_to_head.set(match.player1_id, (player2Standing.head_to_head.get(match.player1_id) || 0) + 1)
    }
    
    player1Standing.sets_won += player1Sets
    player1Standing.sets_lost += player2Sets
    player1Standing.games_won += player1Games
    player1Standing.games_lost += player2Games
    
    player2Standing.sets_won += player2Sets
    player2Standing.sets_lost += player1Sets
    player2Standing.games_won += player2Games
    player2Standing.games_lost += player1Games
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
    
    // 1. Head-to-head (if applicable)
    if (players.length === 2) {
      const h2hA = standingA.head_to_head.get(b) || 0
      const h2hB = standingB.head_to_head.get(a) || 0
      if (h2hA !== h2hB) return h2hB - h2hA
    }
    
    // 2. Sets won
    if (standingA.sets_won !== standingB.sets_won) {
      return standingB.sets_won - standingA.sets_won
    }
    
    // 3. Games won
    if (standingA.games_won !== standingB.games_won) {
      return standingB.games_won - standingA.games_won
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
      games_won: number
      head_to_head: Map<string, number>
    }>
  }>,
  advanceCount: number
): string[] {
  const qualifiers: string[] = []
  
  groups.forEach(group => {
    // Sort players by wins, then tie-breakers
    const sorted = group.players.sort((a, b) => {
      if (a.wins !== b.wins) return b.wins - a.wins
      
      // Apply tie-breakers
      const tiedPlayers = group.players.filter(p => p.wins === a.wins).map(p => p.playerId)
      if (tiedPlayers.length > 1) {
        const standings = new Map()
        group.players.forEach(p => {
          standings.set(p.playerId, p)
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
  
  // Find next round matches that reference this match's winner
  const nextRound = tournamentMatch.round_number! + 1
  const positionPattern = tournamentMatch.bracket_position
  
  // Update next round match with winner
  // This is a simplified version - actual implementation depends on bracket_position format
  const { error: updateError } = await supabase
    .from('tournament_matches')
    .update({
      // Update player slot based on bracket position
      // This is simplified - actual logic depends on bracket structure
    })
    .eq('tournament_id', tournamentMatch.tournament_id)
    .eq('bracket_type', tournamentMatch.bracket_type)
    .eq('round_number', nextRound)
    .like('bracket_position', `${positionPattern}%`)
  
  if (updateError) {
    console.error('Error updating bracket after match:', updateError)
  }
}


