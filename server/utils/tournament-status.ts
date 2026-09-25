import { createError } from 'h3'
import { and, count, eq, isNull } from 'drizzle-orm'
import { useDb, type DbOrTx } from '../db'
import { categories, players, tournament_registrations, tournaments } from '../db/schema'
import type { CreateTournamentPayload, UpdateTournamentPayload } from '~/types'
import { datetimeLocalToISO } from './timezone'
import { normalizePointsConfig } from './tournament-brackets'

type TournamentStatus = 'upcoming' | 'active' | 'completed'

/**
 * Check if registration is allowed based on tournament status
 * @param tournamentId - The tournament ID
 * @param tx - Optional transaction to run in
 * @returns true if registration is allowed, false otherwise
 */
export async function checkRegistrationAllowed(
  tournamentId: string,
  tx?: DbOrTx
): Promise<{ allowed: boolean; reason?: string }> {
  const tournament = await (tx ?? useDb()).query.tournaments.findFirst({
    columns: { status: true, registration_open: true, registration_deadline: true },
    where: eq(tournaments.id, tournamentId),
  })

  if (!tournament) {
    return { allowed: false, reason: 'Tournament not found' }
  }

  // Completed tournaments: no registration
  if (tournament.status === 'completed') {
    return { allowed: false, reason: 'Tournament is completed' }
  }

  // Registration must be open
  if (!tournament.registration_open) {
    return { allowed: false, reason: 'Registration is closed' }
  }

  // Check registration deadline
  if (tournament.registration_deadline) {
    const deadline = new Date(tournament.registration_deadline)
    const now = new Date()
    if (now > deadline) {
      return { allowed: false, reason: 'Registration deadline has passed' }
    }
  }

  return { allowed: true }
}

/**
 * Check if self-registration is allowed (only for upcoming tournaments)
 * @param tournamentId - The tournament ID
 * @param tx - Optional transaction to run in
 * @returns true if self-registration is allowed
 */
export async function checkSelfRegistrationAllowed(
  tournamentId: string,
  tx?: DbOrTx
): Promise<boolean> {
  const tournament = await (tx ?? useDb()).query.tournaments.findFirst({
    columns: { status: true },
    where: eq(tournaments.id, tournamentId),
  })

  if (!tournament) {
    return false
  }

  // Only upcoming tournaments allow self-registration
  return tournament.status === 'upcoming'
}

/**
 * Update tournament status (automatic or manual)
 * @param tournamentId - The tournament ID
 * @param status - New status
 * @param autoTransition - Whether this is an automatic transition
 * @param tx - Optional transaction to run in
 */
export async function updateTournamentStatus(
  tournamentId: string,
  status: TournamentStatus,
  autoTransition: boolean,
  tx?: DbOrTx
): Promise<void> {
  const db = tx ?? useDb()

  // If automatic transition to active, check start_date
  if (autoTransition && status === 'active') {
    const tournament = await db.query.tournaments.findFirst({
      columns: { start_date: true },
      where: eq(tournaments.id, tournamentId),
    })

    if (tournament && tournament.start_date) {
      const startDate = new Date(tournament.start_date)
      const now = new Date()
      if (now < startDate) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Cannot activate tournament before start date'
        })
      }
    }
  }

  try {
    await db.update(tournaments).set({ status }).where(eq(tournaments.id, tournamentId))
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update tournament status',
      data: error
    })
  }
}

/**
 * Get tournament status with automatic transition check
 * @param tournamentId - The tournament ID
 * @param tx - Optional transaction to run in
 * @returns Current tournament status (may be updated if auto-transition needed)
 */
