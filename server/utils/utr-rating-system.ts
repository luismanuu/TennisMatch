/**
 * UTR Rating System
 * Implements UTR (Universal Tennis Rating) methodology adapted to ELO scale
 */

export type MatchFormat = 'best-of-3' | 'best-of-5' | 'pro-set-8' | 'pro-set-10' | 'super-tiebreak' | 'walkover' | 'unknown'

export interface MatchRatingData {
  matchRating: number
  matchWeight: number
  gamesWon: number
  gamesLost: number
  totalGames: number
  format: MatchFormat
}

export interface UtrCalculationResult {
  utrRating: number
  reliability: number
}

/**
 * Detect match format from score string
 */
export function detectMatchFormatFromScore(score: string | null | undefined): MatchFormat {
  if (!score) return 'unknown'
  
  const scoreUpper = score.trim().toUpperCase()
  
  // Walkover
  if (scoreUpper === 'WO') {
    return 'walkover'
  }
  
  // Normalize score string
  let scoreToParse = score.trim()
  scoreToParse = scoreToParse.replace(/\s+/g, ' ')
  scoreToParse = scoreToParse.replace(/\s*,\s*/g, ',')
  
  // If no comma but has space, treat space as separator
  if (!scoreToParse.includes(',') && scoreToParse.includes(' ')) {
    scoreToParse = scoreToParse.replace(/\s+/g, ',')
  }
  
  // Split by comma or treat as single set
  const sets = scoreToParse.includes(',')
    ? scoreToParse.split(',').map(s => s.trim()).filter(s => s.length > 0)
    : [scoreToParse.trim()]
  
  const numSets = sets.length
  
  // Best-of-5: 3-5 sets
  if (numSets >= 3 && numSets <= 5) {
    return 'best-of-5'
  }
  
  // Best-of-3: 2-3 sets
  if (numSets >= 2 && numSets <= 3) {
    return 'best-of-3'
  }
  
  // Single set - check if it's a pro set or super tiebreak
  if (numSets === 1) {
    const set = sets[0] || ''
    if (!set) return 'unknown'
    const cleanedSet = set.trim().replace(/\s*-\s*/g, '-')
    const parts = cleanedSet.split('-')
    
    if (parts.length === 2) {
      const left = parts[0] || ''
      const right = parts[1] || ''
      const p1Games = parseInt(left.replace(/\(.*\)/, '').replace(/[^0-9]/g, ''), 10) || 0
      const p2Games = parseInt(right.replace(/\(.*\)/, '').replace(/[^0-9]/g, ''), 10) || 0
      const totalGames = p1Games + p2Games
      
      // Super tiebreak: 10-point tiebreak format (usually 10-7, 10-8, etc.)
      if (totalGames >= 10 && totalGames <= 20 && (p1Games === 10 || p2Games === 10)) {
        return 'super-tiebreak'
      }
      
      // Pro set: 8 or 10 games
      if (totalGames >= 8 && totalGames <= 10) {
        return totalGames === 8 ? 'pro-set-8' : 'pro-set-10'
      }
    }
  }
  
  return 'unknown'
}

/**
 * Parse games won/lost from score string
 */
