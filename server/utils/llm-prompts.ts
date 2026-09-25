/**
 * LLM Prompt Templates for ELO Calculation
 * Uses OpenRouter API to calculate ELO changes based on match context
 */

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
  // The players' state the rating is computed from, by player id, when it differs from their stored rows
  // (a recalculation reads it after reversing the match). The stored rows are used when absent.
  playerStates?: Record<string, LlmPlayerState>
}

export interface LlmPlayerState {
  win_streak: number | null
  loss_streak: number | null
  total_matches_played: number | null
  last_match_at: Date | null
}

// One of a player's previous rated matches, as the resolver reads it from rating_history
export interface LlmHistoryEntry {
  score: string | null
  was_winner: boolean
  created_at: Date | string | null
  opponent?: { name: string } | null
}

export interface LlmPlayerInput {
  name: string
  utr_rating: number | null
  win_streak: number | null
  loss_streak: number | null
  recentMatches?: LlmHistoryEntry[]
  headToHead?: LlmHistoryEntry[]
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
  player1: LlmPlayerInput,
  player2: LlmPlayerInput,
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
      utrRating: player1.utr_rating ?? undefined,
      winStreak: player1.win_streak || 0,
      lossStreak: player1.loss_streak || 0,
      recentMatches: (player1.recentMatches || []).slice(0, 5).map(m => ({
        opponentName: m.opponent?.name || 'Unknown',
        score: m.score || '',
        won: m.was_winner || false,
        playedAt: m.created_at ? new Date(m.created_at).toISOString() : ''
      }))
    },
    player2: {
      id: request.player2Id,
      name: player2.name,
      elo: request.player2Elo,
      utrRating: player2.utr_rating ?? undefined,
      winStreak: player2.win_streak || 0,
      lossStreak: player2.loss_streak || 0,
      recentMatches: (player2.recentMatches || []).slice(0, 5).map(m => ({
        opponentName: m.opponent?.name || 'Unknown',
        score: m.score || '',
        won: m.was_winner || false,
        playedAt: m.created_at ? new Date(m.created_at).toISOString() : ''
      }))
    },
    headToHead: (player1.headToHead || []).slice(0, 5).map(m => ({
      score: m.score || '',
      winner: m.was_winner ? player1.name : player2.name,
      playedAt: m.created_at ? new Date(m.created_at).toISOString() : ''
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

1. **ELO Changes** (zero-sum: player1_change + player2_change = 0):
   - Base ranges: Close match 15-25, Moderate diff 20-35, Large diff 10-20 (upset 30-50)
   - Scale by match weight (${context.matchWeightFactors.finalWeight}): higher weight = higher changes
   - **Win Streak Bonus**: +6 for 2 wins, +12 for 3+ wins (capped). No bonus for 1 win. Loser gets no bonus.
   - **Walkover (WO) Penalty**: If format is "walkover", apply 25% multiplier to ELO changes (walkovers give minimal points). No win streak bonus for walkovers.

2. **Match Rating** for ${context.player1.name}:
   - Expected % = 1 / (1 + 10^((opponent_elo - player_elo) / 400))
   - Performance = (games_won / total_games) - expected %
   - Match rating = current_ELO + (performance * 400)

3. **Games**: Parse "${context.match.score}" → games_won_p1, games_lost_p1, total_games

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
  "reasoning": "<concise explanation of your calculation, max 500 words>"
}
\`\`\`

## CRITICAL RULES

1. Zero-sum: player1_elo_change + player2_elo_change = 0 (±2 rounding)
2. Match weight: Scale ELO changes by ${context.matchWeightFactors.finalWeight}
3. Format: format_detected must be "${context.formatDetected}"
4. Games: games_won_p1 + games_lost_p1 = total_games
5. **Walkover handling**: If format_detected is "walkover", multiply ELO changes by 0.25 (25% of normal points). Walkovers should not receive win streak bonuses.
6. Reasoning: Provide a concise explanation (max 500 words) covering: rating diff, competitiveness, score margin, match weight, recent form, head-to-head, and win streak bonus (if applied).

Return JSON response.`
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
