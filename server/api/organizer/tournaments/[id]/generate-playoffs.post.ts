import { and, asc, eq, inArray } from 'drizzle-orm'
import { useDb, type DbOrTx } from '~/server/db'
import { matches, tournament_groups, tournament_matches, tournaments } from '~/server/db/schema'
import { requirePlayer } from '~/server/utils/session'
import { verifyOrganizerOwnsTournament } from '~/server/utils/organizer'
import {
  calculateGroupStandings,
  determineGroupQualifiers,
  generatePlayoffBracket,
  getCompletedGroupMatches,
  recalculateGroupStandings
} from '~/server/utils/tournament-brackets'

export default defineEventHandler(async (event) => {
  const { player: organizer } = await requirePlayer(event, 'organizer')

  try {
    const tournamentId = getRouterParam(event, 'id')

    if (!tournamentId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Tournament ID is required'
      })
    }

    // Verify organizer owns this tournament
    await verifyOrganizerOwnsTournament(organizer.id, tournamentId)

    // Standings, main bracket and backdraw bracket land together or not at all
    return await useDb().transaction(async (tx) => {
      // Lock the row so two concurrent generations cannot both pass the "already generated" check
      const [tournament] = await tx.select().from(tournaments).where(eq(tournaments.id, tournamentId)).for('update')

      if (!tournament) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Tournament not found'
        })
      }

      // Check if playoff brackets already exist
      const existingPlayoff = await tx.query.tournament_matches.findFirst({
        columns: { id: true },
        where: and(
          eq(tournament_matches.tournament_id, tournamentId),
          inArray(tournament_matches.bracket_type, ['main', 'backdraw'])
        ),
      })

      if (existingPlayoff) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Playoff brackets have already been generated for this tournament'
        })
      }

      const groups = await tx.query.tournament_groups.findMany({
        columns: { id: true, group_number: true },
        where: eq(tournament_groups.tournament_id, tournamentId),
        orderBy: [asc(tournament_groups.group_number)],
      })

      if (groups.length === 0) {
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
        await recalculateGroupStandings(tournamentId, group.id, tx)

        // Calculate standings with head-to-head
        const completedMatches = await getCompletedGroupMatches(tournamentId, group.id, tx)
        const calculatedStandings = calculateGroupStandings(group.id, completedMatches, tournament)

        groupsWithStandings.push({
          groupId: group.id,
          players: Array.from(calculatedStandings.entries()).map(([playerId, standing]) => ({ playerId, ...standing }))
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
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
        }
        return shuffled
      }

      const randomizedMainQualifiers = shuffleArray(mainQualifiers)
      const randomizedBackdrawQualifiers = shuffleArray(backdrawQualifiers)

      // Generate main bracket
      let mainMatchesCount = 0
      if (randomizedMainQualifiers.length > 0) {
        const mainBracket = generatePlayoffBracket(randomizedMainQualifiers, 'main')
        mainMatchesCount = await createPlayoffMatches(tournamentId, mainBracket, 'main', tx)
      }

      // Generate backdraw bracket (if there are players)
      let backdrawMatchesCount = 0
      if (randomizedBackdrawQualifiers.length > 0) {
        const backdrawBracket = generatePlayoffBracket(randomizedBackdrawQualifiers, 'backdraw')
        backdrawMatchesCount = await createPlayoffMatches(tournamentId, backdrawBracket, 'backdraw', tx)
      }

      return {
        success: true,
        message: 'Playoff brackets generated successfully',
        mainQualifiers: mainQualifiers.length,
        backdrawQualifiers: backdrawQualifiers.length,
        mainMatches: mainMatchesCount,
        backdrawMatches: backdrawMatchesCount
      }
    })
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Create round 1 playoff matches in database; a bye gets a tournament_matches row with its player and no match
 * @param tournamentId - Tournament ID
 * @param bracket - Bracket structure from generatePlayoffBracket
 * @param bracketType - 'main' or 'backdraw'
 * @param tx - The transaction to run in
 * @returns Number of tournament match rows created
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
  tx: DbOrTx
): Promise<number> {
  const tournamentMatchRecords: Array<typeof tournament_matches.$inferInsert> = []

  for (const bracketMatch of bracket) {
    // Subsequent rounds are created when previous round matches complete
    if (bracketMatch.round !== 1) {
      continue
    }

    if (bracketMatch.is_bye) {
      const byePlayerId = bracketMatch.player1_id || bracketMatch.player2_id
      // Only actual player ids, never winner placeholders
      if (!byePlayerId || !UUID_REGEX.test(byePlayerId)) {
        continue
      }
      tournamentMatchRecords.push({
        tournament_id: tournamentId,
        match_id: null, // No actual match for byes
        bracket_type: bracketType,
        round_number: bracketMatch.round,
        bracket_position: String(bracketMatch.matchNumber),
        is_bye: true,
        player_id: byePlayerId // The player who gets the bye
      })
      continue
    }

    const { player1_id, player2_id } = bracketMatch
    if (!player1_id || !player2_id || !UUID_REGEX.test(player1_id) || !UUID_REGEX.test(player2_id)) {
      continue
    }

    const [matchRecord] = await tx
      .insert(matches)
      .values({
        player1_id,
        player2_id,
        tournament_id: tournamentId,
        status: 'scheduled',
        scheduled_at: null // Players will schedule later
      })
      .returning({ id: matches.id })

    tournamentMatchRecords.push({
      tournament_id: tournamentId,
      match_id: matchRecord.id,
      bracket_type: bracketType,
      round_number: bracketMatch.round,
      bracket_position: String(bracketMatch.matchNumber),
      is_bye: false
    })
  }

  if (tournamentMatchRecords.length > 0) {
    await tx.insert(tournament_matches).values(tournamentMatchRecords)
  }

  return tournamentMatchRecords.length
}
