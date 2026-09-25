// @vitest-environment node
import { request as httpRequest } from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { vi } from 'vitest'
import { nextClientIp, startTestApp, type TestApp } from './harness'
import { activeMatch, createCategory, createPlayer, type Account } from '../data/matches-helpers'
import { INVITES_PER_INVITER, INVITES_PER_TARGET_EMAIL } from '../../server/utils/invitations'
import { AUTH_RATE_LIMIT } from '../../server/utils/auth'
import { ADMIN_INVITES_PER_TARGET_EMAIL } from '../../server/utils/invitations'

let app: TestApp
let categoryId: string
let seq = 0

beforeAll(async () => {
  app = await startTestApp()
  categoryId = await createCategory(app, 1500)
}, 120_000)

afterAll(async () => {
  await app?.close()
})

const freshEmail = (label = 'invitado') => `${label}-${++seq}-${Date.now()}@tenis.ec`

function invite(who: Account, email: string, headers: Record<string, string> = {}) {
  return app.request('POST', '/api/pending-players', {
    cookie: who.cookie,
    body: { name: 'Invitado', email, category_id: categoryId },
    headers,
  })
}

// fetch() will not send a custom Host header, so the forged request goes through node:http.
function rawPost(path: string, body: unknown, headers: Record<string, string>) {
  const url = new URL(path, app.baseURL)
  const payload = JSON.stringify(body)
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    const req = httpRequest(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload), ...headers },
      },
      (res) => {
        let text = ''
        res.on('data', (c) => (text += c))
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(text) }))
      },
    )
    req.on('error', reject)
    req.end(payload)
  })
}

describe('outbound links never follow the request Host', () => {
  it('a forged Host / X-Forwarded-Host cannot change the invitation link', async () => {
    const inviter = await createPlayer(app, categoryId, 'anfitrion')
    const res = await rawPost(
      '/api/pending-players',
      { name: 'Invitado', email: freshEmail('forjado'), category_id: categoryId },
      {
        cookie: inviter.cookie,
        origin: app.baseURL,
        host: 'evil.example',
        'x-forwarded-host': 'evil.example',
        'x-forwarded-proto': 'https',
      },
    )
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const link = new URL(res.body.invitation_url)
    expect(link.origin).toBe(new URL(app.baseURL).origin)
    expect(res.body.invitation_url).not.toContain('evil.example')
  })
})

