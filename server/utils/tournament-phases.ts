import { createError } from 'h3'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { useDb, type DbOrTx } from '../db'
import { matches, tournament_groups, tournament_matches, tournaments } from '../db/schema'
import {
  calculateGroupStandings,
  determineGroupQualifiers,
  generatePlayoffBracket,
  getCompletedGroupMatches,
  recalculateGroupStandings
} from './tournament-brackets'

type StageStatus = { isComplete: boolean; totalMatches: number; completedMatches: number; pendingMatches: number }

async function stageStatus(
  tournamentId: string,
  bracketType: 'group' | 'main' | 'backdraw',
  statusMessage: string,
  tx?: DbOrTx
): Promise<StageStatus> {
  let rows
  try {
    rows = await (tx ?? useDb()).query.tournament_matches.findMany({
      columns: {},
      where: and(eq(tournament_matches.tournament_id, tournamentId), eq(tournament_matches.bracket_type, bracketType)),
      with: { match: { columns: { id: true, status: true, winner_id: true } } },
    })
  } catch (error) {
    throw createError({ statusCode: 500, statusMessage, data: error })
  }

  const totalMatches = rows.length
  const completedMatches = rows.filter((tm) => tm.match?.status === 'completed' && tm.match?.winner_id).length
  const pendingMatches = totalMatches - completedMatches

  return {
    isComplete: totalMatches > 0 && pendingMatches === 0,
    totalMatches,
    completedMatches,
    pendingMatches
  }
}

/**
 * Check if group stage is complete (all matches completed)
 * @param tournamentId - Tournament ID
 * @param tx - Optional transaction to run in
 * @returns Object with isComplete boolean and details
 */
export async function checkGroupStageComplete(tournamentId: string, tx?: DbOrTx): Promise<StageStatus> {
  return stageStatus(tournamentId, 'group', 'Failed to check group stage status', tx)
}

/**
 * Check if playoffs are complete (all matches completed)
 * @param tournamentId - Tournament ID
 * @param bracketType - 'main' or 'backdraw'
 * @param tx - Optional transaction to run in
 * @returns Object with isComplete boolean and details
 */
export async function checkPlayoffsComplete(
  tournamentId: string,
  bracketType: 'main' | 'backdraw',
  tx?: DbOrTx
): Promise<StageStatus> {
  return stageStatus(tournamentId, bracketType, 'Failed to check playoffs status', tx)
}

/**
 * Get current phase status for a tournament
 * @param tournamentId - Tournament ID
 * @param tx - Optional transaction to run in
 * @returns Phase status object
 */
export async function getTournamentPhaseStatus(
  tournamentId: string,
  tx?: DbOrTx
): Promise<{
  currentPhase: string
  groupStageStatus?: StageStatus
  mainPlayoffsStatus?: StageStatus
  backdrawPlayoffsStatus?: StageStatus
  canAdvanceToPlayoffs: boolean
  canCompleteTournament: boolean
}> {
  const db = tx ?? useDb()

  const tournament = await db.query.tournaments.findFirst({
    columns: { current_phase: true, tournament_type: true },
    where: eq(tournaments.id, tournamentId),
  })

  if (!tournament) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Tournament not found'
    })
  }

  // Check if tournament has groups
  const group = await db.query.tournament_groups.findFirst({
    columns: { id: true },
    where: eq(tournament_groups.tournament_id, tournamentId),
  })

  const currentPhase = tournament.current_phase || 'registration'
  const hasGroups = Boolean(group)

  let groupStageStatus: StageStatus | undefined
  let mainPlayoffsStatus: StageStatus | undefined
  let backdrawPlayoffsStatus: StageStatus | undefined
  let canAdvanceToPlayoffs = false
  let canCompleteTournament = false

  // Check group stage if tournament has groups
  if (hasGroups && currentPhase === 'group_stage') {
    groupStageStatus = await checkGroupStageComplete(tournamentId, db)
    canAdvanceToPlayoffs = groupStageStatus.isComplete
  }

  // Check playoffs if tournament is in playoffs phase
  if (currentPhase === 'playoffs') {
    if (hasGroups) {
      // groups_playoffs format
      mainPlayoffsStatus = await checkPlayoffsComplete(tournamentId, 'main', db)
      backdrawPlayoffsStatus = await checkPlayoffsComplete(tournamentId, 'backdraw', db)
      canCompleteTournament = mainPlayoffsStatus.isComplete && backdrawPlayoffsStatus.isComplete
    } else {
      // Single elimination format
      mainPlayoffsStatus = await checkPlayoffsComplete(tournamentId, 'main', db)
      canCompleteTournament = mainPlayoffsStatus.isComplete
    }
  }

  return {
    currentPhase,
    groupStageStatus,
    mainPlayoffsStatus,
    backdrawPlayoffsStatus,
    canAdvanceToPlayoffs,
    canCompleteTournament
  }
}

/**
 * Advance tournament to next phase. All-or-nothing: the playoff brackets and the phase change land together.
 * @param tournamentId - Tournament ID
 * @param tx - Optional transaction to run in
 * @returns New phase
 */
