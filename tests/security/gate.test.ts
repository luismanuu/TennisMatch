// @vitest-environment node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { ROUTE_ACCESS, type Access } from './route-access'
import { concretePath, discoverRoutes, IDENTITY_HEADERS, ROOT, startTestApp, type Route, type TestApp } from './harness'

const SIGNED_IN: Access[] = ['user', 'admin', 'organizer', 'admin_or_organizer']
const AN_ID = '00000000-0000-4000-8000-000000000001'

const routes = discoverRoutes().filter((r) => !r.file.startsWith('server/api/auth/'))
const label = (r: Route) => `${r.method ?? 'ANY'} ${r.pattern}`
const methodOf = (r: Route) => r.method ?? 'GET'
const accessOf = (r: Route) => ROUTE_ACCESS[r.file]

let app: TestApp
let victim: { cookie: string; userId: string }
let player: { cookie: string; userId: string }
let organizer: { cookie: string; userId: string }
let admin: { cookie: string; userId: string }

function forged(userId: string) {
  return {
    query: { clerk_id: userId, user_id: userId, userId },
    body: { clerk_id: userId, user_id: userId, userId, clerk_user_id: userId },
    headers: Object.fromEntries([...IDENTITY_HEADERS.map((h) => [h, userId]), ['authorization', `Bearer ${userId}`]]),
  }
}

beforeAll(async () => {
  app = await startTestApp()
  victim = await app.signUp('victima@tenis.ec', 'admin')
  player = await app.signUp('jugador@tenis.ec')
  organizer = await app.signUp('organiza@tenis.ec', 'tournament_organizer')
  admin = await app.signUp('admin@tenis.ec', 'admin')
}, 120_000)

afterAll(async () => {
  await app?.close()
})

describe('route classification', () => {
  it('every handler has an access class', () => {
    const missing = routes.filter((r) => !accessOf(r)).map((r) => r.file)
    expect(missing).toEqual([])
  })

  it('the classification names no handler that does not exist', () => {
    const files = new Set(routes.map((r) => r.file))
    expect(Object.keys(ROUTE_ACCESS).filter((f) => !files.has(f))).toEqual([])
  })

  it('everything under /api/admin is admin-only, everything under /api/organizer needs the organizer role', () => {
    for (const r of routes) {
      if (r.pattern.startsWith('/api/admin/')) expect(accessOf(r), r.file).toBe('admin')
      if (r.pattern.startsWith('/api/organizer/')) expect(['organizer', 'admin_or_organizer'], r.file).toContain(accessOf(r))
    }
  })

  it('no handler reads identity from h3 directly, bypassing the recorded helpers', () => {
    for (const r of routes) {
      const src = readFileSync(join(ROOT, r.file), 'utf8')
      expect(src, r.file).not.toMatch(/import\s*\{[^}]*\b(getQuery|readBody|getHeader|getHeaders|getRequestHeader)\b[^}]*\}\s*from\s*['"]h3['"]/)
      expect(src, r.file).not.toMatch(/\bclerk/i)
    }
  })
})

describe('no session + another user\'s id in the query, body and headers', () => {
  it.each(routes.filter((r) => SIGNED_IN.includes(accessOf(r))).map((r) => [label(r), r] as const))(
    '%s → 401',
    async (_, r) => {
      const res = await app.request(methodOf(r), concretePath(r.pattern, AN_ID), forged(victim.userId))
      expect(res.status).toBe(401)
    },
  )
})

describe('signed-in non-admin on admin routes', () => {
  it.each(routes.filter((r) => accessOf(r) === 'admin').map((r) => [label(r), r] as const))(
    '%s → 403 for a player, even carrying an admin\'s id',
    async (_, r) => {
      const res = await app.request(methodOf(r), concretePath(r.pattern, AN_ID), {
        cookie: player.cookie,
        ...forged(victim.userId),
      })
      expect(res.status).toBe(403)
    },
  )

  it.each(routes.filter((r) => accessOf(r) === 'admin').map((r) => [label(r), r] as const))(
    '%s → 403 for a tournament organizer',
    async (_, r) => {
      const res = await app.request(methodOf(r), concretePath(r.pattern, AN_ID), { cookie: organizer.cookie })
      expect(res.status).toBe(403)
    },
  )
})

describe('organizer routes', () => {
  it.each(routes.filter((r) => accessOf(r) === 'organizer').map((r) => [label(r), r] as const))(
    '%s → 403 for a player',
    async (_, r) => {
      const res = await app.request(methodOf(r), concretePath(r.pattern, AN_ID), { cookie: player.cookie })
      expect(res.status).toBe(403)
    },
  )
})

