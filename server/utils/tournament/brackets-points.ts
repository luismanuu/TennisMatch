import type { Tournament } from '~/types'

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
  }

  // Playoffs (main or backdraw)
  if (typeof pointsConfig.playoffs === 'number') {
    return pointsConfig.playoffs
  }

  if (pointsConfig.playoffs && typeof pointsConfig.playoffs === 'object') {
    // Per-round configuration
    const roundPoints: Record<number, number> = {
      1: pointsConfig.playoffs.quarterfinals || 5,
      2: pointsConfig.playoffs.semifinals || 7,
      3: pointsConfig.playoffs.final || 10
    }
    return roundPoints[roundNumber || 1] || 5
  }

  return 5 // Default playoff points
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

