// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestApp, type TestApp } from '../security/harness'
import { createCategory, createPlayer } from './matches-helpers'

// The reprocess-fallback queue lists completed, scored matches whose rating used the fallback calculation.
// Friendly matches are never rated, so a friendly with the fallback flags stayed in the queue forever: oldest
// first with a limit, a few friendlies were all the queue ever returned.

let app: TestApp
let admin: { cookie: string }
let competitiveId: string
const friendlyIds: string[] = []

beforeAll(async () => {
  app = await startTestApp()
  admin = await app.signUp('admin.cola@tenis.ec', 'admin')
  const category = await createCategory(app, 1500)
  const a = await createPlayer(app, category, 'cola')
  const b = await createPlayer(app, category, 'cola')
  const insert = async (competitive: boolean, createdAt: string, failed: boolean) => {
    const { rows } = await app.client.query<{ id: string }>(
      `insert into matches (player1_id, player2_id, winner_id, status, score, is_competitive, played_at, created_at,
                            llm_elo_calculated, llm_calculation_failed)
       values ($1, $2, $1, 'completed', '6-4 6-4', $3, $4, $4, false, $5) returning id`,
      [a.playerId, b.playerId, competitive, createdAt, failed],
    )
    return rows[0].id
  }
  // Two friendlies (one "not attempted", one "LLM failed"), both older than the competitive match
  friendlyIds.push(await insert(false, '2026-01-05T10:00:00Z', false))
  friendlyIds.push(await insert(false, '2026-01-06T10:00:00Z', true))
  competitiveId = await insert(true, '2026-02-01T10:00:00Z', false)
}, 120_000)

afterAll(async () => {
  await app?.close()
})

describe('fallback queue: friendly matches are not in it', () => {
  it('admin/matches/fallback lists the competitive fallback match only', async () => {
    const res = await app.request('GET', '/api/admin/matches/fallback', { cookie: admin.cookie })
    expect(res.status).toBe(200)
    const body = res.body as { data: Array<{ id: string }>; total: number }
    expect(body.data.map((m) => m.id)).toEqual([competitiveId])
    expect(body.total).toBe(1)
  })

  it('reprocess-fallback with limit=1 picks the competitive match, not the older friendlies', async () => {
    const res = await app.request('POST', '/api/admin/matches/reprocess-fallback', {
      cookie: admin.cookie,
      query: { dry_run: 'true', limit: '1' },
    })
    expect(res.status).toBe(200)
    expect((res.body as { matches: Array<{ id: string }> }).matches.map((m) => m.id)).toEqual([competitiveId])
  })

  it('reprocess-fallback with match_id of a friendly finds nothing to reprocess', async () => {
    const res = await app.request('POST', '/api/admin/matches/reprocess-fallback', {
      cookie: admin.cookie,
      query: { match_id: friendlyIds[1] },
    })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ processed: 0, message: 'No matches found that used fallback calculation' })
  })
})
