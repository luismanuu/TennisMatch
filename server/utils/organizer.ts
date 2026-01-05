import { getClerkUser } from './clerk'

/**
 * Check if a user has tournament organizer role in Clerk metadata
 * @param clerkId - The Clerk user ID
 * @returns true if user has tournament_organizer role, false otherwise
 */
export async function checkIsOrganizer(clerkId: string): Promise<boolean> {
  try {
    const clerkUser = await getClerkUser(clerkId)
    const role = clerkUser.publicMetadata?.role as string | undefined
    return role === 'tournament_organizer'
  } catch (error) {
    console.error('Error checking organizer status:', error)
    return false
  }
}

/**
 * Require tournament organizer role - throws error if user is not organizer
 * @param clerkId - The Clerk user ID
 * @throws Error with 403 status if user is not organizer
 */
export async function requireOrganizer(clerkId: string): Promise<void> {
  if (!clerkId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized - Clerk ID required'
    })
  }

  const isOrganizer = await checkIsOrganizer(clerkId)
  
  if (!isOrganizer) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden - Tournament organizer access required'
    })
  }
}

/**
 * Check if user is admin or tournament organizer
 * @param clerkId - The Clerk user ID
 * @returns true if user is admin or organizer
 */
export async function checkIsAdminOrOrganizer(clerkId: string): Promise<boolean> {
  try {
    const clerkUser = await getClerkUser(clerkId)
    const role = clerkUser.publicMetadata?.role as string | undefined
    return role === 'admin' || role === 'tournament_organizer'
  } catch (error) {
    console.error('Error checking admin/organizer status:', error)
    return false
  }
}

/**
 * Verify that organizer owns the tournament
 * @param organizerId - The organizer's player ID
 * @param tournamentId - The tournament ID
 * @param supabase - Supabase admin client
 * @throws Error if organizer doesn't own the tournament
 */
export async function verifyOrganizerOwnsTournament(
  organizerId: string,
  tournamentId: string,
  supabase: any
): Promise<void> {
  const { data: tournament, error } = await supabase
    .from('tournaments')
    .select('id, organizer_id, created_by')
    .eq('id', tournamentId)
    .single()

  if (error || !tournament) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Tournament not found'
    })
  }

  // Check if organizer created this tournament
  if (tournament.organizer_id !== organizerId && tournament.created_by !== organizerId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden - You can only manage tournaments you created'
    })
  }
}

