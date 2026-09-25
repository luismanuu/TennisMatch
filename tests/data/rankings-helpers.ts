import { randomUUID } from 'node:crypto'
import { asc, inArray } from 'drizzle-orm'
import { cities, players, user } from '../../server/db/schema'
import type { TestApp } from '../security/harness'

export type PlayerSpec = {
  name?: string
  elo?: number
  total_matches_played?: number
  win_streak?: number
  loss_streak?: number
  placement_matches_completed?: number
  previous_rank?: number | null
  status?: 'active' | 'deleted'
  deleted_at?: Date | null
  city_id?: string | null
  category_id?: string | null
}

let seq = 0

/** Inserts a Better Auth user plus a player row directly with drizzle, bypassing the API. Returns the player id. */
export async function seedPlayer(app: TestApp, spec: PlayerSpec = {}): Promise<string> {
  const n = ++seq
  const userId = randomUUID()
  const playerId = randomUUID()
  const name = spec.name ?? `Jugador de prueba ${n}`

  await app.db.insert(user).values({
    id: userId,
    name,
    email: `rankings-test-${n}-${userId}@tenis.ec`,
    emailVerified: true,
    role: 'player',
  })

  await app.db.insert(players).values({
    id: playerId,
    user_id: userId,
    name,
    elo: spec.elo ?? 1000,
    status: spec.status ?? 'active',
    deleted_at: spec.deleted_at ?? null,
    total_matches_played: spec.total_matches_played ?? 0,
    win_streak: spec.win_streak ?? 0,
    loss_streak: spec.loss_streak ?? 0,
    placement_matches_completed: spec.placement_matches_completed ?? 0,
    previous_rank: spec.previous_rank ?? null,
    city_id: spec.city_id ?? null,
    category_id: spec.category_id ?? null,
  })

  return playerId
}

/** Inserts a player row for an ALREADY-EXISTING user (e.g. one created via app.signUp). Returns the player id. */
export async function seedPlayerForUser(app: TestApp, userId: string, spec: PlayerSpec = {}): Promise<string> {
  const n = ++seq
  const playerId = randomUUID()
  const name = spec.name ?? `Jugador de prueba ${n}`

  await app.db.insert(players).values({
    id: playerId,
    user_id: userId,
    name,
    elo: spec.elo ?? 1000,
    status: spec.status ?? 'active',
    deleted_at: spec.deleted_at ?? null,
    total_matches_played: spec.total_matches_played ?? 0,
    win_streak: spec.win_streak ?? 0,
    loss_streak: spec.loss_streak ?? 0,
    placement_matches_completed: spec.placement_matches_completed ?? 0,
    previous_rank: spec.previous_rank ?? null,
    city_id: spec.city_id ?? null,
    category_id: spec.category_id ?? null,
  })

  return playerId
}

export async function seedPlayers(app: TestApp, specs: PlayerSpec[]): Promise<string[]> {
  const ids: string[] = []
  for (const spec of specs) ids.push(await seedPlayer(app, spec))
  return ids
}

/** Deletes the given players and their backing users. Safe to call as long as no match/pending_player references them. */
export async function deletePlayers(app: TestApp, playerIds: string[]): Promise<void> {
  if (playerIds.length === 0) return
  const rows = await app.db.select({ user_id: players.user_id }).from(players).where(inArray(players.id, playerIds))
  await app.db.delete(players).where(inArray(players.id, playerIds))
  const userIds = rows.map((r) => r.user_id)
  if (userIds.length > 0) {
    await app.db.delete(user).where(inArray(user.id, userIds))
  }
}

/** Any one of the seeded cities (they all sit in the same matchmaking segment). */
export async function anyCityId(app: TestApp): Promise<string> {
  const [row] = await app.db.select({ id: cities.id }).from(cities).orderBy(asc(cities.id)).limit(1)
  if (!row) throw new Error('No seeded city found - did migrations run?')
  return row.id
}

export async function allCityIds(app: TestApp): Promise<string[]> {
  const rows = await app.db.select({ id: cities.id }).from(cities)
  return rows.map((r) => r.id)
}
