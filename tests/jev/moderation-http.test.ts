// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { createPlayer, type Account } from '../data/matches-helpers'
import { resetJevBreakerForTests } from '../../server/utils/jev'
import { MODERATION_QUESTIONS, NAME_REJECTED_MESSAGE, NAME_TOO_LONG_MESSAGE } from '../../server/utils/moderation'
import { gatewayFailure, SEED, type GatewayBehaviour } from './helpers'
import { setupJevTestApp } from './http-harness'

const t = setupJevTestApp()

const moderationBody = (p: Partial<Record<keyof typeof MODERATION_QUESTIONS, number>>) => ({
  kind: 'body' as const,
  body: {
    answers: Object.fromEntries(
      Object.keys(MODERATION_QUESTIONS).map((k) => [k, { type: 'boolean', probability: p[k as keyof typeof p] ?? 0.01 }]),
    ),
  },
})

describe('display-name moderation', () => {
  it('a flagged name blocks onboarding with the tuteo message and creates no player', async () => {
    const account = await t.app.signUp('name-flagged@tenis.ec')
    t.useGateway(moderationBody({ harassment: 0.97 }))
    const res = await t.app.request('POST', '/api/players/me', {
      cookie: account.cookie,
      body: { name: 'nombre ofensivo', city_id: t.cityId, category_id: t.categoryId },
    })
    expect(res.status).toBe(422)
    expect(JSON.stringify(res.body)).toContain(NAME_REJECTED_MESSAGE)
    expect(await t.countRows('players', 'user_id = $1', [account.userId])).toBe(0)
  })

  it('gateway failure or the flag off never blocks a name (property)', async () => {
    let n = 0
    await fc.assert(
      fc.asyncProperty(fc.oneof(gatewayFailure, fc.constant<GatewayBehaviour>(moderationBody({ harassment: 1, spam: 1 }))), async (behaviour) => {
        resetJevBreakerForTests()
        const account = await t.app.signUp(`name-open-${++n}@tenis.ec`)
        if (behaviour.kind === 'body') process.env.JEV_MODERATION_ENABLED = 'false'
        else process.env.JEV_MODERATION_ENABLED = 'true'
        t.useGateway(behaviour)
        const res = await t.app.request('POST', '/api/players/me', {
          cookie: account.cookie,
          body: { name: 'Ana Normal', city_id: t.cityId, category_id: t.categoryId },
        })
        t.releaseGateway()
        expect(res.status).toBe(200)
      }),
      { seed: SEED, numRuns: 12 },
    )
  })

  it('with moderation on, a name longer than the model reads is refused without a call; flag off it saves as before', async () => {
    const long = 'Ana '.repeat(40)
    const gw = t.useGateway(moderationBody({}))
    const blocked = await t.app.signUp('name-long@tenis.ec')
    const res = await t.app.request('POST', '/api/players/me', { cookie: blocked.cookie, body: { name: long, city_id: t.cityId, category_id: t.categoryId } })
    expect(res.status).toBe(422)
    expect(JSON.stringify(res.body)).toContain(NAME_TOO_LONG_MESSAGE)
    expect(gw.calls).toHaveLength(0)
    process.env.JEV_MODERATION_ENABLED = 'false'
    const open = await t.app.signUp('name-long-off@tenis.ec')
    const ok = await t.app.request('POST', '/api/players/me', { cookie: open.cookie, body: { name: long, city_id: t.cityId, category_id: t.categoryId } })
    expect(ok.status).toBe(200)
  })

  // Named regression: only a changed name is judged, so an existing name never blocks an unrelated edit.
  it('editing other fields keeps working for a player whose existing name Jev would flag', async () => {
    const player = await createPlayer(t.app, t.categoryId, 'nombre-viejo')
    const gw = t.useGateway(moderationBody({ harassment: 1, spam: 1, contact_solicitation: 1, prompt_injection: 1 }))
    const res = await t.app.request('PUT', `/api/players/${player.playerId}`, { cookie: player.cookie, body: { city_id: t.cityId } })
    expect(res.status).toBe(200)
    const current = (await t.app.client.query<{ name: string }>(`select name from players where id = $1`, [player.playerId])).rows[0].name
    const same = await t.app.request('PUT', `/api/players/${player.playerId}`, { cookie: player.cookie, body: { name: current, city_id: t.cityId } })
    expect(same.status).toBe(200)
    expect(gw.calls).toHaveLength(0)
  })

  it('renaming to a flagged name is refused and the old name stays', async () => {
    const player = await createPlayer(t.app, t.categoryId, 'renombre')
    const before = (await t.app.client.query<{ name: string }>(`select name from players where id = $1`, [player.playerId])).rows[0].name
    t.useGateway(moderationBody({ spam: 0.95 }))
    const res = await t.app.request('PUT', `/api/players/${player.playerId}`, { cookie: player.cookie, body: { name: 'COMPRA YA www.spam.ec' } })
    expect(res.status).toBe(422)
    expect(JSON.stringify(res.body)).toContain(NAME_REJECTED_MESSAGE)
    const after = (await t.app.client.query<{ name: string }>(`select name from players where id = $1`, [player.playerId])).rows[0].name
    expect(after).toBe(before)
  })
})

