import { randomUUID } from 'node:crypto'
import { createError } from 'h3'
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { useDb, type DbOrTx } from '../db'
import {
  matches,
  tournament_group_players,
  tournament_groups,
  tournament_matches,
  tournament_registrations,
  tournament_standings,
  tournaments,
  type BracketType,
  type PointsConfig,
} from '../db/schema'
import type { Tournament } from '~/types'

// The points functions only read points_config, so a stored tournament row works as well as the client type.
type PointsSource = { points_config?: Tournament['points_config'] | null }

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
  tournament: PointsSource,
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
  tournament: PointsSource
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
  tournament?: PointsSource
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
    // Walkover in any stored spelling (WO, W/O, Walkover)
    const isWalkover = /^(w\s*\/?\s*o|walkover)$/i.test(match.score.trim())
    
    let player1Sets = 0
    let player2Sets = 0
    let player1Games = 0
    let player2Games = 0
    
    if (!isWalkover) {
      // Parse score with robust error handling for various formats
      // Handles: "6-4, 6-3", "6-4,6-3", "6-4, 6-3, 6-2", "8-6" (pro set), "6-4 6-3" (space instead of comma)
      // Tiebreak points "7-6(5)" are not games
      let scoreToParse = match.score.trim().replace(/\s*\([^)]*\)/g, '')
      
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

// ── Database access ───────────────────────────────────────────────────────────

// Multi-row writes run in their own transaction, or in a savepoint of the caller's transaction when given one,
// so a failed step never leaves half a bracket behind.
function inTransaction<T>(tx: DbOrTx | undefined, run: (db: DbOrTx) => Promise<T>): Promise<T> {
  return (tx ?? useDb()).transaction((t) => run(t))
}

/**
 * Normalize a points_config from a request body into the stored shape.
 * Mirrors getPointsForMatch's fallbacks, so the points a tournament awards do not change.
 */
export function normalizePointsConfig(input: Tournament['points_config'] | null | undefined): PointsConfig | null {
  if (!input) {
    return null
  }
  return {
    group_stage: typeof input.group_stage === 'number' && input.group_stage ? input.group_stage : 3,
    playoffs: typeof input.playoffs === 'number' ? input.playoffs : 5,
  }
}

/**
 * Generate the group stage: groups, group players, zeroed standings, round-robin matches and their
 * tournament_matches rows. All-or-nothing. A second call is refused with 400.
 * @param tournamentId - Tournament ID
 * @param advancePhase - Also move the tournament to the group_stage phase
 * @param tx - Optional transaction to run in
 */
