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
 * @returns Array of match pairs (player1_id, player2_id)
 */
export function generateGroupMatches(groupPlayers: string[]): Array<{ player1_id: string; player2_id: string }> {
  const matches: Array<{ player1_id: string; player2_id: string }> = []

  // Round-robin: each player plays every other player
  for (let i = 0; i < groupPlayers.length; i++) {
    for (let j = i + 1; j < groupPlayers.length; j++) {
      const p1 = groupPlayers[i]
      const p2 = groupPlayers[j]
      if (!p1 || !p2) continue
      matches.push({
        player1_id: p1,
        player2_id: p2
      })
    }
  }

  return matches
}