export async function getTournamentStatus(
  tournamentId: string,
  tx?: DbOrTx
): Promise<TournamentStatus> {
  const tournament = await (tx ?? useDb()).query.tournaments.findFirst({
    columns: { status: true, start_date: true, end_date: true },
    where: eq(tournaments.id, tournamentId),
  })

  if (!tournament) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Tournament not found'
    })
  }

  const now = new Date()
  let currentStatus: TournamentStatus = tournament.status

  // Auto-transition to active if start_date has passed
  if (currentStatus === 'upcoming' && tournament.start_date) {
    const startDate = new Date(tournament.start_date)
    if (now >= startDate) {
      await updateTournamentStatus(tournamentId, 'active', true, tx)
      currentStatus = 'active'
    }
  }

  // Auto-transition to completed if end_date has passed
  if (currentStatus === 'active' && tournament.end_date) {
    const endDate = new Date(tournament.end_date)
    if (now >= endDate) {
      await updateTournamentStatus(tournamentId, 'completed', true, tx)
      currentStatus = 'completed'
    }
  }

  return currentStatus
}

/**
 * Register a player on behalf of an admin or the tournament's organizer: re-registers a withdrawn player,
 * waitlists when the tournament is full, refuses a player already registered.
 * @param tournamentId - The tournament ID
 * @param playerId - The player to register
 * @param tx - Optional transaction to run in
 */
export async function registerPlayerForTournament(tournamentId: string, playerId: string, tx?: DbOrTx) {
  const db = tx ?? useDb()

  const tournament = await db.query.tournaments.findFirst({ where: eq(tournaments.id, tournamentId) })
  if (!tournament) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Tournament not found'
    })
  }

  // Verify player exists and belongs to tournament category
  const player = await db.query.players.findFirst({
    columns: { id: true, category_id: true },
    where: eq(players.id, playerId),
  })
  if (!player) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Player not found'
    })
  }

  // If tournament.category_id is null, tournament is open to all players
  if (tournament.category_id && player.category_id !== tournament.category_id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Player does not belong to tournament category'
    })
  }

  const alreadyRegistered = () =>
    createError({
      statusCode: 400,
      statusMessage: 'Player is already registered'
    })

  // Check if already registered
  const existingRegistration = await db.query.tournament_registrations.findFirst({
    columns: { id: true, status: true },
    where: and(
      eq(tournament_registrations.tournament_id, tournamentId),
      eq(tournament_registrations.player_id, playerId)
    ),
  })

  if (existingRegistration) {
    if (existingRegistration.status !== 'withdrawn') {
      throw alreadyRegistered()
    }
    // Re-register withdrawn player
    try {
      await db
        .update(tournament_registrations)
        .set({ status: 'confirmed', withdrawn_at: null, confirmed_at: new Date() })
        .where(eq(tournament_registrations.id, existingRegistration.id))
    } catch (error) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to re-register player',
        data: error
      })
    }
    return {
      success: true,
      message: 'Player re-registered successfully'
    }
  }

  // The unique (tournament, player) index settles a concurrent double registration: the loser inserts nothing
  const insertRegistration = async (status: 'waitlisted' | 'confirmed', statusMessage: string) => {
    let inserted
    try {
      inserted = await db
        .insert(tournament_registrations)
        .values({
          tournament_id: tournamentId,
          player_id: playerId,
          status,
          ...(status === 'confirmed' ? { confirmed_at: new Date() } : {})
        })
        .onConflictDoNothing()
        .returning({ id: tournament_registrations.id })
    } catch (error) {
      throw createError({ statusCode: 500, statusMessage, data: error })
    }
    if (inserted.length === 0) {
      throw alreadyRegistered()
    }
    return inserted[0].id
  }

  // Check max players limit
  if (tournament.max_players) {
    const [{ n }] = await db
      .select({ n: count() })
      .from(tournament_registrations)
      .where(
        and(
          eq(tournament_registrations.tournament_id, tournamentId),
          eq(tournament_registrations.status, 'confirmed'),
          isNull(tournament_registrations.withdrawn_at)
        )
      )

    if (n >= tournament.max_players) {
      await insertRegistration('waitlisted', 'Failed to add player to waitlist')
      return {
        success: true,
        message: 'Player added to waitlist',
        waitlisted: true
      }
    }
  }

  // Register player
  const registrationId = await insertRegistration('confirmed', 'Failed to register player')
  const registration = await db.query.tournament_registrations.findFirst({
    where: eq(tournament_registrations.id, registrationId),
    with: { player: true },
  })

  return {
    success: true,
    message: 'Player registered successfully',
    registration
  }
}