export async function generateGroupStageBrackets(
  tournamentId: string,
  advancePhase: boolean,
  tx?: DbOrTx
): Promise<{ groups: number; groupMatches: number }> {
  return inTransaction(tx, async (db) => {
    // Lock the tournament row so two concurrent generations cannot both pass the "already generated" check.
    const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).for('update')

    if (!tournament) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Tournament not found'
      })
    }

    // Get confirmed registrations
    const registrations = await db
      .select({ player_id: tournament_registrations.player_id })
      .from(tournament_registrations)
      .where(
        and(
          eq(tournament_registrations.tournament_id, tournamentId),
          eq(tournament_registrations.status, 'confirmed'),
          isNull(tournament_registrations.withdrawn_at)
        )
      )

    const playerIds = registrations.map((r) => r.player_id)

    // Validate minimum players
    if (playerIds.length < tournament.min_players) {
      throw createError({
        statusCode: 400,
        statusMessage: `Tournament requires at least ${tournament.min_players} players, but only ${playerIds.length} are registered`
      })
    }

    if (tournament.group_size < 1) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Group size must be at least 1'
      })
    }

    // Check if brackets already exist
    const existingGroup = await db.query.tournament_groups.findFirst({
      columns: { id: true },
      where: eq(tournament_groups.tournament_id, tournamentId),
    })

    if (existingGroup) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Brackets have already been generated for this tournament'
      })
    }

    // Step 1: Create groups
    const groups = createGroups(playerIds, tournament.group_size)
    if (groups.length === 0) {
      return { groups: 0, groupMatches: 0 }
    }

    const createdGroups = await db
      .insert(tournament_groups)
      .values(
        groups.map((g) => ({
          tournament_id: tournamentId,
          group_name: `Group ${String.fromCharCode(64 + g.groupNumber)}`, // A, B, C, etc.
          group_number: g.groupNumber
        }))
      )
      .returning({ id: tournament_groups.id, group_number: tournament_groups.group_number })

    const groupIdByNumber = new Map(createdGroups.map((g) => [g.group_number, g.id]))
    const groupId = (groupNumber: number) => {
      const id = groupIdByNumber.get(groupNumber)
      if (!id) throw new Error(`Group ${groupNumber} was not created`)
      return id
    }

    // Step 2: Assign players to groups, each with an empty standings row
    const groupPlayerRecords = groups.flatMap((g) =>
      g.players.map((playerId, playerIndex) => ({
        tournament_id: tournamentId,
        group_id: groupId(g.groupNumber),
        player_id: playerId,
        seed_position: playerIndex + 1
      }))
    )
    await db.insert(tournament_group_players).values(groupPlayerRecords)
    await db.insert(tournament_standings).values(
      groupPlayerRecords.map(({ tournament_id, group_id, player_id }) => ({ tournament_id, group_id, player_id }))
    )

    // Step 3: Generate group stage matches (round-robin)
    const matchRecords: Array<typeof matches.$inferInsert & { id: string }> = []
    const tournamentMatchRecords: Array<typeof tournament_matches.$inferInsert> = []

    for (const g of groups) {
      for (const pair of generateGroupMatches(g.players)) {
        const matchId = randomUUID()
        matchRecords.push({
          id: matchId,
          player1_id: pair.player1_id,
          player2_id: pair.player2_id,
          tournament_id: tournamentId,
          status: 'scheduled',
          scheduled_at: null // Players will schedule later
        })
        tournamentMatchRecords.push({
          tournament_id: tournamentId,
          match_id: matchId,
          bracket_type: 'group',
          round_number: 1,
          group_id: groupId(g.groupNumber),
          is_bye: false
        })
      }
    }

    if (matchRecords.length > 0) {
      await db.insert(matches).values(matchRecords)
      await db.insert(tournament_matches).values(tournamentMatchRecords)
    }

    if (advancePhase) {
      await db
        .update(tournaments)
        .set({ current_phase: 'group_stage', updated_at: new Date() })
        .where(eq(tournaments.id, tournamentId))
    }

    return { groups: createdGroups.length, groupMatches: tournamentMatchRecords.length }
  })
}

type BracketSlotRecord = {
  id: string
  tournament_id: string
  bracket_type: BracketType
  round_number: number | null
  bracket_position: string | null
}

/**
 * Work out a tournament match's position in its round when bracket_position is missing, from the order of the
 * round's rows, and store it for next time. Falls back to 1.
 */
async function resolveBracketPosition(
  db: DbOrTx,
  tm: BracketSlotRecord,
  currentRound: number,
  secondaryOrder: 'id' | 'match_id',
  isThisRow: (row: { id: string; match_id: string | null; is_bye: boolean }) => boolean
): Promise<number> {
  if (tm.bracket_position !== null) {
    return Number(tm.bracket_position)
  }

  const roundMatches = await db
    .select({ id: tournament_matches.id, match_id: tournament_matches.match_id, is_bye: tournament_matches.is_bye })
    .from(tournament_matches)
    .where(
      and(
        eq(tournament_matches.tournament_id, tm.tournament_id),
        eq(tournament_matches.bracket_type, tm.bracket_type),
        eq(tournament_matches.round_number, currentRound)
      )
    )
    .orderBy(asc(tournament_matches.bracket_position), asc(tournament_matches[secondaryOrder]))

  const matchIndex = roundMatches.findIndex(isThisRow)
  if (matchIndex < 0) {
    return 1
  }

  const position = matchIndex + 1
  await db.update(tournament_matches).set({ bracket_position: String(position) }).where(eq(tournament_matches.id, tm.id))
  return position
}

