import type { SupabaseClient } from '@supabase/supabase-js'
import type { Tournament } from '~/types'
import { logger } from '../logger'
import { getPointsForMatch } from './brackets-points'

export type GroupStanding = {
  wins: number
  losses: number
  sets_won: number
  sets_lost: number
  games_won: number
  games_lost: number
  points: number
  game_difference: number
  head_to_head: Map<string, number>
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
): Map<string, GroupStanding> {
  const standings = new Map<string, GroupStanding>()

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

    const player1Standing = standings.get(match.player1_id)
    const player2Standing = standings.get(match.player2_id)
    if (!player1Standing || !player2Standing) return

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

      const parsedSets: Array<{ p1Games: number; p2Games: number }> = []

      sets.forEach(set => {
        // Clean up the set string: remove extra spaces, handle various dash formats
        const cleanedSet = set.trim().replace(/\s*-\s*/g, '-') // Normalize dash spacing

        // Split by dash
        const parts = cleanedSet.split('-')
        if (parts.length !== 2) {
          // Invalid format, skip this set
          return
        }

        const left = parts[0]
        const right = parts[1]
        if (!left || !right) {
          return
        }

        // Parse games, handling non-numeric characters
        const p1Games = parseInt(left.replace(/[^0-9]/g, ''), 10) || 0 // Extract only digits
        const p2Games = parseInt(right.replace(/[^0-9]/g, ''), 10) || 0 // Extract only digits

        // Only process if we got valid numbers
        if (p1Games > 0 || p2Games > 0) {
          parsedSets.push({ p1Games, p2Games })
        }
      })

      // Determine winner based on parsed scores
      let scoreBasedWinnerIsPlayer1 = false
      parsedSets.forEach(set => {
        if (set.p1Games > set.p2Games) scoreBasedWinnerIsPlayer1 = true
        else if (set.p2Games > set.p1Games) scoreBasedWinnerIsPlayer1 = false
      })

      // If the score-based winner doesn't match the actual winner_id, invert the score
      // This handles cases where score is entered as "2-8" but player1 (left) won
      const needsInversion =
        (match.winner_id === match.player1_id && !scoreBasedWinnerIsPlayer1) ||
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
      player1Standing.head_to_head.set(
        match.player2_id,
        (player1Standing.head_to_head.get(match.player2_id) || 0) + 1
      )
    } else {
      player2Standing.wins++
      player1Standing.losses++
      player2Standing.points += pointsPerWin
      player2Standing.head_to_head.set(
        match.player1_id,
        (player2Standing.head_to_head.get(match.player1_id) || 0) + 1
      )
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
  standings.forEach(standing => {
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
export function resolveTieBreakers(players: string[], standings: Map<string, GroupStanding>): string[] {
  return players.sort((a, b) => {
    const standingA = standings.get(a)
    const standingB = standings.get(b)
    if (!standingA || !standingB) return 0

    // 1. Points (if same wins)
    if (standingA.points !== standingB.points) {
      return standingB.points - standingA.points
    }

    // 2. Game difference
    if (standingA.game_difference !== standingB.game_difference) {
      return standingB.game_difference - standingA.game_difference
    }

    // 3. Head-to-head (if 2 players)
    if (players.length === 2) {
      const h2hA = standingA.head_to_head.get(b) || 0
      const h2hB = standingB.head_to_head.get(a) || 0
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

type QualifierGroup = {
  groupId: string
  players: Array<{ playerId: string } & GroupStanding>
}

/**
 * Determine qualifiers from groups
 * @param groups - Array of groups with standings
 * @param advanceCount - Number of players to advance per group
 * @returns Array of qualifier player IDs
 */
export function determineGroupQualifiers(groups: QualifierGroup[], advanceCount: number): string[] {
  const qualifiers: string[] = []

  groups.forEach(group => {
    // Sort players by wins, then tie-breakers (Points → Game Difference → Head-to-head → Sets Difference)
    const sorted = group.players.sort((a, b) => {
      if (a.wins !== b.wins) return b.wins - a.wins

      const tiedPlayers = group.players.filter(p => p.wins === a.wins).map(p => p.playerId)
      if (tiedPlayers.length > 1) {
        const standings = new Map<string, GroupStanding>()
        group.players.forEach(p => {
          standings.set(p.playerId, {
            wins: p.wins,
            losses: p.losses,
            sets_won: p.sets_won,
            sets_lost: p.sets_lost,
            games_won: p.games_won,
            games_lost: p.games_lost,
            points: p.points,
            game_difference: p.game_difference,
            head_to_head: p.head_to_head || new Map<string, number>()
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
 * Persist calculated standings to tournament_standings table
 */
export async function updateStandingsInDatabase(
  tournamentId: string,
  groupId: string,
  standings: Map<string, GroupStanding>,
  supabase: SupabaseClient
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
      .upsert(standing, { onConflict: 'tournament_id,group_id,player_id' })

    if (error) {
      logger.error(`Error updating standings for player ${standing.player_id}:`, error)
    }
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

/**
 * Recalculate and persist standings for a group
 */
export async function recalculateGroupStandings(
  tournamentId: string,
  groupId: string,
  supabase: SupabaseClient
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
    .select(
      `
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
    `
    )
    .eq('tournament_id', tournamentId)
    .eq('group_id', groupId)
    .eq('bracket_type', 'group')

  if (matchesError) {
    throw new Error(`Failed to fetch matches for group ${groupId}: ${matchesError.message}`)
  }

  // Filter completed matches and format for calculateGroupStandings
  const completedMatches = (tournamentMatches || [])
    .map((tm) => (tm && typeof tm === 'object' ? (tm as Record<string, unknown>) : null))
    .filter((tm): tm is Record<string, unknown> => !!tm)
    .map((tm) => asRecord(tm['matches']))
    .filter((m): m is Record<string, unknown> => !!m)
    .filter((m) => m['status'] === 'completed' && typeof m['winner_id'] === 'string' && typeof m['score'] === 'string')
    .map((m) => ({
      player1_id: String(m['player1_id']),
      player2_id: String(m['player2_id']),
      winner_id: String(m['winner_id']),
      score: String(m['score'])
    }))

  // Calculate standings
  const standings = calculateGroupStandings(groupId, completedMatches, tournament as Tournament)

  // Persist to database
  await updateStandingsInDatabase(tournamentId, groupId, standings, supabase)
}

