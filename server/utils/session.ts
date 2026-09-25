import type { H3Event } from 'h3'
import { createError } from 'h3'
import { eq } from 'drizzle-orm'
import { useDb } from '../db'
import { players, type UserRole } from '../db/schema'
import { serverAuth } from './auth'
import { authorize, type Requirement } from './authz'

export type SessionUser = {
  id: string
  email: string
  name: string
  emailVerified: boolean
  role: UserRole
}

// The only source of identity on the server. Request bodies, query strings and headers are never read for it.
export async function getSessionUser(event: H3Event): Promise<SessionUser | null> {
  const result = await serverAuth().api.getSession({ headers: event.headers })
  if (!result) {
    return null
  }
  const u = result.user as typeof result.user & { role?: UserRole }
  return { id: u.id, email: u.email, name: u.name, emailVerified: u.emailVerified, role: u.role ?? 'player' }
}

async function requireRole(event: H3Event, requirement: Requirement): Promise<SessionUser> {
  const user = await getSessionUser(event)
  const outcome = authorize(user?.role ?? null, requirement)
  if (!outcome.ok) {
    throw createError({ statusCode: outcome.statusCode, statusMessage: outcome.statusMessage })
  }
  return user as SessionUser
}

export const requireUser = (event: H3Event) => requireRole(event, 'user')
export const requireAdmin = (event: H3Event) => requireRole(event, 'admin')
export const requireOrganizer = (event: H3Event) => requireRole(event, 'organizer')
export const requireAdminOrOrganizer = (event: H3Event) => requireRole(event, 'admin_or_organizer')

export async function findPlayerByUserId(userId: string) {
  return useDb().query.players.findFirst({ where: eq(players.user_id, userId) })
}

export type SessionPlayer = NonNullable<Awaited<ReturnType<typeof findPlayerByUserId>>>

// For routes that act as the signed-in player. 404 when the account has no player profile yet.
export async function requirePlayer(
  event: H3Event,
  requirement: Requirement = 'user',
): Promise<{ user: SessionUser; player: SessionPlayer }> {
  const user = await requireRole(event, requirement)
  const player = await findPlayerByUserId(user.id)
  if (!player) {
    throw createError({ statusCode: 404, statusMessage: 'Player profile not found' })
  }
  return { user, player }
}
