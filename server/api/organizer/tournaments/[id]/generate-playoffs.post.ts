import { getSupabaseAdmin } from '~/server/utils/supabase'
import { logger } from '~/server/utils/logger'
import { requireOrganizer, verifyOrganizerOwnsTournament } from '~/server/utils/organizer'
import { 
  calculateGroupStandings, 
  determineGroupQualifiers, 
  generatePlayoffBracket,
  recalculateGroupStandings 
} from '~/server/utils/tournament-brackets'
import type { Tournament } from '~/types'
import { clerkIdBodySchema, tournamentIdSchema, validateBody, validateQuery } from '~/server/utils/validation'
import type { SupabaseClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  try {
    const { clerk_id: clerkId } = validateBody(clerkIdBodySchema, await readBody(event))
    const tournamentId = validateQuery(tournamentIdSchema, getRouterParam(event, 'id'))

    await requireOrganizer(clerkId)

    const supabase = getSupabaseAdmin()

    // Get organizer's player ID
    const { data: organizer, error: organizerError } = await supabase
      .from('players')
      .select('id')
      .eq('clerk_id', clerkId)
      .single()

    if (organizerError || !organizer) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Organizer not found'
      })
    }

    // Verify organizer owns this tournament
    await verifyOrganizerOwnsTournament(organizer.id, tournamentId, supabase)

    // Get tournament info
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('id, name, status, format, group_stage_config, playoff_config')
      .eq('id', tournamentId)
      .single()

    if (tournamentError || !tournament) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Tournament not found'
      })
    }

    // Check if playoff brackets already exist
    const { data: existingPlayoffs } = await supabase
      .from('tournament_matches')
      .select('id')
      .eq('tournament_id', tournamentId)
      .in('bracket_type', ['main', 'backdraw'])
      .limit(1)

    if (existingPlayoffs && existingPlayoffs.length > 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Playoff brackets have already been generated for this tournament'
      })
    }

    // Get all groups
    const { data: groups, error: groupsError } = await supabase
      .from('tournament_groups')
      .select('id, group_number')
      .eq('tournament_id', tournamentId)
      .order('group_number', { ascending: true })

    if (groupsError || !groups || groups.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'No groups found for tournament'
      })
    }

    // Calculate standings for each group and determine qualifiers
    const groupsWithStandings: Array<{
      groupId: string
      players: Array<{
        playerId: string
        wins: number
        losses: number
        sets_won: number
        sets_lost: number
        games_won: number
        games_lost: number
        points: number
        game_difference: number
        head_to_head: Map<string, number>
      }>
    }> = []

    for (const group of groups) {
      // Recalculate standings for this group
      await recalculateGroupStandings(tournamentId, group.id, supabase)

      // Get group matches to calculate standings
      const { data: groupMatches, error: matchesError } = await supabase
        .from('tournament_matches')
        .select(`
          matches!inner(
            player1_id,
            player2_id,
            winner_id,
            score,
            status
          )
        `)
        .eq('tournament_id', tournamentId)
        .eq('group_id', group.id)
        .eq('bracket_type', 'group')

      if (matchesError) {
        logger.error('Error fetching matches for group', matchesError, { groupId: group.id, tournamentId })
        continue
      }

      // Calculate standings with head-to-head
      type GroupMatchRow = {
        matches?: Array<{
          player1_id: string | null
          player2_id: string | null
          winner_id: string | null
          score: string | null
          status: string | null
        }>
      }

      const completedMatches = (groupMatches || [])
        .flatMap((tm) => {
          const row = tm as unknown as GroupMatchRow
          const match = Array.isArray(row.matches) ? row.matches[0] : undefined
          if (!match || match.status !== 'completed' || !match.winner_id || !match.player1_id || !match.player2_id) return []
          return [
            {
              player1_id: match.player1_id,
              player2_id: match.player2_id,
              winner_id: match.winner_id,
              score: match.score ?? undefined
            }
          ]
        })

      const calculatedStandings = calculateGroupStandings(
        group.id,
        completedMatches,
        tournament as unknown as Tournament
      )

      // Convert standings to array format
      const playersArray = Array.from(calculatedStandings.entries()).map(([playerId, standing]) => ({
        playerId,
        ...standing
      }))

      groupsWithStandings.push({
        groupId: group.id,
        players: playersArray
      })
    }

    // Determine qualifiers (top 2 from each group for main bracket, rest for backdraw)
    const advanceCount = 2 // Top 2 advance to main bracket
    const mainQualifiers = determineGroupQualifiers(groupsWithStandings, advanceCount)

    // Get all players who didn't qualify for main bracket
    const allGroupPlayers = new Set<string>()
    groupsWithStandings.forEach(g => {
      g.players.forEach(p => allGroupPlayers.add(p.playerId))
    })
    const backdrawQualifiers = Array.from(allGroupPlayers).filter(
      playerId => !mainQualifiers.includes(playerId)
    )

    // Randomize qualifiers before generating brackets (shuffle arrays)
    const shuffleArray = <T>(array: T[]): T[] => {
      const shuffled = [...array]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const temp = shuffled[i]!
        shuffled[i] = shuffled[j]!
        shuffled[j] = temp
      }
      return shuffled
    }

    const randomizedMainQualifiers = shuffleArray(mainQualifiers)
    const randomizedBackdrawQualifiers = shuffleArray(backdrawQualifiers)

    // Generate main bracket
    let mainMatchesCount = 0
    if (randomizedMainQualifiers.length > 0) {
      const mainBracket = generatePlayoffBracket(randomizedMainQualifiers, 'main')
      mainMatchesCount = await createPlayoffMatches(tournamentId, mainBracket, 'main', supabase)
    }

    // Generate backdraw bracket (if there are players)
    let backdrawMatchesCount = 0
    if (randomizedBackdrawQualifiers.length > 0) {
      const backdrawBracket = generatePlayoffBracket(randomizedBackdrawQualifiers, 'backdraw')
      backdrawMatchesCount = await createPlayoffMatches(tournamentId, backdrawBracket, 'backdraw', supabase)
    }

    return {
      success: true,
      message: 'Playoff brackets generated successfully',
      mainQualifiers: mainQualifiers.length,
      backdrawQualifiers: backdrawQualifiers.length,
      mainMatches: mainMatchesCount,
      backdrawMatches: backdrawMatchesCount
    }
  } catch (error: unknown) {
    handleApiError(error, 'POST /api/organizer/tournaments/[id]/generate-playoffs')
  }
})