export async function advanceTournamentPhase(tournamentId: string, tx?: DbOrTx): Promise<string> {
  return (tx ?? useDb()).transaction(async (db) => {
    // Lock the row so two concurrent advances cannot both pass the phase checks.
    await db.select({ id: tournaments.id }).from(tournaments).where(eq(tournaments.id, tournamentId)).for('update')

    const phaseStatus = await getTournamentPhaseStatus(tournamentId, db)

    let newPhase: 'group_stage' | 'playoffs' | 'completed'

    if (phaseStatus.currentPhase === 'registration') {
      // Can only advance to group_stage if brackets are generated
      const group = await db.query.tournament_groups.findFirst({
        columns: { id: true },
        where: eq(tournament_groups.tournament_id, tournamentId),
      })

      if (group) {
        newPhase = 'group_stage'
      } else {
        throw createError({
          statusCode: 400,
          statusMessage: 'Cannot advance to group stage: brackets not generated yet'
        })
      }
    } else if (phaseStatus.currentPhase === 'group_stage') {
      if (!phaseStatus.canAdvanceToPlayoffs) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Cannot advance to playoffs: group stage not complete'
        })
      }
      newPhase = 'playoffs'

      // Generate playoff brackets automatically
      await generatePlayoffBracketsFromGroups(tournamentId, db)
    } else if (phaseStatus.currentPhase === 'playoffs') {
      if (!phaseStatus.canCompleteTournament) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Cannot complete tournament: playoffs not complete'
        })
      }
      newPhase = 'completed'
    } else {
      throw createError({
        statusCode: 400,
        statusMessage: `Cannot advance from phase: ${phaseStatus.currentPhase}`
      })
    }

    // Update tournament phase; completing also completes the status
    await db
      .update(tournaments)
      .set({
        current_phase: newPhase,
        ...(newPhase === 'completed' ? { status: 'completed' as const } : {}),
        updated_at: new Date()
      })
      .where(eq(tournaments.id, tournamentId))

    return newPhase
  })
}

/**
 * Generate playoff brackets from completed group stage
 * @param tournamentId - Tournament ID
 * @param db - The transaction to run in
 */
async function generatePlayoffBracketsFromGroups(tournamentId: string, db: DbOrTx): Promise<void> {
  const tournament = await db.query.tournaments.findFirst({ where: eq(tournaments.id, tournamentId) })

  if (!tournament) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Tournament not found'
    })
  }

  // Check if playoff brackets already exist
  const existingPlayoff = await db.query.tournament_matches.findFirst({
    columns: { id: true },
    where: and(
      eq(tournament_matches.tournament_id, tournamentId),
      inArray(tournament_matches.bracket_type, ['main', 'backdraw'])
    ),
  })

  if (existingPlayoff) {
    // Playoffs already generated, skip
    return
  }

  const groups = await db.query.tournament_groups.findMany({
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
    await recalculateGroupStandings(tournamentId, group.id, db)

    // Calculate standings with head-to-head
    const completedMatches = await getCompletedGroupMatches(tournamentId, group.id, db)
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
  if (randomizedMainQualifiers.length > 0) {
    const mainBracket = generatePlayoffBracket(randomizedMainQualifiers, 'main')
    await createPlayoffMatches(tournamentId, mainBracket, 'main', db)
  }

  // Generate backdraw bracket (if there are players)
  if (randomizedBackdrawQualifiers.length > 0) {
    const backdrawBracket = generatePlayoffBracket(randomizedBackdrawQualifiers, 'backdraw')
    await createPlayoffMatches(tournamentId, backdrawBracket, 'backdraw', db)
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Create playoff matches in database (round 1 only; byes get no rows here)
 * @param tournamentId - Tournament ID
 * @param bracket - Bracket structure from generatePlayoffBracket
 * @param bracketType - 'main' or 'backdraw'
 * @param db - The transaction to run in
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
  db: DbOrTx
): Promise<void> {
  for (const bracketMatch of bracket) {
    // Byes need no match record; later rounds are created as earlier ones complete
    if (bracketMatch.is_bye || bracketMatch.round !== 1) {
      continue
    }

    const { player1_id, player2_id } = bracketMatch
    // Only actual player ids, never winner placeholders
    if (!player1_id || !player2_id || !UUID_REGEX.test(player1_id) || !UUID_REGEX.test(player2_id)) {
      continue
    }

    const [matchRecord] = await db
      .insert(matches)
      .values({
        player1_id,
        player2_id,
        tournament_id: tournamentId,
        status: 'scheduled',
        scheduled_at: null // Players will schedule later
      })
      .returning({ id: matches.id })

    await db.insert(tournament_matches).values({
      tournament_id: tournamentId,
      match_id: matchRecord.id,
      bracket_type: bracketType,
      round_number: bracketMatch.round,
      bracket_position: String(bracketMatch.matchNumber),
      is_bye: false
    })
  }
}
