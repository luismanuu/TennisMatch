import { getSupabaseAdmin } from './supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Check if registration is allowed based on tournament status
 * @param tournamentId - The tournament ID
 * @param supabase - Supabase admin client
 * @returns true if registration is allowed, false otherwise
 */
export async function checkRegistrationAllowed(
  tournamentId: string,
  supabase: SupabaseClient
): Promise<{ allowed: boolean; reason?: string }> {
  const { data: tournament, error } = await supabase
    .from('tournaments')
    .select('status, registration_open, registration_deadline')
    .eq('id', tournamentId)
    .single()

  if (error || !tournament) {
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
 * @param supabase - Supabase admin client
 * @returns true if self-registration is allowed
 */
export async function checkSelfRegistrationAllowed(
  tournamentId: string,
  supabase: SupabaseClient
): Promise<boolean> {
  const { data: tournament, error } = await supabase
    .from('tournaments')
    .select('status')
    .eq('id', tournamentId)
    .single()

  if (error || !tournament) {
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
 * @param supabase - Supabase admin client
 */
export async function updateTournamentStatus(
  tournamentId: string,
  status: 'upcoming' | 'active' | 'completed',
  autoTransition: boolean,
  supabase: SupabaseClient
): Promise<void> {
  const updateData: Record<string, unknown> = { status }

  // If automatic transition to active, check start_date
  if (autoTransition && status === 'active') {
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('start_date')
      .eq('id', tournamentId)
      .single()

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

  const { error } = await supabase
    .from('tournaments')
    .update(updateData)
    .eq('id', tournamentId)

  if (error) {
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
 * @param supabase - Supabase admin client
 * @returns Current tournament status (may be updated if auto-transition needed)
 */
export async function getTournamentStatus(
  tournamentId: string,
  supabase: SupabaseClient
): Promise<'upcoming' | 'active' | 'completed'> {
  const { data: tournament, error } = await supabase
    .from('tournaments')
    .select('status, start_date, end_date')
    .eq('id', tournamentId)
    .single()

  if (error || !tournament) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Tournament not found'
    })
  }

  const now = new Date()
  const status = tournament.status
  const isTournamentStatus = (s: unknown): s is 'upcoming' | 'active' | 'completed' =>
    s === 'upcoming' || s === 'active' || s === 'completed'
  let currentStatus: 'upcoming' | 'active' | 'completed' = isTournamentStatus(status) ? status : 'upcoming'

  // Auto-transition to active if start_date has passed
  if (currentStatus === 'upcoming' && tournament.start_date) {
    const startDate = new Date(tournament.start_date)
    if (now >= startDate) {
      await updateTournamentStatus(tournamentId, 'active', true, supabase)
      currentStatus = 'active'
    }
  }

  // Auto-transition to completed if end_date has passed
  if (currentStatus === 'active' && tournament.end_date) {
    const endDate = new Date(tournament.end_date)
    if (now >= endDate) {
      await updateTournamentStatus(tournamentId, 'completed', true, supabase)
      currentStatus = 'completed'
    }
  }

  return currentStatus
}