/**
 * Put a player into their slot of the next round's match, creating that match when it does not exist yet.
 * Round 1 Match 1 → Round 2 Match 1 player1; Round 1 Match 2 → Round 2 Match 1 player2; and so on.
 */
async function placeInNextRound(
  db: DbOrTx,
  tm: BracketSlotRecord,
  currentRound: number,
  currentMatchNumber: number,
  playerId: string
): Promise<void> {
  const nextRound = currentRound + 1
  const nextRoundMatchNumber = Math.ceil(currentMatchNumber / 2)
  const isPlayer1Slot = currentMatchNumber % 2 === 1

  // Check if next round match exists
  const nextRoundMatch = await db.query.tournament_matches.findFirst({
    columns: { id: true, match_id: true },
    where: and(
      eq(tournament_matches.tournament_id, tm.tournament_id),
      eq(tournament_matches.bracket_type, tm.bracket_type),
      eq(tournament_matches.round_number, nextRound),
      eq(tournament_matches.bracket_position, String(nextRoundMatchNumber))
    ),
  })

  if (nextRoundMatch && nextRoundMatch.match_id) {
    await db
      .update(matches)
      .set(isPlayer1Slot ? { player1_id: playerId } : { player2_id: playerId })
      .where(eq(matches.id, nextRoundMatch.match_id))
    return
  }

  // Total rounds come from the number of players in round 1. Only rows with a match count, as before
  // (the old query inner-joined matches, so bye rows were never counted).
  const round1Matches = await db
    .select({ player1_id: matches.player1_id, player2_id: matches.player2_id })
    .from(tournament_matches)
    .innerJoin(matches, eq(matches.id, tournament_matches.match_id))
    .where(
      and(
        eq(tournament_matches.tournament_id, tm.tournament_id),
        eq(tournament_matches.bracket_type, tm.bracket_type),
        eq(tournament_matches.round_number, 1)
      )
    )

  const uniquePlayers = new Set<string>()
  for (const match of round1Matches) {
    if (match.player1_id) uniquePlayers.add(match.player1_id)
    if (match.player2_id) uniquePlayers.add(match.player2_id)
  }

  const totalPlayers = uniquePlayers.size
  if (totalPlayers === 0) {
    console.error(`[bracket] No players found in round 1 of tournament ${tm.tournament_id} (${tm.bracket_type})`)
    return
  }

  // If the next round is beyond the rounds needed, this was the final
  const totalRounds = Math.ceil(Math.log2(totalPlayers))
  if (nextRound > totalRounds) {
    return
  }

  // A tournament match may start with one player; the other slot fills when the sibling match completes
  const [newMatch] = await db
    .insert(matches)
    .values({
      tournament_id: tm.tournament_id,
      status: 'scheduled',
      scheduled_at: null,
      ...(isPlayer1Slot ? { player1_id: playerId } : { player2_id: playerId })
    })
    .returning({ id: matches.id })

  await db.insert(tournament_matches).values({
    tournament_id: tm.tournament_id,
    match_id: newMatch.id,
    bracket_type: tm.bracket_type,
    round_number: nextRound,
    bracket_position: String(nextRoundMatchNumber),
    is_bye: false
  })
}

/**
 * Process a bye match to advance the player to the next round
 * @param tournamentMatch - Tournament match record with is_bye = true and player_id set
 * @param tx - Optional transaction to run in
 */
export async function processByeAdvancement(
  tournamentMatch: BracketSlotRecord & { player_id: string | null },
  tx?: DbOrTx
): Promise<void> {
  const playerId = tournamentMatch.player_id
  if (!playerId || tournamentMatch.round_number === null) {
    return
  }
  const currentRound = tournamentMatch.round_number

  await inTransaction(tx, async (db) => {
    const currentMatchNumber = await resolveBracketPosition(
      db,
      tournamentMatch,
      currentRound,
      'id',
      (row) => row.is_bye && row.id === tournamentMatch.id
    )
    await placeInNextRound(db, tournamentMatch, currentRound, currentMatchNumber, playerId)
  })
}