/**
 * Create playoff matches in database
 * @param tournamentId - Tournament ID
 * @param bracket - Bracket structure from generatePlayoffBracket
 * @param bracketType - 'main' or 'backdraw'
 * @param supabase - Supabase admin client
 * @returns Number of matches created
 */
async function createPlayoffMatches(
  tournamentId: string,
  bracket: Array<{
    round: number
    matchNumber: number
    player1_id?: string
    player2_id?: string
    is_bye: boolean
  }>,
  bracketType: 'main' | 'backdraw',
  supabase: SupabaseClient
): Promise<number> {
  const tournamentMatchRecords: Array<{
    tournament_id: string
    match_id: string | null
    bracket_type: 'main' | 'backdraw'
    round_number: number
    bracket_position: number
    is_bye: boolean
    player_id?: string
  }> = []

  for (const bracketMatch of bracket) {
    // Only create matches for the first round (round 1) where we have actual player IDs
    // Subsequent rounds will be created when previous round matches complete
    if (bracketMatch.round !== 1) {
      continue
    }

    // Handle bye matches - create tournament_match record with player_id but no actual match
    if (bracketMatch.is_bye) {
      const byePlayerId = bracketMatch.player1_id || bracketMatch.player2_id
      if (!byePlayerId) {
        continue
      }
      
      // Validate that player ID is an actual UUID, not a placeholder
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(byePlayerId)) {
        continue
      }

      // Create tournament match record for bye (no actual match record, but store player_id)
      tournamentMatchRecords.push({
        tournament_id: tournamentId,
        match_id: null, // No actual match for byes
        bracket_type: bracketType,
        round_number: bracketMatch.round,
        bracket_position: bracketMatch.matchNumber,
        is_bye: true,
        player_id: byePlayerId // Store the player who gets the bye
      })
      continue
    }

    if (!bracketMatch.player1_id || !bracketMatch.player2_id) {
      continue
    }

    // Validate that player IDs are actual UUIDs, not placeholders
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(bracketMatch.player1_id) || !uuidRegex.test(bracketMatch.player2_id)) {
      continue
    }

    // Create match record
    const { data: matchRecord, error: matchError } = await supabase
      .from('matches')
      .insert({
        player1_id: bracketMatch.player1_id,
        player2_id: bracketMatch.player2_id,
        tournament_id: tournamentId,
        status: 'scheduled',
        scheduled_at: null // Players will schedule later
      })
      .select()
      .single()

    if (matchError || !matchRecord) {
      logger.error('Error creating playoff match', matchError, { tournamentId })
      continue
    }

    // Create tournament match record
    tournamentMatchRecords.push({
      tournament_id: tournamentId,
      match_id: matchRecord.id,
      bracket_type: bracketType,
      round_number: bracketMatch.round,
      bracket_position: bracketMatch.matchNumber,
      is_bye: false
    })
  }

  // Insert tournament matches
  if (tournamentMatchRecords.length > 0) {
    const { error: tmError } = await supabase
      .from('tournament_matches')
      .insert(tournamentMatchRecords)

    if (tmError) {
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to create ${bracketType} playoff matches`,
        data: tmError
      })
    }
  }

  return tournamentMatchRecords.length
}

