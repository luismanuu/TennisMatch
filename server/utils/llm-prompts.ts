/**
 * LLM Prompt Templates for ELO Calculation
 * Uses OpenRouter API to calculate ELO changes based on match context
 */

import type { Player } from '~/types'
import type { MatchFormat } from './utr-rating-system'

export interface LlmEloCalculationRequest {
  matchId: string
  player1Id: string
  player2Id: string
  player1Elo: number
  player2Elo: number
  score: string
  winnerId: string
  tournamentId?: string
}

export interface MatchContext {
  player1: {
    id: string
    name: string
    elo: number
    utrRating?: number
    winStreak?: number
    lossStreak?: number
    recentMatches: Array<{
      opponentName: string
      score: string
      won: boolean
      playedAt: string
    }>
  }
  player2: {
    id: string
    name: string
    elo: number
    utrRating?: number
    winStreak?: number
    lossStreak?: number
    recentMatches: Array<{
      opponentName: string
      score: string
      won: boolean
      playedAt: string
    }>
  }
  headToHead: Array<{
    score: string
    winner: string
    playedAt: string
  }>
  match: {
    score: string
    winnerId: string
    tournamentId?: string
    tournamentName?: string
  }
  matchWeightFactors: {
    formatWeight: number
    competitivenessWeight: number
    reliabilityWeight: number
    finalWeight: number
  }
  formatDetected: MatchFormat
}

/**
 * Build comprehensive match context for LLM
 */
export function buildMatchContext(
  request: LlmEloCalculationRequest,
  player1: Player & { recentMatches?: any[], headToHead?: any[] },
  player2: Player & { recentMatches?: any[], headToHead?: any[] },
  matchWeightFactors: {
    formatWeight: number
    competitivenessWeight: number
    reliabilityWeight: number
    finalWeight: number
  },
  formatDetected: MatchFormat,
  tournamentName?: string
): MatchContext {
  return {
    player1: {
      id: request.player1Id,
      name: player1.name,
      elo: request.player1Elo,
      utrRating: (player1 as any).utr_rating,
      winStreak: (player1 as any).win_streak || 0,
      lossStreak: (player1 as any).loss_streak || 0,
      recentMatches: (player1.recentMatches || []).slice(0, 5).map(m => ({
        opponentName: m.opponent?.name || 'Unknown',
        score: m.score || '',
        won: m.was_winner || false,
        playedAt: m.created_at || ''
      }))
    },
    player2: {
      id: request.player2Id,
      name: player2.name,
      elo: request.player2Elo,
      utrRating: (player2 as any).utr_rating,
      winStreak: (player2 as any).win_streak || 0,
      lossStreak: (player2 as any).loss_streak || 0,
      recentMatches: (player2.recentMatches || []).slice(0, 5).map(m => ({
        opponentName: m.opponent?.name || 'Unknown',
        score: m.score || '',
        won: m.was_winner || false,
        playedAt: m.created_at || ''
      }))
    },
    headToHead: (player1.headToHead || []).map(m => ({
      score: m.score || '',
      winner: m.was_winner ? player1.name : player2.name,
      playedAt: m.created_at || ''
    })),
    match: {
      score: request.score,
      winnerId: request.winnerId,
      tournamentId: request.tournamentId,
      tournamentName: tournamentName
    },
    matchWeightFactors,
    formatDetected
  }
}

/**
 * Get the main prompt for ELO calculation
 */
