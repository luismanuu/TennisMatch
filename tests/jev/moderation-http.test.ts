// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { createPlayer, type Account } from '../data/matches-helpers'
import { resetJevBreakerForTests } from '../../server/utils/jev'
import { CHAT_TOO_FAST_MESSAGE, MODERATION_QUESTIONS, NAME_REJECTED_MESSAGE, NAME_TOO_LONG_MESSAGE } from '../../server/utils/moderation'
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

  it('an admin rejection keeps the row: the sender sees it marked rejected, the opponent never sees it', async () => {
    t.useGateway(moderationBody({ spam: 0.99 }))
    const held = (await send('publicidad')).body as { id: string }
    await t.app.request('POST', `/api/admin/moderation/messages/${held.id}`, { cookie: admin.cookie, body: { action: 'reject' } })
    expect((await listFor(sender)).find((m) => m.id === held.id)?.moderation_status).toBe('rejected')
    expect((await listFor(opponent)).map((m) => m.id)).not.toContain(held.id)
    const detail = (await t.app.request('GET', `/api/matches/${matchId}`, { cookie: opponent.cookie })).body as { messages: Array<{ id: string }> }
    expect(detail.messages.map((m) => m.id)).not.toContain(held.id)
    expect(await t.countRows('match_messages', 'id = $1', [held.id])).toBe(1)
  })

  // Named regression (review): publishing past the limit unmoderated let a 21st message skip the check.
  it('with moderation on, the 21st message within a minute is refused with 429 and not published, with no Jev call', async () => {
    await t.app.client.query(`delete from rate_limit_buckets where key like 'jev-chat:%'`)
    const gw = t.useGateway(moderationBody({}))
    for (let i = 0; i < 20; i++) expect((await send(`mensaje ${i}`)).status).toBe(200)
    expect(gw.calls).toHaveLength(20)
    const before = await t.countRows('match_messages', 'match_id = $1', [matchId])
    const extra = await send('mensaje 21 ofensivo')
    expect(extra.status).toBe(429)
    expect(JSON.stringify(extra.body)).toContain(CHAT_TOO_FAST_MESSAGE)
    expect(gw.calls).toHaveLength(20)
    expect(await t.countRows('match_messages', 'match_id = $1', [matchId])).toBe(before)
    await t.app.client.query(`delete from rate_limit_buckets where key like 'jev-chat:%'`)
  })

  it('with moderation off there is no chat limit, as today', async () => {
    await t.app.client.query(`delete from rate_limit_buckets where key like 'jev-chat:%'`)
    process.env.JEV_MODERATION_ENABLED = 'false'
    t.useGateway(moderationBody({}))
    for (let i = 0; i < 25; i++) expect((await send(`sin moderación ${i}`)).status).toBe(200)
  })

  const ALLOWED_KEYS = new Set(['id', 'match_id', 'player_id', 'message', 'created_at', 'moderation_status', 'player'])

  it('whatever mix of held, approved and rejected messages exists, players only get allowlisted fields and only their own non-visible rows (property)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({ from: fc.constantFrom('sender', 'opponent'), flagged: fc.boolean(), review: fc.constantFrom('none', 'approve', 'reject') }), { minLength: 1, maxLength: 6 }),
        async (steps) => {
          await t.app.client.query(`delete from rate_limit_buckets where key like 'jev-chat:%'`)
          const id = await createMatch(sender, opponent)
          const who = { sender, opponent }
          for (const step of steps) {
            t.useGateway(moderationBody(step.flagged ? { harassment: 0.99 } : {}))
            const res = await t.app.request('POST', `/api/matches/${id}/messages`, { cookie: who[step.from].cookie, body: { message: 'texto' } })
            t.releaseGateway()
            for (const key of Object.keys(res.body as object)) expect(ALLOWED_KEYS.has(key), `POST key ${key}`).toBe(true)
            if (step.review !== 'none') {
              await t.app.request('POST', `/api/admin/moderation/messages/${(res.body as { id: string }).id}`, { cookie: admin.cookie, body: { action: step.review } })
            }
          }
          for (const viewer of [sender, opponent]) {
            const lists = [
              (await t.app.request('GET', `/api/matches/${id}/messages`, { cookie: viewer.cookie })).body as Array<Record<string, unknown>>,
              ((await t.app.request('GET', `/api/matches/${id}`, { cookie: viewer.cookie })).body as { messages: Array<Record<string, unknown>> }).messages,
            ]
            for (const list of lists) {
              for (const m of list) {
                for (const key of Object.keys(m)) expect(ALLOWED_KEYS.has(key), `GET key ${key}`).toBe(true)
                if (m.moderation_status !== 'visible') expect(m.player_id).toBe(viewer.playerId)
              }
            }
          }
        },
      ),
      { seed: SEED, numRuns: 10 },
    )
  })

  it('gateway failure, or the flag off, publishes the message exactly as today (property)', async () => {
    await fc.assert(
      fc.asyncProperty(fc.oneof(gatewayFailure, fc.constant<GatewayBehaviour>(moderationBody({ harassment: 1, spam: 1, prompt_injection: 1 }))), async (behaviour) => {
        resetJevBreakerForTests()
        await t.app.client.query(`delete from rate_limit_buckets where key like 'jev-chat:%'`)
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

describe('migration 0004', () => {
  it('is re-runnable: applying the SQL again on a migrated database changes nothing and does not fail', async () => {
    const { readFileSync } = await import('node:fs')
    const sql = readFileSync(new URL('../../server/db/migrations/0004_jev_message_moderation.sql', import.meta.url), 'utf8')
    const columns = async () =>
      (await t.app.client.query<{ c: string }>(`select column_name as c from information_schema.columns where table_name = 'match_messages' order by 1`)).rows
    const constraints = async () =>
      (await t.app.client.query<{ c: string }>(`select conname as c from pg_constraint where conrelid = 'match_messages'::regclass order by 1`)).rows
    const before = [await columns(), await constraints()]
    await t.app.client.exec(sql)
    expect([await columns(), await constraints()]).toEqual(before)
  })
})