describe('invitation rate limits (stored in rate_limit_buckets)', () => {
  it(`an inviter gets 429 after ${INVITES_PER_INVITER.max} invitations in the window`, async () => {
    const inviter = await createPlayer(app, categoryId, 'spammer')
    for (let i = 0; i < INVITES_PER_INVITER.max; i++) {
      const ok = await invite(inviter, freshEmail())
      expect(ok.status, JSON.stringify(ok.body)).toBe(200)
    }
    const denied = await invite(inviter, freshEmail())
    expect(denied.status).toBe(429)
    const { rows } = await app.client.query<{ count: number }>(`select count from rate_limit_buckets where key = $1`, [
      `invite:inviter:${inviter.playerId}`,
    ])
    expect(rows[0].count).toBe(INVITES_PER_INVITER.max + 1)

    // Another inviter is unaffected
    const other = await createPlayer(app, categoryId, 'vecino')
    expect((await invite(other, freshEmail())).status).toBe(200)
  })

  it(`one target email gets 429 after ${INVITES_PER_TARGET_EMAIL.max} attempts, across different inviters and letter case`, async () => {
    const target = freshEmail('objetivo')
    const statuses: number[] = []
    for (let i = 0; i <= INVITES_PER_TARGET_EMAIL.max; i++) {
      const inviter = await createPlayer(app, categoryId, `inv${i}`)
      const email = i % 2 === 0 ? target : target.toUpperCase()
      statuses.push((await invite(inviter, email)).status)
    }
    // First attempt creates it, the next ones hit the pending-duplicate 409, the one past the limit is 429.
    expect(statuses[0]).toBe(200)
    expect(statuses.slice(1, INVITES_PER_TARGET_EMAIL.max)).toEqual(Array(INVITES_PER_TARGET_EMAIL.max - 1).fill(409))
    expect(statuses[INVITES_PER_TARGET_EMAIL.max]).toBe(429)
  })

  it('the 429 carries a Retry-After header', async () => {
    const inviter = await createPlayer(app, categoryId, 'reintento')
    await app.client.query(
      `insert into rate_limit_buckets (key, count, window_started_at) values ($1, $2, now())
       on conflict (key) do update set count = excluded.count, window_started_at = excluded.window_started_at`,
      [`invite:inviter:${inviter.playerId}`, INVITES_PER_INVITER.max],
    )
    const res = await fetch(new URL('/api/pending-players', app.baseURL), {
      method: 'POST',
      headers: { cookie: inviter.cookie, origin: app.baseURL, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Invitado', email: freshEmail(), category_id: categoryId }),
    })
    expect(res.status).toBe(429)
    const retryAfter = Number(res.headers.get('retry-after'))
    expect(retryAfter).toBeGreaterThan(0)
    expect(retryAfter).toBeLessThanOrEqual(INVITES_PER_INVITER.windowSeconds)
  })
})

describe('Better Auth rate limit (database storage)', () => {
  it(`sign-in from one IP is refused with 429 after ${AUTH_RATE_LIMIT.customRules['/sign-in/email'].max} attempts, counted in rate_limit`, async () => {
    const ip = nextClientIp()
    const max = AUTH_RATE_LIMIT.customRules['/sign-in/email'].max
    const statuses: number[] = []
    for (let i = 0; i <= max; i++) {
      const res = await fetch(new URL('/api/auth/sign-in/email', app.baseURL), {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: app.baseURL, 'x-forwarded-for': ip },
        body: JSON.stringify({ email: 'nadie@tenis.ec', password: 'wrong-password-123' }),
      })
      statuses.push(res.status)
    }
    expect(statuses.slice(0, max).every((s) => s !== 429)).toBe(true)
    expect(statuses[max]).toBe(429)
    const { rows } = await app.client.query<{ count: number }>(`select count from rate_limit where key = $1`, [
      `${ip}|/sign-in/email`,
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].count).toBe(max)

    // A different client address still gets through
    const other = await fetch(new URL('/api/auth/sign-in/email', app.baseURL), {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: app.baseURL, 'x-forwarded-for': nextClientIp() },
      body: JSON.stringify({ email: 'nadie@tenis.ec', password: 'wrong-password-123' }),
    })
    expect(other.status).not.toBe(429)
  })

  it(`sign-up from one IP is refused with 429 after ${AUTH_RATE_LIMIT.customRules['/sign-up/email'].max} accounts`, async () => {
    const ip = nextClientIp()
    const max = AUTH_RATE_LIMIT.customRules['/sign-up/email'].max
    const statuses: number[] = []
    for (let i = 0; i <= max; i++) {
      const res = await fetch(new URL('/api/auth/sign-up/email', app.baseURL), {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: app.baseURL, 'x-forwarded-for': ip },
        body: JSON.stringify({ name: 'Nuevo', email: freshEmail('alta'), password: 'correct-horse-battery' }),
      })
      statuses.push(res.status)
    }
    expect(statuses.slice(0, max)).toEqual(Array(max).fill(200))
    expect(statuses[max]).toBe(429)
  })
})

describe('Better Auth rate limit: client IP behind Vercel', () => {
  const max = AUTH_RATE_LIMIT.customRules['/sign-in/email'].max

  function signIn(headers: Record<string, string>) {
    return fetch(new URL('/api/auth/sign-in/email', app.baseURL), {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: app.baseURL, ...headers },
      body: JSON.stringify({ email: 'nadie@tenis.ec', password: 'wrong-password-123' }),
    }).then((r) => r.status)
  }

  it('regression (PR #47 review): two clients behind a multi-hop x-forwarded-for get separate buckets', async () => {
    // Vercel-shaped: x-vercel-forwarded-for is the client, x-forwarded-for carries an extra hop.
    const vercel = (client: string) => ({ 'x-vercel-forwarded-for': client, 'x-forwarded-for': `${client}, 10.200.0.1` })
    const statuses: number[] = []
    for (let i = 0; i <= max; i++) statuses.push(await signIn(vercel('203.0.113.10')))
    expect(statuses[max]).toBe(429)
    expect(await signIn(vercel('198.51.100.20'))).not.toBe(429)
  })

  it('regression (PR #47 review): rotating a spoofed x-forwarded-for does not buy a fresh bucket', async () => {
    const statuses: number[] = []
    for (let i = 0; i <= max; i++) {
      statuses.push(await signIn({ 'x-vercel-forwarded-for': '203.0.113.99', 'x-forwarded-for': `192.0.2.${i + 1}` }))
    }
    expect(statuses[max]).toBe(429)
  })
})

