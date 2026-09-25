import { createError } from 'h3'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { useDb, type DbOrTx } from '../db'
import { matches, tournament_matches, tournament_rounds, type BracketType } from '../db/schema'

// Multi-row writes run in the caller's transaction when given one, otherwise in their own.
function inTransaction<T>(tx: DbOrTx | undefined, run: (db: DbOrTx) => Promise<T>): Promise<T> {
  return tx ? run(tx) : useDb().transaction((t) => run(t))
}

function parseDeadline(value: string): Date {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid deadline' })
  }
  return date
}

/**
 * Create group stage deadline (one deadline for all group matches)
 * @param tournamentId - Tournament ID
 * @param deadline - Deadline timestamp
 * @param tx - Optional transaction to run in
 */
export async function createGroupStageDeadline(
  tournamentId: string,
  deadline: string,
  tx?: DbOrTx
): Promise<void> {
  const deadlineAt = parseDeadline(deadline)

  await inTransaction(tx, async (db) => {
    // Check if group stage round already exists
    const existingRound = await db.query.tournament_rounds.findFirst({
      columns: { id: true },
      where: and(
        eq(tournament_rounds.tournament_id, tournamentId),
        eq(tournament_rounds.bracket_type, 'group'),
        eq(tournament_rounds.round_number, 1)
      ),
    })

    try {
      if (existingRound) {
        // Update existing deadline
        await db
          .update(tournament_rounds)
          .set({ deadline: deadlineAt, updated_at: new Date() })
          .where(eq(tournament_rounds.id, existingRound.id))
      } else {
        // Create new deadline
        await db.insert(tournament_rounds).values({
          tournament_id: tournamentId,
          round_number: 1,
          round_name: 'Group Stage',
          bracket_type: 'group',
          deadline: deadlineAt,
          status: 'upcoming'
        })
      }
    } catch (error) {
      throw createError({
        statusCode: 500,
        statusMessage: existingRound ? 'Failed to update group stage deadline' : 'Failed to create group stage deadline',
        data: error
      })
    }

    // Update all group matches with this deadline
    await db
      .update(tournament_matches)
      .set({ round_deadline: deadlineAt })
      .where(and(eq(tournament_matches.tournament_id, tournamentId), eq(tournament_matches.bracket_type, 'group')))
  })
}

/**
 * Create playoff round deadlines (individual deadline per round)
 * @param tournamentId - Tournament ID
 * @param bracketType - 'main' or 'backdraw'
 * @param rounds - Array of round configurations
 * @param tx - Optional transaction to run in
 */
export async function createPlayoffRoundDeadlines(
  tournamentId: string,
  bracketType: 'main' | 'backdraw',
  rounds: Array<{
    round_number: number
    round_name: string
    deadline: string
  }>,
  tx?: DbOrTx
): Promise<void> {
  const parsed = rounds.map((round) => ({ ...round, deadlineAt: parseDeadline(round.deadline) }))

  await inTransaction(tx, async (db) => {
    for (const round of parsed) {
      // Check if round already exists
      const existingRound = await db.query.tournament_rounds.findFirst({
        columns: { id: true },
        where: and(
          eq(tournament_rounds.tournament_id, tournamentId),
          eq(tournament_rounds.bracket_type, bracketType),
          eq(tournament_rounds.round_number, round.round_number)
        ),
      })

      try {
        if (existingRound) {
          // Update existing deadline
          await db
            .update(tournament_rounds)
            .set({ deadline: round.deadlineAt, round_name: round.round_name, updated_at: new Date() })
            .where(eq(tournament_rounds.id, existingRound.id))
        } else {
          // Create new deadline
          await db.insert(tournament_rounds).values({
            tournament_id: tournamentId,
            round_number: round.round_number,
            round_name: round.round_name,
            bracket_type: bracketType,
            deadline: round.deadlineAt,
            status: 'upcoming'
          })
        }
      } catch (error) {
        throw createError({
          statusCode: 500,
          statusMessage: `Failed to ${existingRound ? 'update' : 'create'} ${bracketType} ${round.round_name} deadline`,
          data: error
        })
      }

      // Update all matches in this round with the deadline
      await db
        .update(tournament_matches)
        .set({ round_deadline: round.deadlineAt })
        .where(
          and(
            eq(tournament_matches.tournament_id, tournamentId),
            eq(tournament_matches.bracket_type, bracketType),
            eq(tournament_matches.round_number, round.round_number)
          )
        )
    }
  })
}

