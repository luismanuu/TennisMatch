import { expect } from 'vitest'
import type { TestApp } from '../security/harness'

export type Account = { cookie: string; userId: string; playerId: string; email: string }

let seq = 0

// A future Ecuador datetime-local string, as the match form sends it
export const FUTURE = '2099-06-15T18:30'

export async function createCategory(app: TestApp, defaultElo = 1500): Promise<string> {
  const { rows } = await app.client.query<{ id: string }>(
    `insert into categories (name, "order", default_elo) values ($1, $2, $3) returning id`,
    [`Categoría ${++seq}`, seq, defaultElo],
  )
  return rows[0].id
}

// players/me.post.ts belongs to another batch and is not ported in this worktree, so players are seeded in SQL
// the way that route creates them: rating = the category's default ELO, no matches yet.
export async function createPlayer(app: TestApp, categoryId: string, label = 'jugador'): Promise<Account> {
  const email = `${label}-${++seq}@tenis.ec`
  const { cookie, userId } = await app.signUp(email)
  const { rows } = await app.client.query<{ id: string }>(
    `insert into players (user_id, name, category_id, elo, mmr)
     select $1, $2, c.id, c.default_elo, (c.default_elo - 2250)::numeric / 750 from categories c where c.id = $3
     returning id`,
    [userId, `${label} ${seq}`, categoryId],
  )
  return { cookie, userId, playerId: rows[0].id, email }
}

export type PlayerRow = {
  id: string
  elo: number
  mmr: string
  total_matches_played: number
  win_streak: number
  loss_streak: number
  placement_matches_completed: number
}

export async function playerRow(app: TestApp, playerId: string): Promise<PlayerRow> {
  const { rows } = await app.client.query<PlayerRow>(
    `select id, elo, mmr, total_matches_played, win_streak, loss_streak, placement_matches_completed from players where id = $1`,
    [playerId],
  )
  return rows[0]
}

export async function put(app: TestApp, who: Account, matchId: string, action: string, data?: unknown) {
  return app.request('PUT', `/api/matches/${matchId}`, { cookie: who.cookie, body: { action, data } })
}

// A proposes a match against B, B accepts, and the match is activated. Returns the match id.
export async function activeMatch(app: TestApp, a: Account, b: Account, isCompetitive = true): Promise<string> {
  const created = await app.request('POST', '/api/matches', {
    cookie: a.cookie,
    body: { player1_id: a.playerId, player2_id: b.playerId, scheduled_at: FUTURE, is_competitive: isCompetitive },
  })
  expect(created.status, JSON.stringify(created.body)).toBe(200)
  const matchId = (created.body as { id: string }).id
  expect((await put(app, b, matchId, 'accept_match')).status).toBe(200)
  expect((await put(app, a, matchId, 'update_status', { status: 'active' })).status).toBe(200)
  return matchId
}

// Approve the proposal as it is now, sending what the approver's page would have shown (score, winner, proposal time)
export async function approve(app: TestApp, who: Account, matchId: string) {
  const { rows } = await app.client.query<{ score: string | null; winner_id: string | null; score_proposed_at: Date | null }>(
    `select score, winner_id, score_proposed_at from matches where id = $1`,
    [matchId],
  )
  const m = rows[0]
  return put(app, who, matchId, 'approve_score', {
    score: m?.score,
    winner_id: m?.winner_id,
    score_proposed_at: m?.score_proposed_at ? new Date(m.score_proposed_at).toISOString() : undefined,
  })
}

let walkoverAdmin: Account | null = null

// A walkover is recorded by an organizer or admin, never proposed by a player: the player's attempt is a 400, then an
// admin records it. Returns the admin's response.
export async function recordWalkover(app: TestApp, proposer: Account, matchId: string, winnerId: string) {
  expect((await put(app, proposer, matchId, 'propose_score', { score: 'W/O', winner_id: winnerId })).status).toBe(400)
  if (!walkoverAdmin) {
    const { rows } = await app.client.query<{ category_id: string }>(`select category_id from players where id = $1`, [proposer.playerId])
    walkoverAdmin = await createPlayer(app, rows[0].category_id, 'arbitro')
    await app.setRole(walkoverAdmin.userId, 'admin')
  }
  return put(app, walkoverAdmin, matchId, 'organizer_set_result', { winner_id: winnerId, is_wo: true })
}