async function createMatch(a: Account, b: Account): Promise<string> {
  const { rows } = await t.app.client.query<{ id: string }>(
    `insert into matches (player1_id, player2_id, status) values ($1, $2, 'scheduled') returning id`,
    [a.playerId, b.playerId],
  )
  return rows[0].id
}

describe('chat moderation', () => {
  let sender: Account
  let opponent: Account
  let admin: { cookie: string }
  let matchId: string

  beforeAll(async () => {
    sender = await createPlayer(t.app, t.categoryId, 'emisor')
    opponent = await createPlayer(t.app, t.categoryId, 'rival')
    const adminAccount = await createPlayer(t.app, t.categoryId, 'admin')
    await t.app.setRole(adminAccount.userId, 'admin')
    admin = adminAccount
    matchId = await createMatch(sender, opponent)
  })

  const send = (message: string) => t.app.request('POST', `/api/matches/${matchId}/messages`, { cookie: sender.cookie, body: { message } })
  const listFor = async (who: { cookie: string }) =>
    (await t.app.request('GET', `/api/matches/${matchId}/messages`, { cookie: who.cookie })).body as Array<{ id: string; moderation_status: string }>

  it('a flagged message is held: the sender sees it with its status, the opponent does not, until an admin approves it', async () => {
    t.useGateway(moderationBody({ harassment: 0.96 }))
    const res = await send('mensaje ofensivo')
    expect(res.status).toBe(200)
    const held = res.body as { id: string; moderation_status: string }
    expect(held.moderation_status).toBe('held')
    expect(JSON.stringify(res.body)).not.toContain('moderation_scores')

    expect((await listFor(sender)).map((m) => m.id)).toContain(held.id)
    expect((await listFor(opponent)).map((m) => m.id)).not.toContain(held.id)
    const detailFor = async (who: { cookie: string }) =>
      ((await t.app.request('GET', `/api/matches/${matchId}`, { cookie: who.cookie })).body as { messages: Array<{ id: string }> }).messages
    // Named regression: the match detail route embedded every message and leaked held ones to the opponent.
    expect((await detailFor(opponent)).map((m) => m.id)).not.toContain(held.id)
    expect((await detailFor(sender)).map((m) => m.id)).toContain(held.id)
    expect(JSON.stringify(await detailFor(sender))).not.toContain('moderation_scores')

    const queue = (await t.app.request('GET', '/api/admin/moderation/messages', { cookie: admin.cookie })).body as Array<{ id: string }>
    expect(queue.map((m) => m.id)).toContain(held.id)

    const approve = await t.app.request('POST', `/api/admin/moderation/messages/${held.id}`, { cookie: admin.cookie, body: { action: 'approve' } })
    expect(approve.status).toBe(200)
    expect((await listFor(opponent)).map((m) => m.id)).toContain(held.id)
  })

  it('an admin rejection hides the message from both players but keeps the row', async () => {
    t.useGateway(moderationBody({ spam: 0.99 }))
    const held = (await send('publicidad')).body as { id: string }
    await t.app.request('POST', `/api/admin/moderation/messages/${held.id}`, { cookie: admin.cookie, body: { action: 'reject' } })
    expect((await listFor(sender)).map((m) => m.id)).not.toContain(held.id)
    expect((await listFor(opponent)).map((m) => m.id)).not.toContain(held.id)
    expect(await t.countRows('match_messages', 'id = $1', [held.id])).toBe(1)
  })

  it('gateway failure, or the flag off, publishes the message exactly as today (property)', async () => {
    await fc.assert(
      fc.asyncProperty(fc.oneof(gatewayFailure, fc.constant<GatewayBehaviour>(moderationBody({ harassment: 1, spam: 1, prompt_injection: 1 }))), async (behaviour) => {
        resetJevBreakerForTests()
        process.env.JEV_MODERATION_ENABLED = behaviour.kind === 'body' ? 'false' : 'true'
        t.useGateway(behaviour)
        const res = await send('nos vemos el sábado')
        t.releaseGateway()
        expect(res.status).toBe(200)
        const msg = res.body as { id: string; moderation_status: string }
        expect(msg.moderation_status).toBe('visible')
        expect((await listFor(opponent)).map((m) => m.id)).toContain(msg.id)
      }),
      { seed: SEED, numRuns: 12 },
    )
  })
})
