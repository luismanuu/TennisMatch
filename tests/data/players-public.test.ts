// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestApp, type TestApp } from '../security/harness'
import { approve, activeMatch, createCategory, createPlayer, put, type Account } from './matches-helpers'

// Public player routes: what they return, and what they must not.

let app: TestApp
let categoryId: string

beforeAll(async () => {
  app = await startTestApp()
  categoryId = await createCategory(app, 1500)
}, 120_000)

afterAll(async () => {
  await app?.close()
})

async function play(p1: Account, p2: Account, winner: Account, score: string): Promise<string> {
  const matchId = await activeMatch(app, p1, p2)
  expect((await put(app, p1, matchId, 'propose_score', { score, winner_id: winner.playerId })).status).toBe(200)
  expect((await approve(app, p2, matchId)).status).toBe(200)
  return matchId
}

describe('players/[id]/head-to-head/[opponentId]', () => {
  // The port dropped id, score and winner_id from the embedded match; my-ranking shows best_match.match.score.
  it('best_match and worst_match carry the match id, score and winner_id', async () => {
    const rosa = await createPlayer(app, categoryId, 'rosa')
    const saul = await createPlayer(app, categoryId, 'saul')
    const won = await play(rosa, saul, rosa, '6-3 6-4')
    const lost = await play(rosa, saul, saul, '4-6 2-6')

    const res = await app.request('GET', `/api/players/${rosa.playerId}/head-to-head/${saul.playerId}`)
    expect(res.status).toBe(200)
    const stats = (res.body as {
      stats: {
        best_match: { match: { id: string; score: string; winner_id: string } }
        worst_match: { match: { id: string; score: string; winner_id: string } }
      }
    }).stats
    expect(stats.best_match.match).toMatchObject({ id: won, score: '6-3 6-4', winner_id: rosa.playerId })
    expect(stats.worst_match.match).toMatchObject({ id: lost, score: '4-6 2-6', winner_id: saul.playerId })
  })
})

describe('players/[id]/matches', () => {
  // A public route embedded the invited (not yet registered) opponent's email: personal data for anyone.
  it('does not expose the email of a pending opponent', async () => {
    const tere = await createPlayer(app, categoryId, 'tere')
    const email = 'invitada.privada@correo.ec'
    const { rows } = await app.client.query<{ id: string }>(
      `insert into pending_players (name, email, category_id, invited_by_player_id) values ('Invitada', $1, $2, $3) returning id`,
      [email, categoryId, tere.playerId],
    )
    await app.client.query(`insert into matches (player1_id, pending_player2_id, status) values ($1, $2, 'scheduled')`, [
      tere.playerId,
      rows[0].id,
    ])

    const res = await app.request('GET', `/api/players/${tere.playerId}/matches`)
    expect(res.status).toBe(200)
    const matches = (res.body as { matches: Array<{ pending_player2: Record<string, unknown> | null }> }).matches
    expect(matches).toHaveLength(1)
    expect(matches[0].pending_player2).toMatchObject({ id: rows[0].id, name: 'Invitada' })
    expect(matches[0].pending_player2).not.toHaveProperty('email')
    expect(JSON.stringify(res.body)).not.toContain(email)
  })
})

describe('players/[id]/ranking-position', () => {
  // The rated filter counted soft-deleted players, unlike leaderboard and rankings.
  it('a soft-deleted player above does not count in the rank or the total', async () => {
    const uma = await createPlayer(app, categoryId, 'uma')
    await app.client.query(`update players set elo = 1700, total_matches_played = 3 where id = $1`, [uma.playerId])
    const before = await app.request('GET', `/api/players/${uma.playerId}/ranking-position`)
    expect(before.status).toBe(200)

    const gone = await createPlayer(app, categoryId, 'baja')
    await app.client.query(
      `update players set elo = 3000, total_matches_played = 9, deleted_at = now() where id = $1`,
      [gone.playerId],
    )
    const after = await app.request('GET', `/api/players/${uma.playerId}/ranking-position`)
    expect(after.status).toBe(200)
    expect(after.body).toEqual(before.body)
    expect((after.body as { position: { global_rank: number } }).position.global_rank).toBe(1)
  })
})