describe('admin invitation paths: per-email limit', () => {
  it(`an admin gets 429 after ${ADMIN_INVITES_PER_TARGET_EMAIL.max} sends to one email across invite and both resend routes`, async () => {
    const admin = await createPlayer(app, categoryId, 'admin')
    await app.setRole(admin.userId, 'admin')
    const email = freshEmail('admin-objetivo')
    const created = await app.request('POST', '/api/admin/pending-players/invite', {
      cookie: admin.cookie,
      body: { name: 'Invitado', email, category_id: categoryId },
    })
    expect(created.status, JSON.stringify(created.body)).toBe(200)
    const id = (created.body as { invitation: { id: string } }).invitation.id
    const routes = [`/api/admin/invitations/${id}/resend`, `/api/admin/pending-players/${id}/resend`]
    const statuses: number[] = []
    for (let i = 1; i <= ADMIN_INVITES_PER_TARGET_EMAIL.max; i++) {
      statuses.push((await app.request('POST', routes[i % 2], { cookie: admin.cookie })).status)
    }
    expect(statuses.slice(0, -1)).toEqual(Array(ADMIN_INVITES_PER_TARGET_EMAIL.max - 1).fill(200))
    expect(statuses.at(-1)).toBe(429)
    // A new invite to the same address (different letter case) is refused before any lookup
    const again = await app.request('POST', '/api/admin/pending-players/invite', {
      cookie: admin.cookie,
      body: { name: 'Invitado', email: email.toUpperCase(), category_id: categoryId },
    })
    expect(again.status).toBe(429)
  })
})

describe('pending-players: unexpected failures are logged without PII', () => {
  it('logs inviter id and error code, never the invited email', async () => {
    const inviter = await createPlayer(app, categoryId, 'fallo')
    const email = freshEmail('secreto')
    await app.client.exec(`
      create function fail_pending_insert() returns trigger language plpgsql as $$
      begin raise exception 'boom for %', new.email using errcode = 'P0001'; end $$;
      create trigger fail_pending_insert before insert on pending_players for each row execute function fail_pending_insert();
    `)
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const res = await invite(inviter, email)
      expect(res.status).toBe(500)
      const calls = spy.mock.calls.filter((c) => c[0] === 'Invitation create failed')
      expect(calls).toHaveLength(1)
      expect(calls[0][1]).toMatchObject({ inviter_player_id: inviter.playerId, pg_code: 'P0001' })
      expect(JSON.stringify(spy.mock.calls)).not.toContain(email)
    } finally {
      spy.mockRestore()
      await app.client.exec(`drop trigger fail_pending_insert on pending_players; drop function fail_pending_insert();`)
    }
  })
})

describe('matches API: tournament_match is always an array', () => {
  async function tournamentMatch(a: Account, b: Account) {
    const matchId = await activeMatch(app, a, b, false)
    const { rows } = await app.client.query<{ id: string }>(
      `insert into tournaments (name, start_date, created_by) values ('Copa Regresión', now(), $1) returning id`,
      [a.playerId],
    )
    await app.client.query(`update matches set tournament_id = $1 where id = $2`, [rows[0].id, matchId])
    await app.client.query(
      `insert into tournament_matches (tournament_id, match_id, bracket_type, round_number, bracket_position)
       values ($1, $2, 'main', 1, '1')`,
      [rows[0].id, matchId],
    )
    return matchId
  }

  it('regression (hardening P2, staging 8f104ee): a tournament match returned an object and a friendly an empty array', async () => {
    const a = await createPlayer(app, categoryId, 'torneo-a')
    const b = await createPlayer(app, categoryId, 'torneo-b')
    const inTournament = await tournamentMatch(a, b)
    const friendly = await activeMatch(app, a, b, false)

    for (const id of [inTournament, friendly]) {
      const detail = await app.request('GET', `/api/matches/${id}`, { cookie: a.cookie })
      expect(detail.status, JSON.stringify(detail.body)).toBe(200)
      expect(Array.isArray((detail.body as { tournament_match: unknown }).tournament_match), `detail ${id}`).toBe(true)
    }
    const detail = await app.request('GET', `/api/matches/${inTournament}`, { cookie: a.cookie })
    const tm = (detail.body as { tournament_match: Array<{ round_number: number; bracket_type: string }> }).tournament_match
    expect(tm).toHaveLength(1)
    expect(tm[0]).toMatchObject({ round_number: 1, bracket_type: 'main' })

    const list = await app.request('GET', '/api/matches', { cookie: a.cookie, query: { limit: '50' } })
    expect(list.status, JSON.stringify(list.body)).toBe(200)
    const listed = (list.body as { matches: Array<{ id: string; tournament_match: unknown }> }).matches
    const byId = new Map(listed.map((m) => [m.id, m.tournament_match]))
    expect(byId.has(inTournament) && byId.has(friendly)).toBe(true)
    for (const m of listed) expect(Array.isArray(m.tournament_match), `list ${m.id}`).toBe(true)
    expect(byId.get(inTournament)).toHaveLength(1)
    expect(byId.get(friendly)).toEqual([])
  })
})