/**
 * Update bracket after match completion
 * @param matchId - Match ID
 * @param winnerId - Winner player ID
 * @param tx - Optional transaction to run in
 */
export async function updateBracketAfterMatch(
  matchId: string,
  winnerId: string,
  tx?: DbOrTx
): Promise<void> {
  await inTransaction(tx, async (db) => {
    // Get tournament match info
    const tournamentMatch = await db.query.tournament_matches.findFirst({
      columns: {
        id: true,
        tournament_id: true,
        bracket_type: true,
        round_number: true,
        bracket_position: true,
        is_bye: true,
        player_id: true,
      },
      where: eq(tournament_matches.match_id, matchId),
    })

    if (!tournamentMatch) {
      return // Not a tournament match
    }

    // Handle bye matches separately
    if (tournamentMatch.is_bye) {
      await processByeAdvancement(tournamentMatch, db)
      return
    }

    // Only update for playoff matches (main or backdraw)
    if (tournamentMatch.bracket_type !== 'main' && tournamentMatch.bracket_type !== 'backdraw') {
      return
    }

    if (tournamentMatch.round_number === null) {
      return
    }
    const currentRound = tournamentMatch.round_number

    const currentMatchNumber = await resolveBracketPosition(
      db,
      tournamentMatch,
      currentRound,
      'match_id',
      (row) => row.match_id === matchId
    )
    await placeInNextRound(db, tournamentMatch, currentRound, currentMatchNumber, winnerId)
  })
}

/**
 * Update bracket progression for all completed playoff matches in a tournament
 * This is useful when bracket needs to be refreshed and some matches were already completed
 * @param tournamentId - Tournament ID
 * @param bracketType - 'main' or 'backdraw' or 'all' for both
 * @param tx - Optional transaction to run in
 */
export async function updateBracketFromCompletedMatches(
  tournamentId: string,
  bracketType: 'main' | 'backdraw' | 'all',
  tx?: DbOrTx
): Promise<void> {
  const db = tx ?? useDb()
  const bracketTypes: Array<'main' | 'backdraw'> = bracketType === 'all' ? ['main', 'backdraw'] : [bracketType]

  for (const bt of bracketTypes) {
    // Byes are part of the bracket structure and are never deleted here
    let tournamentMatches
    try {
      tournamentMatches = await db
        .select({
          id: tournament_matches.id,
          match_id: tournament_matches.match_id,
          round_number: tournament_matches.round_number,
          bracket_position: tournament_matches.bracket_position,
          is_bye: tournament_matches.is_bye,
          player_id: tournament_matches.player_id,
          tournament_id: tournament_matches.tournament_id,
          bracket_type: tournament_matches.bracket_type,
        })
        .from(tournament_matches)
        .where(and(eq(tournament_matches.tournament_id, tournamentId), eq(tournament_matches.bracket_type, bt)))
        .orderBy(asc(tournament_matches.round_number), asc(tournament_matches.bracket_position), asc(tournament_matches.id))
    } catch (err) {
      console.error(`[updateBracketFromCompletedMatches] Error fetching tournament matches for ${bt}:`, err)
      continue
    }

    if (tournamentMatches.length === 0) {
      continue
    }

    const matchIds = tournamentMatches.map((tm) => tm.match_id).filter((id): id is string => Boolean(id))
    if (matchIds.length === 0) {
      continue
    }

    let matchRows
    try {
      matchRows = await db
        .select({ id: matches.id, status: matches.status, winner_id: matches.winner_id })
        .from(matches)
        .where(inArray(matches.id, matchIds))
    } catch (err) {
      console.error(`[updateBracketFromCompletedMatches] Error fetching matches for ${bt}:`, err)
      continue
    }

    // Process bye matches first (they advance automatically)
    for (const tm of tournamentMatches.filter((row) => row.is_bye)) {
      if (tm.player_id) {
        try {
          await processByeAdvancement({ ...tm, tournament_id: tournamentId, bracket_type: bt }, tx)
        } catch (err) {
          console.error(`[updateBracketFromCompletedMatches] Error processing bye:`, err)
        }
      }
    }

    // Then every completed match with a winner
    for (const tm of tournamentMatches) {
      const match = matchRows.find((m) => m.id === tm.match_id)
      if (!tm.match_id || match?.status !== 'completed' || !match.winner_id) {
        continue
      }
      try {
        await updateBracketAfterMatch(tm.match_id, match.winner_id, tx)
      } catch (err) {
        // Continue with next match even if one fails
        console.error(`[updateBracketFromCompletedMatches] Error processing match ${tm.match_id}:`, err)
      }
    }
  }
}