export function parseGamesFromScore(score: string | null | undefined, playerNumber: 1 | 2): {
  gamesWon: number
  gamesLost: number
  totalGames: number
} {
  if (!score || score.trim().toUpperCase() === 'WO') {
    return { gamesWon: 0, gamesLost: 0, totalGames: 0 }
  }
  
  // Normalize score string
  let scoreToParse = score.trim()
  scoreToParse = scoreToParse.replace(/\s+/g, ' ')
  scoreToParse = scoreToParse.replace(/\s*,\s*/g, ',')
  
  if (!scoreToParse.includes(',') && scoreToParse.includes(' ')) {
    scoreToParse = scoreToParse.replace(/\s+/g, ',')
  }
  
  // Split by comma or treat as single set
  const sets = scoreToParse.includes(',')
    ? scoreToParse.split(',').map(s => s.trim()).filter(s => s.length > 0)
    : [scoreToParse.trim()]
  
  let totalGamesWon = 0
  let totalGamesLost = 0
  
  sets.forEach(set => {
    const cleanedSet = set.trim().replace(/\s*-\s*/g, '-')
    const parts = cleanedSet.split('-')
    
    if (parts.length !== 2) return
    
    const p1ScoreStr = (parts[0] || '').trim()
    const p2ScoreStr = (parts[1] || '').trim()
    
    // Extract main score (remove tiebreak info)
    const p1MainScore = p1ScoreStr.replace(/\(.*\)/, '').replace(/[^0-9]/g, '')
    const p2MainScore = p2ScoreStr.replace(/\(.*\)/, '').replace(/[^0-9]/g, '')
    
    const p1Games = parseInt(p1MainScore, 10) || 0
    const p2Games = parseInt(p2MainScore, 10) || 0
    
    if (playerNumber === 1) {
      totalGamesWon += p1Games
      totalGamesLost += p2Games
    } else {
      totalGamesWon += p2Games
      totalGamesLost += p1Games
    }
  })
  
  return {
    gamesWon: totalGamesWon,
    gamesLost: totalGamesLost,
    totalGames: totalGamesWon + totalGamesLost
  }
}

/**
 * Calculate games won percentage
 */
export function calculateGamesWonPercentage(gamesWon: number, totalGames: number): number {
  if (totalGames === 0) return 0.5 // Default to 50% if no games
  return gamesWon / totalGames
}

/**
 * Get format weight based on detected format
 */
export function getFormatWeight(format: MatchFormat): number {
  switch (format) {
    case 'best-of-5':
      return 1.2
    case 'best-of-3':
      return 1.0
    case 'pro-set-10':
      return 0.9
    case 'pro-set-8':
      return 0.8
    case 'super-tiebreak':
      return 0.7
    case 'walkover':
      return 0.5
    case 'unknown':
      return 1.0 // Default fallback
    default:
      return 1.0
  }
}

/**
 * Get competitiveness weight based on ELO difference
 */
export function getCompetitivenessWeight(eloDifference: number): number {
  const absDiff = Math.abs(eloDifference)
  if (absDiff < 100) return 1.0
  if (absDiff < 200) return 0.9
  if (absDiff < 300) return 0.8
  return 0.7
}

/**
 * Calculate reliability weight based on opponent's match count and recency
 */
export function getReliabilityWeight(
  opponentTotalMatches: number,
  opponentLastMatchAt: Date | string | null
): number {
  // Match count factor (capped at 10 matches)
  const matchCountFactor = Math.min(1.0, opponentTotalMatches / 10)
  
  // Recent activity factor
  let recentActivityFactor = 0.2 // Default for very old matches
  
  if (opponentLastMatchAt) {
    const lastMatchDate = typeof opponentLastMatchAt === 'string' 
      ? new Date(opponentLastMatchAt) 
      : opponentLastMatchAt
    const now = new Date()
    const monthsAgo = (now.getTime() - lastMatchDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
    
    if (monthsAgo <= 3) {
      recentActivityFactor = 1.0
    } else if (monthsAgo <= 6) {
      recentActivityFactor = 0.8
    } else if (monthsAgo <= 9) {
      recentActivityFactor = 0.6
    } else if (monthsAgo <= 12) {
      recentActivityFactor = 0.4
    }
  }
  
  // Combine factors (50/50 split)
  const reliability = (matchCountFactor * 0.5) + (recentActivityFactor * 0.5)
  
  // Minimum 0.3 for new players
  return Math.max(0.3, reliability)
}

/**
 * Calculate match weight
 */
export function calculateMatchWeight(
  format: MatchFormat,
  eloDifference: number,
  opponentTotalMatches: number,
  opponentLastMatchAt: Date | string | null
): number {
  const formatWeight = getFormatWeight(format)
  const competitivenessWeight = getCompetitivenessWeight(eloDifference)
  const reliabilityWeight = getReliabilityWeight(opponentTotalMatches, opponentLastMatchAt)
  
  return formatWeight * competitivenessWeight * reliabilityWeight
}

/**
 * Calculate match rating for a player (UTR style - independent per player)
 */
export function calculateMatchRating(
  playerElo: number,
  opponentElo: number,
  gamesWon: number,
  totalGames: number
): number {
  if (totalGames === 0) {
    // No games played (walkover), return current ELO
    return playerElo
  }
  
  // Step 1: Calculate expected games won percentage
  const expectedGamesWonPct = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400))
  
  // Step 2: Calculate actual games won percentage
  const actualGamesWonPct = calculateGamesWonPercentage(gamesWon, totalGames)
  
  // Step 3: Calculate performance factor
  const performanceFactor = actualGamesWonPct - expectedGamesWonPct
  
  // Step 4: Calculate match rating
  const matchRating = playerElo + (performanceFactor * 400)
  
  return Math.round(matchRating * 100) / 100 // Round to 2 decimal places
}