/**
 * Extend round deadline
 * @param tournamentId - Tournament ID
 * @param roundId - Round ID
 * @param newDeadline - New deadline timestamp
 * @param tx - Optional transaction to run in
 */
export async function extendRoundDeadline(
  tournamentId: string,
  roundId: string,
  newDeadline: string,
  tx?: DbOrTx
): Promise<void> {
  const deadlineAt = parseDeadline(newDeadline)

  await inTransaction(tx, async (db) => {
    // Get round info
    const round = await db.query.tournament_rounds.findFirst({
      where: and(eq(tournament_rounds.id, roundId), eq(tournament_rounds.tournament_id, tournamentId)),
    })

    if (!round) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Round not found'
      })
    }

    try {
      await db
        .update(tournament_rounds)
        .set({ deadline: deadlineAt, updated_at: new Date() })
        .where(eq(tournament_rounds.id, roundId))
    } catch (error) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to extend deadline',
        data: error
      })
    }

    // Update all matches in this round
    await db
      .update(tournament_matches)
      .set({ round_deadline: deadlineAt })
      .where(
        and(
          eq(tournament_matches.tournament_id, tournamentId),
          eq(tournament_matches.bracket_type, round.bracket_type),
          eq(tournament_matches.round_number, round.round_number)
        )
      )
  })
}

/**
 * Get unscheduled matches for a tournament: tournament matches whose match has no scheduled_at yet.
 * @param tournamentId - Tournament ID
 * @param tx - Optional transaction to run in
 * @returns Array of unscheduled matches
 */
export async function getUnscheduledMatches(tournamentId: string, tx?: DbOrTx) {
  const db = tx ?? useDb()
  try {
    return await db.query.tournament_matches.findMany({
      where: and(
        eq(tournament_matches.tournament_id, tournamentId),
        inArray(
          tournament_matches.match_id,
          db
            .select({ id: matches.id })
            .from(matches)
            .where(and(eq(matches.tournament_id, tournamentId), isNull(matches.scheduled_at)))
        )
      ),
      with: {
        match: { columns: { id: true, player1_id: true, player2_id: true, scheduled_at: true, status: true } },
      },
    })
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch unscheduled matches',
      data: error
    })
  }
}

/**
 * Get round deadline for a match
 * @param tournamentId - Tournament ID
 * @param bracketType - 'group', 'main', or 'backdraw'
 * @param roundNumber - Round number
 * @param tx - Optional transaction to run in
 * @returns Deadline or null
 */
async function getRoundDeadline(
  tournamentId: string,
  bracketType: BracketType,
  roundNumber: number,
  tx?: DbOrTx
): Promise<Date | null> {
  const round = await (tx ?? useDb()).query.tournament_rounds.findFirst({
    columns: { deadline: true },
    where: and(
      eq(tournament_rounds.tournament_id, tournamentId),
      eq(tournament_rounds.bracket_type, bracketType),
      eq(tournament_rounds.round_number, roundNumber)
    ),
  })

  return round?.deadline ?? null
}

/**
 * Validate match scheduling against round deadline
 * @param scheduledAt - Proposed scheduled time
 * @param roundDeadline - Round deadline
 * @returns true if valid, throws error if invalid
 */
function validateMatchScheduling(
  scheduledAt: string | Date,
  roundDeadline: Date | null
): boolean {
  if (!roundDeadline) {
    return true // No deadline set
  }

  const scheduled = new Date(scheduledAt)
  const deadline = new Date(roundDeadline)

  if (scheduled > deadline) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Match must be scheduled before round deadline'
    })
  }

  return true
}

/**
 * Validate and set match scheduling for tournament matches
 * @param matchId - Match ID
 * @param scheduledAt - Proposed scheduled time
 * @param tx - Optional transaction to run in
 * @returns true if valid
 */
export async function validateAndSetMatchScheduling(
  matchId: string,
  scheduledAt: string | Date,
  tx?: DbOrTx
): Promise<boolean> {
  // Get tournament match info
  const tournamentMatch = await (tx ?? useDb()).query.tournament_matches.findFirst({
    columns: { tournament_id: true, bracket_type: true, round_number: true, round_deadline: true },
    where: eq(tournament_matches.match_id, matchId),
  })

  if (!tournamentMatch) {
    // Not a tournament match, allow scheduling
    return true
  }

  // Validate against deadline
  const deadline = tournamentMatch.round_deadline || await getRoundDeadline(
    tournamentMatch.tournament_id,
    tournamentMatch.bracket_type,
    tournamentMatch.round_number || 1,
    tx
  )

  validateMatchScheduling(scheduledAt, deadline)

  return true
}