/**
 * Persist calculated standings to tournament_standings table
 * @param tournamentId - Tournament ID
 * @param groupId - Group ID
 * @param standings - Calculated standings map
 * @param tx - Optional transaction to run in
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
  tx?: DbOrTx
): Promise<void> {
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

  if (standingsArray.length === 0) {
    return
  }

  // One upsert statement: every row lands or none does
  await (tx ?? useDb())
    .insert(tournament_standings)
    .values(standingsArray)
    .onConflictDoUpdate({
      target: [tournament_standings.tournament_id, tournament_standings.group_id, tournament_standings.player_id],
      set: {
        wins: sql`excluded.wins`,
        losses: sql`excluded.losses`,
        sets_won: sql`excluded.sets_won`,
        sets_lost: sql`excluded.sets_lost`,
        games_won: sql`excluded.games_won`,
        games_lost: sql`excluded.games_lost`,
        points: sql`excluded.points`,
        game_difference: sql`excluded.game_difference`,
        head_to_head_wins: sql`excluded.head_to_head_wins`,
        updated_at: new Date(),
      },
    })
}

/**
 * Completed group matches of one group, in the shape calculateGroupStandings takes.
 */
export async function getCompletedGroupMatches(
  tournamentId: string,
  groupId: string,
  tx?: DbOrTx
): Promise<Array<{ player1_id: string; player2_id: string; winner_id: string; score: string | undefined }>> {
  const rows = await (tx ?? useDb())
    .select({
      player1_id: matches.player1_id,
      player2_id: matches.player2_id,
      winner_id: matches.winner_id,
      score: matches.score,
      status: matches.status,
    })
    .from(tournament_matches)
    .innerJoin(matches, eq(matches.id, tournament_matches.match_id))
    .where(
      and(
        eq(tournament_matches.tournament_id, tournamentId),
        eq(tournament_matches.group_id, groupId),
        eq(tournament_matches.bracket_type, 'group')
      )
    )

  const completed: Array<{ player1_id: string; player2_id: string; winner_id: string; score: string | undefined }> = []
  for (const m of rows) {
    if (m.status === 'completed' && m.winner_id && m.player1_id && m.player2_id) {
      completed.push({ player1_id: m.player1_id, player2_id: m.player2_id, winner_id: m.winner_id, score: m.score ?? undefined })
    }
  }
  return completed
}

/**
 * Recalculate and persist standings for a group
 * @param tournamentId - Tournament ID
 * @param groupId - Group ID
 * @param tx - Optional transaction to run in
 */
export async function recalculateGroupStandings(
  tournamentId: string,
  groupId: string,
  tx?: DbOrTx
): Promise<void> {
  const db = tx ?? useDb()

  // Get tournament to access points_config
  const tournament = await db.query.tournaments.findFirst({ where: eq(tournaments.id, tournamentId) })
  if (!tournament) {
    throw new Error(`Tournament ${tournamentId} not found`)
  }

  // Only matches with a score count here
  const completedMatches = (await getCompletedGroupMatches(tournamentId, groupId, db)).filter((m) => m.score)

  const standings = calculateGroupStandings(groupId, completedMatches, tournament)
  await updateStandingsInDatabase(tournamentId, groupId, standings, db)
}