describe('handlers never read identity from the request', () => {
  it.each(routes.map((r) => [label(r), r] as const))('%s', async (_, r) => {
    const who = accessOf(r) === 'organizer' ? organizer : accessOf(r) === 'user' || accessOf(r) === 'optional' ? player : admin
    const res = await app.request(methodOf(r), concretePath(r.pattern, AN_ID), { cookie: who.cookie, body: {} })
    expect(res.reads).toEqual([])
  })
})

describe('public routes stay public', () => {
  it.each(routes.filter((r) => accessOf(r) === 'public' || accessOf(r) === 'optional').map((r) => [label(r), r] as const))(
    '%s does not demand a session',
    async (_, r) => {
      const res = await app.request(methodOf(r), concretePath(r.pattern, AN_ID))
      expect([401, 403]).not.toContain(res.status)
    },
  )
})

describe('roles come from the database on every request', () => {
  it('a role granted or revoked takes effect on the next request (property over role sequences)', async () => {
    const adminRoute = routes.find((r) => r.file === 'server/api/admin/players.get.ts')!
    const account = await app.signUp('rotacion@tenis.ec')
    await fc.assert(
      fc.asyncProperty(fc.array(fc.constantFrom('player', 'admin', 'tournament_organizer' as const), { minLength: 1, maxLength: 6 }), async (roles) => {
        for (const role of roles) {
          await app.setRole(account.userId, role)
          const res = await app.request('GET', adminRoute.pattern, { cookie: account.cookie })
          if ((res.status === 403) !== (role !== 'admin')) return false
        }
        return true
      }),
      { seed: 20260925, numRuns: 15 },
    )
  })

  it('sign-up cannot self-assign a role', async () => {
    const res = await fetch(`${app.baseURL}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: app.baseURL },
      body: JSON.stringify({ name: 'Mallory', email: 'mallory@tenis.ec', password: 'correct-horse-battery', role: 'admin' }),
    })
    const [row] = (await app.client.query<{ role: string }>(`select role from "user" where email = 'mallory@tenis.ec'`)).rows
    expect(row?.role ?? 'not-created').not.toBe('admin')
    expect([200, 400]).toContain(res.status)
  })
})

// Named regressions for the holes in the discovery report (2026-09-25), with the requests that used to succeed.
describe('regressions: client-supplied identity', () => {
  it('admin/players.get.ts:7-17: ?clerk_id=<an admin> without a session no longer lists players', async () => {
    const res = await app.request('GET', '/api/admin/players', { query: { clerk_id: admin.userId } })
    expect(res.status).toBe(401)
  })

  it('admin/players.get.ts:7-17: a player session plus ?clerk_id=<an admin> is refused', async () => {
    const res = await app.request('GET', '/api/admin/players', { cookie: player.cookie, query: { clerk_id: admin.userId } })
    expect(res.status).toBe(403)
  })

  it('matches/[id].put.ts:28: body.clerk_id of a participant without a session cannot act on the match', async () => {
    const res = await app.request('PUT', `/api/matches/${AN_ID}`, {
      body: { clerk_id: victim.userId, action: 'approve_score' },
    })
    expect(res.status).toBe(401)
  })

  it('players/me.get.ts: ?clerk_id=<victim> without a session no longer returns the victim\'s profile', async () => {
    const res = await app.request('GET', '/api/players/me', { query: { clerk_id: victim.userId } })
    expect(res.status).toBe(401)
  })
})

describe('regressions: city-segment handlers discarded `await checkIsAdmin(...)`', () => {
  const cases: Array<[string, string, string]> = [
    ['index.get.ts:21', 'GET', '/api/admin/city-segments'],
    ['index.post.ts:25', 'POST', '/api/admin/city-segments'],
    ['[id].put.ts:27', 'PUT', `/api/admin/city-segments/${AN_ID}`],
    ['[id].delete.ts:25', 'DELETE', `/api/admin/city-segments/${AN_ID}`],
    ['[id]/cities.post.ts:34', 'POST', `/api/admin/city-segments/${AN_ID}/cities`],
    ['[id]/cities.delete.ts:34', 'DELETE', `/api/admin/city-segments/${AN_ID}/cities`],
  ]
  it.each(cases)('%s: a player gets 403', async (_, method, path) => {
    const res = await app.request(method, path, {
      cookie: player.cookie,
      body: { clerk_id: player.userId, name: 'Segmento pirata', city_ids: [] },
    })
    expect(res.status).toBe(403)
  })
  it.each(cases)('%s: no session gets 401', async (_, method, path) => {
    const res = await app.request(method, path, { body: { clerk_id: admin.userId, name: 'Segmento pirata' } })
    expect(res.status).toBe(401)
  })
})
