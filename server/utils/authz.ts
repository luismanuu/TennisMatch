import type { UserRole } from '../db/schema'

export type Requirement = 'user' | 'admin' | 'organizer' | 'admin_or_organizer'

export type AuthzOutcome = { ok: true } | { ok: false; statusCode: 401 | 403; statusMessage: string }

const ALLOWED: Record<Requirement, readonly UserRole[]> = {
  user: ['player', 'admin', 'tournament_organizer'],
  admin: ['admin'],
  organizer: ['tournament_organizer'],
  admin_or_organizer: ['admin', 'tournament_organizer'],
}

// `role` is null when there is no session. Anything that is not a known role is refused.
export function authorize(role: string | null | undefined, requirement: Requirement): AuthzOutcome {
  if (role === null || role === undefined) {
    return { ok: false, statusCode: 401, statusMessage: 'Unauthorized - sign in required' }
  }
  if (!(ALLOWED[requirement] as readonly string[]).includes(role)) {
    return { ok: false, statusCode: 403, statusMessage: 'Forbidden - insufficient role' }
  }
  return { ok: true }
}