/**
 * Calculate UTR rating from match history
 * Returns weighted average of up to 30 most recent match ratings within 12 months
 */
export function calculateUtrRating(
  matchRatings: Array<{ matchRating: number; matchWeight: number; playedAt: Date | string }>
): number | null {
  if (matchRatings.length === 0) {
    return null
  }
  
  const now = new Date()
  const twelveMonthsAgo = new Date(now.getTime() - (12 * 30 * 24 * 60 * 60 * 1000))
  
  // Filter matches within last 12 months and sort by date (most recent first)
  const validMatches = matchRatings
    .filter(m => {
      const matchDate = typeof m.playedAt === 'string' ? new Date(m.playedAt) : m.playedAt
      return matchDate >= twelveMonthsAgo
    })
    .sort((a, b) => {
      const dateA = typeof a.playedAt === 'string' ? new Date(a.playedAt) : a.playedAt
      const dateB = typeof b.playedAt === 'string' ? new Date(b.playedAt) : b.playedAt
      return dateB.getTime() - dateA.getTime()
    })
    .slice(0, 30) // Limit to 30 most recent
  
  if (validMatches.length === 0) {
    return null
  }
  
  // Calculate weighted average
  let totalWeightedRating = 0
  let totalWeight = 0
  
  for (const match of validMatches) {
    totalWeightedRating += match.matchRating * match.matchWeight
    totalWeight += match.matchWeight
  }
  
  if (totalWeight === 0) {
    return null
  }
  
  const utrRating = totalWeightedRating / totalWeight
  return Math.round(utrRating * 100) / 100 // Round to 2 decimal places
}

/**
 * Calculate player reliability based on match count and recency
 */
export function calculatePlayerReliability(
  totalMatches: number,
  lastMatchAt: Date | string | null
): number {
  // Match count factor (capped at 10 matches)
  const matchCountFactor = Math.min(1.0, totalMatches / 10)
  
  // Recent activity factor
  let recentActivityFactor = 0.2 // Default for very old matches
  
  if (lastMatchAt) {
    const lastMatchDate = typeof lastMatchAt === 'string' 
      ? new Date(lastMatchAt) 
      : lastMatchAt
    const now = new Date()
    const monthsAgo = (now.getTime() - lastMatchDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
    
    if (monthsAgo <= 3) {
      recentActivityFactor = 1.0
    } else if (monthsAgo <= 6) {
      recentActivityFactor = 0.8
    } else if (monthsAgo <= 9) {
      recentActivityFactor = 0.6
    } else if (monthsAgo <= 12) {
      recentActivityFactor = 0.4
    }
  }
  
  // Combine factors (50/50 split)
  const reliability = (matchCountFactor * 0.5) + (recentActivityFactor * 0.5)
  
  // Minimum 0.3 for new players
  return Math.max(0.3, Math.round(reliability * 1000) / 1000) // Round to 3 decimal places
}