/**
 * The column changes an admin or organizer tournament update asks for. Only fields present in the body change.
 * category_id is left to the caller, which verifies the category first.
 */
export function tournamentUpdateFromPayload(body: UpdateTournamentPayload): Partial<typeof tournaments.$inferInsert> {
  const { name, start_date, end_date, status, group_size, players_per_group_advance, registration_open, registration_deadline, max_players, min_players, description, rules, location, points_config } = body
  const updateData: Partial<typeof tournaments.$inferInsert> = { updated_at: new Date() }
  if (name !== undefined) updateData.name = name.trim()
  if (start_date !== undefined) updateData.start_date = new Date(start_date)
  if (end_date !== undefined) updateData.end_date = end_date ? new Date(end_date) : null
  if (status !== undefined) updateData.status = status
  if (group_size !== undefined) updateData.group_size = group_size
  if (players_per_group_advance !== undefined) updateData.players_per_group_advance = players_per_group_advance
  if (registration_open !== undefined) updateData.registration_open = registration_open
  if (registration_deadline !== undefined) updateData.registration_deadline = registration_deadline ? new Date(registration_deadline) : null
  if (max_players !== undefined) updateData.max_players = max_players || null
  if (min_players !== undefined) updateData.min_players = min_players
  if (description !== undefined) updateData.description = description?.trim() || null
  if (rules !== undefined) updateData.rules = rules?.trim() || null
  if (location !== undefined) updateData.location = location?.trim() || null
  if (points_config !== undefined) updateData.points_config = normalizePointsConfig(points_config)
  return updateData
}

/**
 * Create a tournament from an admin or organizer request body. Dates in datetime-local form are Ecuador time.
 * Verifies the category and refuses unparseable dates with 400. Returns the new tournament's id.
 * @param body - The request body (name and start_date already checked by the caller)
 * @param createdBy - The creating player's id
 * @param organizerId - The organizer's player id, or null for admin-created tournaments
 * @param tx - Optional transaction to run in
 */
export async function createTournamentFromPayload(
  body: CreateTournamentPayload,
  createdBy: string,
  organizerId: string | null,
  tx?: DbOrTx
): Promise<string> {
  const { name, category_id, start_date, end_date, group_size, players_per_group_advance, registration_open, registration_deadline, max_players, min_players, description, rules, location, points_config } = body
  const db = tx ?? useDb()

  // Verify category exists if provided
  if (category_id) {
    const category = await db.query.categories.findFirst({
      columns: { id: true },
      where: eq(categories.id, category_id),
    })

    if (!category) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Category not found'
      })
    }
  }

  // Convert datetime-local to ISO (treating input as Ecuador time)
  let startDate: Date
  let endDate: Date | null = null
  let registrationDeadline: Date | null = null
  try {
    const toDate = (value: string) => {
      const date = new Date(datetimeLocalToISO(value))
      if (Number.isNaN(date.getTime())) throw new Error(`cannot parse "${value}"`)
      return date
    }
    startDate = toDate(start_date)
    if (end_date) endDate = toDate(end_date)
    if (registration_deadline) registrationDeadline = toDate(registration_deadline)
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid date format: ${error instanceof Error ? error.message : String(error)}`
    })
  }

  try {
    const [tournament] = await db
      .insert(tournaments)
      .values({
        name: name.trim(),
        category_id: category_id || null, // Allow null for open tournaments
        start_date: startDate,
        end_date: endDate,
        tournament_type: body.tournament_type || 'groups_playoffs',
        current_phase: 'registration',
        group_size: group_size || 4,
        players_per_group_advance: players_per_group_advance || 2,
        registration_open: registration_open !== false,
        registration_deadline: registrationDeadline,
        max_players: max_players || null,
        min_players: min_players || 4,
        created_by: createdBy,
        organizer_id: organizerId,
        description: description?.trim() || null,
        rules: rules?.trim() || null,
        location: location?.trim() || null,
        points_config: normalizePointsConfig(points_config),
        status: 'upcoming'
      })
      .returning({ id: tournaments.id })
    return tournament.id
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create tournament',
      data: error
    })
  }
}