export function getEloCalculationPrompt(context: MatchContext): string {
  const winner = context.match.winnerId === context.player1.id ? context.player1.name : context.player2.name
  const loser = context.match.winnerId === context.player1.id ? context.player2.name : context.player1.name
  
  return `You are an expert tennis rating system analyst. Your task is to calculate ELO rating changes for a completed tennis match using UTR (Universal Tennis Rating) methodology adapted to ELO scale.

## MATCH INFORMATION

**Players:**
- ${context.player1.name} (ELO: ${context.player1.elo}${context.player1.utrRating ? `, UTR: ${context.player1.utrRating}` : ''}${context.player1.winStreak ? `, Current Win Streak: ${context.player1.winStreak}` : ''}${context.player1.lossStreak ? `, Current Loss Streak: ${context.player1.lossStreak}` : ''})
- ${context.player2.name} (ELO: ${context.player2.elo}${context.player2.utrRating ? `, UTR: ${context.player2.utrRating}` : ''}${context.player2.winStreak ? `, Current Win Streak: ${context.player2.winStreak}` : ''}${context.player2.lossStreak ? `, Current Loss Streak: ${context.player2.lossStreak}` : ''})

**Match Result:**
- Score: ${context.match.score}
- Winner: ${winner}
- Format Detected: ${context.formatDetected}
${context.match.tournamentName ? `- Tournament: ${context.match.tournamentName}` : ''}

## MATCH WEIGHT FACTORS

These factors should influence the magnitude of ELO changes:
- Format Weight: ${context.matchWeightFactors.formatWeight} (${getFormatWeightDescription(context.matchWeightFactors.formatWeight)})
- Competitiveness Weight: ${context.matchWeightFactors.competitivenessWeight} (${getCompetitivenessDescription(context.matchWeightFactors.competitivenessWeight)})
- Reliability Weight: ${context.matchWeightFactors.reliabilityWeight} (${getReliabilityDescription(context.matchWeightFactors.reliabilityWeight)})
- **Final Match Weight: ${context.matchWeightFactors.finalWeight}** (Format × Competitiveness × Reliability)

## PLAYER CONTEXT

### ${context.player1.name}
**Recent Form (Last 5 matches):**
${context.player1.recentMatches.length > 0 
  ? context.player1.recentMatches.map((m, i) => 
    `${i + 1}. vs ${m.opponentName}: ${m.score} (${m.won ? 'W' : 'L'}) - ${new Date(m.playedAt).toLocaleDateString()}`
  ).join('\n')
  : 'No recent matches'
}

### ${context.player2.name}
**Recent Form (Last 5 matches):**
${context.player2.recentMatches.length > 0 
  ? context.player2.recentMatches.map((m, i) => 
    `${i + 1}. vs ${m.opponentName}: ${m.score} (${m.won ? 'W' : 'L'}) - ${new Date(m.playedAt).toLocaleDateString()}`
  ).join('\n')
  : 'No recent matches'
}

### Head-to-Head Record
${context.headToHead.length > 0
  ? context.headToHead.map((m, i) => 
    `${i + 1}. ${m.winner} won ${m.score} - ${new Date(m.playedAt).toLocaleDateString()}`
  ).join('\n')
  : 'No previous matches'
}

## CALCULATION REQUIREMENTS

1. **ELO Changes**: Calculate ELO changes for both players. The changes MUST sum to zero (zero-sum property):
   - If ${context.player1.name} gains +X ELO, ${context.player2.name} must lose -X ELO
   - Formula: player1_elo_change + player2_elo_change = 0
   - **Typical ELO change ranges**: 
     * Close match (similar ratings): 15-25 points for winner
     * Moderate difference (100-200 ELO): 20-35 points for winner
     * Large difference (>200 ELO): 10-20 points for higher rated winner, 30-50 points for upset
   - Higher match weight should result in higher ELO changes within these ranges

2. **Match Weight Consideration**: The match weight (${context.matchWeightFactors.finalWeight}) should influence the magnitude of ELO changes:
   - Higher weight = more significant ELO changes (toward upper end of typical ranges)
   - Lower weight = less significant ELO changes (toward lower end of typical ranges)
   - Incorporate match weight into your calculation to scale within the typical ranges above

3. **Match Rating**: Calculate the match rating for ${context.player1.name} based on:
   - Expected games won % = 1 / (1 + 10^((opponent_elo - player_elo) / 400))
   - Actual games won % = games_won / total_games
   - Performance factor = actual % - expected %
   - Match rating = player's current ELO + (performance factor * 400)

4. **Games Analysis**: Parse the score "${context.match.score}" to extract:
   - Games won by ${context.player1.name}
   - Games lost by ${context.player1.name}
   - Total games in the match

## RESPONSE FORMAT

Return a valid JSON object with the following structure:

\`\`\`json
{
  "player1_elo_change": <number>,
  "player2_elo_change": <number>,
  "match_rating": <number>,
  "match_weight": ${context.matchWeightFactors.finalWeight},
  "format_detected": "${context.formatDetected}",
  "games_won_p1": <number>,
  "games_lost_p1": <number>,
  "total_games": <number>,
  "reasoning": "<detailed explanation of your calculation>"
}
\`\`\`

## CRITICAL RULES

1. **Zero-Sum Validation**: player1_elo_change + player2_elo_change MUST equal 0 (within ±2 for rounding)
2. **Match Weight**: Consider the final match weight (${context.matchWeightFactors.finalWeight}) when determining ELO change magnitude
3. **Format**: Ensure format_detected matches "${context.formatDetected}"
4. **Games Count**: Verify games_won_p1 + games_lost_p1 = total_games
5. **Reasoning**: Provide clear explanation of how you calculated the ELO changes, considering:
   - Player ratings difference
   - Match competitiveness
   - Score margin (games won/lost)
   - Match weight factors
   - Recent form and head-to-head
   - **Win/Loss streaks** (players on winning streaks may deserve slightly higher ELO gains; players on losing streaks may deserve slightly lower ELO losses)

Now calculate the ELO changes and return the JSON response.`
}

function getFormatWeightDescription(weight: number): string {
  if (weight >= 1.2) return 'Best-of-5 sets (high weight)'
  if (weight >= 1.0) return 'Best-of-3 sets (standard weight)'
  if (weight >= 0.9) return 'Pro set 10 games'
  if (weight >= 0.8) return 'Pro set 8 games'
  if (weight >= 0.7) return 'Super tiebreak'
  if (weight >= 0.5) return 'Walkover (minimal weight)'
  return 'Unknown format'
}

function getCompetitivenessDescription(weight: number): string {
  if (weight >= 1.0) return 'Very close ratings (< 100 difference)'
  if (weight >= 0.9) return 'Close ratings (100-200 difference)'
  if (weight >= 0.8) return 'Moderate difference (200-300)'
  return 'Large difference (> 300)'
}

function getReliabilityDescription(weight: number): string {
  if (weight >= 0.9) return 'Highly reliable opponent'
  if (weight >= 0.7) return 'Moderately reliable'
  if (weight >= 0.5) return 'Somewhat reliable'
  return 'Low reliability (new/inactive player)'
}
