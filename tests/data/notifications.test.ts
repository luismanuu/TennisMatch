// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestApp, type TestApp } from '../security/harness'

let app: TestApp
let a: { cookie: string; userId: string }
let b: { cookie: string; userId: string }
let aPlayerId: string
let bPlayerId: string
let categoryId: string
let cityId: string

async function createPlayer(account: { cookie: string }, name: string): Promise<string> {
  const res = await app.request('POST', '/api/players/me', {
    cookie: account.cookie,
    body: { name, city_id: cityId, category_id: categoryId },
  })
  return (res.body as { id: string }).id
}

// One notification belonging to B, attached to a real match between A and B (the FK on
// notifications.match_id requires a real row; matches are another batch's table but a bare
// insert that satisfies the participants check constraint is enough to hang a notification off).
async function createNotificationFor(playerId: string, matchId: string): Promise<string> {
  const res = await app.client.query<{ id: string }>(
    `insert into notifications (player_id, type, match_id) values ($1, 'match_created', $2) returning id`,
    [playerId, matchId],
  )
  return res.rows[0].id
}

beforeAll(async () => {
  app = await startTestApp()
  const categoriesRes = await app.request('GET', '/api/categories')
  const citiesRes = await app.request('GET', '/api/cities')
  categoryId = (categoriesRes.body as Array<{ id: string }>)[0].id
  cityId = (citiesRes.body as Array<{ id: string }>)[0].id

  a = await app.signUp('notif-a@tenis.ec')
  b = await app.signUp('notif-b@tenis.ec')
  aPlayerId = await createPlayer(a, 'Notif A')
  bPlayerId = await createPlayer(b, 'Notif B')
}, 60_000)

afterAll(async () => {
  await app?.close()
})

async function newMatchId(): Promise<string> {
  const res = await app.client.query<{ id: string }>(
    `insert into matches (player1_id, player2_id) values ($1, $2) returning id`,
    [aPlayerId, bPlayerId],
  )
  return res.rows[0].id
}

describe('IDOR: notification routes act only on the session player\'s own notifications', () => {
  it('POST /api/notifications/[id]/dismiss with A\'s session on B\'s notification -> 404/403, B unchanged', async () => {
    const matchId = await newMatchId()
    const notificationId = await createNotificationFor(bPlayerId, matchId)

    const res = await app.request('POST', `/api/notifications/${notificationId}/dismiss`, { cookie: a.cookie })
    expect([403, 404]).toContain(res.status)

    const row = (
      await app.client.query<{ is_dismissed: boolean }>(`select is_dismissed from notifications where id = $1`, [
        notificationId,
      ])
    ).rows[0]
    expect(row.is_dismissed).toBe(false)
  })

  it('POST /api/notifications/[id]/read with A\'s session on B\'s notification -> 404/403, B unchanged', async () => {
    const matchId = await newMatchId()
    const notificationId = await createNotificationFor(bPlayerId, matchId)

    const res = await app.request('POST', `/api/notifications/${notificationId}/read`, { cookie: a.cookie })
    expect([403, 404]).toContain(res.status)

    const row = (
      await app.client.query<{ is_read: boolean }>(`select is_read from notifications where id = $1`, [notificationId])
    ).rows[0]
    expect(row.is_read).toBe(false)
  })

  it('sanity: B can dismiss and read their own notification', async () => {
    const matchId = await newMatchId()
    const notificationId = await createNotificationFor(bPlayerId, matchId)

    const read = await app.request('POST', `/api/notifications/${notificationId}/read`, { cookie: b.cookie })
    expect(read.status).toBe(200)

    const dismiss = await app.request('POST', `/api/notifications/${notificationId}/dismiss`, { cookie: b.cookie })
    expect(dismiss.status).toBe(200)

    const row = (
      await app.client.query<{ is_read: boolean; is_dismissed: boolean }>(
        `select is_read, is_dismissed from notifications where id = $1`,
        [notificationId],
      )
    ).rows[0]
    expect(row.is_read).toBe(true)
    expect(row.is_dismissed).toBe(true)
  })
})
