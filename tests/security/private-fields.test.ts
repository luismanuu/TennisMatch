// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { ROUTE_ACCESS } from './route-access'
import { startTestApp, type Route, type TestApp } from './harness'

// Oracle: no GET route that an anonymous visitor or an unrelated signed-in player can call returns another
// person's phone number, email, auth user id or invitation token. The forbidden values are read back from the
// database itself after every seeded world, so a new private column only needs a line in privateValues().

const PRIVATE_KEYS = ['phone_number', 'user_id', 'userId', 'email', 'invitation_token']

type Caller = { name: string; cookie?: string; userId?: string; playerId?: string }

type World = {
  players: string[]
  tournaments: string[]
  groups: string[]
  pending: string[]
  tokens: string[]
  matches: string[]
}

let app: TestApp
let stranger: Caller
let categoryId: string
let cityId: string
let seq = 0

const anonymous: Caller = { name: 'anonymous' }

beforeAll(async () => {
  app = await startTestApp()
  const [category] = (
    await app.client.query<{ id: string }>(`insert into categories (name, "order", default_elo) values ('Cuarta', 4, 1500) returning id`)
  ).rows
  categoryId = category.id
  const [city] = (
    await app.client.query<{ id: string }>(
      `insert into cities (name) values ('Ciudad de prueba') on conflict (name) do update set name = excluded.name returning id`,
    )
  ).rows
  cityId = city.id

  const account = await app.signUp('extrano@tenis.ec')
  const [row] = (
    await app.client.query<{ id: string }>(
      `insert into players (user_id, name, phone_number, category_id, city_id) values ($1, 'Extraño', '+593 98 000 0001', $2, $3) returning id`,
      [account.userId, categoryId, cityId],
    )
  ).rows
  stranger = { name: 'unrelated player', cookie: account.cookie, userId: account.userId, playerId: row.id }
}, 120_000)

afterAll(async () => {
  await app?.close()
})

const q = async <T>(sql: string, params: unknown[] = []) => (await app.client.query<T>(sql, params)).rows

// ── The generator ───────────────────────────────────────────────────────────────────────────────

type PlayerSpec = { name: string; phone: boolean; rated: boolean }
type TournamentSpec = {
  status: 'upcoming' | 'active' | 'completed'
  organized: boolean
  registrants: number[]
  groups: number
}
type WorldSpec = {
  players: PlayerSpec[]
  tournaments: TournamentSpec[]
  friendlies: Array<[number, number]>
  invites: number[]
}

const playerSpec = fc.record({
  name: fc.oneof(
    fc.string({ unit: 'grapheme', minLength: 1, maxLength: 24 }),
    fc.constantFrom('José Ñúñez', 'Zoë 🎾', 'María-José O’Brien', '李小龙', 'علي', ' ', '"quoted"'),
  ),
  phone: fc.boolean(),
  rated: fc.boolean(),
})

const worldSpec: fc.Arbitrary<WorldSpec> = fc
  .array(playerSpec, { minLength: 0, maxLength: 18 })
  .chain((players) => {
    const index = players.length ? fc.nat({ max: players.length - 1 }) : fc.constant(-1)
    const tournament = fc.record({
      status: fc.constantFrom('upcoming' as const, 'active' as const, 'completed' as const),
      organized: fc.boolean(),
      registrants: players.length ? fc.uniqueArray(fc.nat({ max: players.length - 1 }), { maxLength: players.length }) : fc.constant([]),
      groups: fc.nat({ max: 3 }),
    })
    return fc.record({
      players: fc.constant(players),
      tournaments: fc.array(tournament, { minLength: 0, maxLength: 3 }),
      friendlies: players.length > 1 ? fc.array(fc.tuple(index, index), { maxLength: 6 }) : fc.constant([] as Array<[number, number]>),
      invites: players.length ? fc.array(index, { maxLength: 3 }) : fc.constant([]),
    })
  })

async function insertUser(): Promise<string> {
  const id = randomUUID()
  const tag = `u${++seq}`
  await q(`insert into "user" (id, name, email) values ($1, $2, $3)`, [id, tag, `${tag}.privado@correo.ec`])
  return id
}

async function insertPlayer(spec: PlayerSpec): Promise<string> {
  const userId = await insertUser()
  const phone = spec.phone ? `+593 99 ${String(1_000_000 + ++seq).slice(-7)}` : null
  const [row] = await q<{ id: string }>(
    `insert into players (user_id, name, phone_number, category_id, city_id, elo, total_matches_played, placement_matches_completed)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
    [userId, spec.name, phone, categoryId, cityId, 1400 + seq, spec.rated ? 5 : 0, spec.rated ? 3 : 0],
  )
  return row.id
}

async function seedWorld(spec: WorldSpec): Promise<World> {
  const world: World = { players: [], tournaments: [], groups: [], pending: [], tokens: [], matches: [] }
  for (const p of spec.players) world.players.push(await insertPlayer(p))
  // Tournaments need a creator; a world without players borrows a fresh one that registers nowhere.
  const creatorPool = world.players.length ? world.players : [await insertPlayer({ name: 'Creador', phone: true, rated: false })]

  for (const [ti, t] of spec.tournaments.entries()) {
    const creator = creatorPool[ti % creatorPool.length]
    const [row] = await q<{ id: string }>(
      `insert into tournaments (name, start_date, status, created_by, organizer_id, category_id)
       values ($1, now() + interval '7 days', $2, $3, $4, $5) returning id`,
      [`Torneo ${++seq}`, t.status, creator, t.organized ? creator : null, categoryId],
    )
    world.tournaments.push(row.id)
    const registered = t.registrants.map((i) => world.players[i])
    for (const playerId of registered) {
      await q(`insert into tournament_registrations (tournament_id, player_id, status) values ($1, $2, 'confirmed')`, [row.id, playerId])
    }
    for (let g = 0; g < Math.min(t.groups, Math.max(registered.length, 1)); g++) {
      const [group] = await q<{ id: string }>(
        `insert into tournament_groups (tournament_id, group_name, group_number) values ($1, $2, $3) returning id`,
        [row.id, `Group ${String.fromCharCode(65 + g)}`, g + 1],
      )
      world.groups.push(group.id)
      const members = registered.filter((_, i) => i % t.groups === g)
      for (const playerId of members) {
        await q(`insert into tournament_group_players (tournament_id, group_id, player_id) values ($1, $2, $3)`, [row.id, group.id, playerId])
        await q(`insert into tournament_standings (tournament_id, group_id, player_id) values ($1, $2, $3)`, [row.id, group.id, playerId])
      }
      if (members.length >= 2) {
        const [m] = await q<{ id: string }>(
          `insert into matches (player1_id, player2_id, tournament_id, status) values ($1, $2, $3, 'scheduled') returning id`,
          [members[0], members[1], row.id],
        )
        world.matches.push(m.id)
        await q(
          `insert into tournament_matches (tournament_id, match_id, bracket_type, round_number, group_id) values ($1, $2, 'group', 1, $3)`,
          [row.id, m.id, group.id],
        )
      }
    }
  }

  for (const [a, b] of spec.friendlies) {
    if (a === b) continue
    const [p1, p2] = [world.players[a], world.players[b]]
    const [m] = await q<{ id: string }>(
      `insert into matches (player1_id, player2_id, winner_id, status, score, played_at) values ($1, $2, $1, 'completed', '6-4 6-4', now()) returning id`,
      [p1, p2],
    )
    world.matches.push(m.id)
    await q(`insert into match_messages (match_id, player_id, message) values ($1, $2, 'nos vemos a las 8')`, [m.id, p1])
    for (const [player, opponent, won] of [[p1, p2, true], [p2, p1, false]] as const) {
      await q(
        `insert into rating_history (player_id, match_id, elo_before, elo_after, elo_change, mmr_before, mmr_after, mmr_change,
           uncertainty_before, uncertainty_after, k_factor, expected_score, actual_score, opponent_id, was_winner)
         values ($1, $2, 1500, $3, $4, 0, 0, 0, 1, 1, 32, 0.5, $5, $6, $7)`,
        [player, m.id, won ? 1516 : 1484, won ? 16 : -16, won ? 1 : 0, opponent, won],
      )
    }
  }

  for (const i of spec.invites) {
    const tag = `inv${++seq}`
    const token = `tok-${randomUUID()}`
    const [pending] = await q<{ id: string }>(
      `insert into pending_players (name, email, category_id, invited_by_player_id, invitation_token) values ($1, $2, $3, $4, $5) returning id`,
      [`Invitado ${tag}`, `${tag}.invitado@correo.ec`, categoryId, world.players[i], token],
    )
    world.pending.push(pending.id)
    world.tokens.push(token)
    const [m] = await q<{ id: string }>(
      `insert into matches (player1_id, pending_player2_id, status) values ($1, $2, 'scheduled') returning id`,
      [world.players[i], pending.id],
    )
    world.matches.push(m.id)
  }
  return world
}

// ── The oracle ──────────────────────────────────────────────────────────────────────────────────

async function privateValues(caller: Caller): Promise<string[]> {
  const values = [
    ...(await q<{ v: string }>(`select phone_number as v from players where phone_number is not null and id is distinct from $1`, [caller.playerId ?? null])),
    ...(await q<{ v: string }>(`select id as v from "user" where id is distinct from $1`, [caller.userId ?? null])),
    ...(await q<{ v: string }>(`select email as v from "user" where id is distinct from $1`, [caller.userId ?? null])),
    ...(await q<{ v: string }>(`select email as v from pending_players`)),
    ...(await q<{ v: string }>(`select invitation_token as v from pending_players where invitation_token is not null`)),
    ...(await q<{ v: string }>(`select token as v from session`)),
    ...(await q<{ v: string }>(
      `select unnest(array[password, access_token, refresh_token, id_token]) as v from account where user_id is distinct from $1`,
      [caller.userId ?? null],
    )),
  ]
  return values.map((r) => r.v).filter((v): v is string => Boolean(v))
}

function privateKeysIn(value: unknown, path = '$', found: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((v, i) => privateKeysIn(v, `${path}[${i}]`, found))
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (PRIVATE_KEYS.includes(k)) found.push(`${path}.${k}`)
      privateKeysIn(v, `${path}.${k}`, found)
    }
  }
  return found
}

// The GET routes an outsider can reach: public and optional ones for everybody, plus signed-in ones for the
// unrelated player (they should refuse or return only the caller's own data).
function outsiderRoutes(caller: Caller): Route[] {
  return app.routes.filter((r) => {
    if (r.method !== 'GET') return false
    const access = ROUTE_ACCESS[r.file]
    if (access === 'public' || access === 'optional') return true
    return caller.cookie !== undefined && access === 'user'
  })
}

function queryVariants(pattern: string, world: World): Array<Record<string, string>> {
  const variants: Record<string, Array<Record<string, string>>> = {
    '/api/tournaments': [{}, { status: 'upcoming' }, { status: 'active' }, { status: 'completed' }],
    '/api/leaderboard': [{}, { center_around_player: 'true' }],
    '/api/leaderboard/nearby': world.players.slice(0, 2).map((player_id) => ({ player_id })),
    '/api/players/search': [{ q: 'a' }, { q: 'Jugador' }],
    '/api/rankings': [{ min_matches: '0' }],
    '/api/matches': [{ skip_24h_filter: 'true' }],
  }
  const list = variants[pattern] ?? [{}]
  return list.length ? list : [{}]
}

// Every concrete path for a route pattern, drawn from the world's own ids. An unknown parameter fails the
// test rather than skipping the route, so a new public route cannot slip past the oracle.
function concretePaths(pattern: string, world: World): string[] {
  const params = [...pattern.matchAll(/\/([^/]+)\/:(\w+)/g)]
  let paths = [pattern]
  for (const [, parent, name] of params) {
    let ids: string[]
    if (parent === 'tournaments') ids = world.tournaments
    else if (parent === 'players' || parent === 'head-to-head') ids = world.players
    else if (parent === 'group') ids = world.groups
    else if (parent === 'pending-players') ids = world.pending
    else if (parent === 'matches') ids = world.matches
    else if (parent === 'invitation') ids = world.tokens
    else throw new Error(`no id source for :${name} after /${parent}/ in ${pattern}`)
    const sample = ids.length ? ids.slice(0, 4) : [randomUUID()]
    paths = paths.flatMap((p) => sample.map((id) => p.replace(`:${name}`, id)))
  }
  return paths
}

async function invitationOwnValues(path: string): Promise<string[]> {
  const token = path.split('/').pop()!
  const rows = await q<{ email: string }>(`select email from pending_players where invitation_token = $1`, [token])
  return [token, ...rows.map((r) => r.email)]
}

type Leak = { caller: string; path: string; status: number; values: string[]; keys: string[] }

// Route patterns that answered 200 at least once, across every world in the file.
const answered200 = new Set<string>()

async function leaksFor(caller: Caller, world: World): Promise<{ leaks: Leak[]; ok: number }> {
  const forbidden = await privateValues(caller)
  const leaks: Leak[] = []
  let ok = 0
  for (const route of outsiderRoutes(caller)) {
    for (const path of concretePaths(route.pattern, world)) {
      for (const query of queryVariants(route.pattern, world)) {
        const res = await app.request('GET', path, { cookie: caller.cookie, query })
        if (res.status === 200) {
          ok++
          answered200.add(`${caller.name} ${route.pattern}`)
        }
        const text = typeof res.body === 'string' ? res.body : JSON.stringify(res.body)
        // Whoever holds an invitation token is the invitee: that one invitation's email and token are theirs.
        const own = route.pattern === '/api/pending-players/invitation/:token' ? await invitationOwnValues(path) : []
        const values = forbidden.filter((v) => text.includes(v) && !own.includes(v))
        // Key names are checked on public routes only: a signed-in route may return the caller's own row.
        const access = ROUTE_ACCESS[route.file]
        const keys =
          access === 'public' || access === 'optional' ? privateKeysIn(res.body).filter((k) => !(own.length && k === '$.email')) : []
        if (values.length || keys.length) leaks.push({ caller: caller.name, path: `${path}?${new URLSearchParams(query)}`, status: res.status, values, keys: keys.slice(0, 5) })
      }
    }
  }
  return { leaks, ok }
}

// ── Tests ───────────────────────────────────────────────────────────────────────────────────────

describe('no outsider GET response carries private fields (property over seeded worlds)', () => {
  it('anonymous and an unrelated player never see a phone, email, auth user id or token', async () => {
    let answered = 0
    await fc.assert(
      fc.asyncProperty(worldSpec, async (spec) => {
        const world = await seedWorld(spec)
        for (const caller of [anonymous, stranger]) {
          const { leaks, ok } = await leaksFor(caller, world)
          answered += ok
          if (leaks.length) throw new Error(`leaks:\n${JSON.stringify(leaks.slice(0, 8), null, 1)}`)
        }
        return true
      }),
      { seed: 20260926, numRuns: 12, endOnFailure: true },
    )
    // Non-vacuity: the routes really answered with data, not only 404s and 500s.
    expect(answered).toBeGreaterThan(200)
  }, 600_000)

  it('every public GET route answered 200 to an anonymous caller at least once (the oracle saw real data)', () => {
    const publicGets = app.routes.filter((r) => r.method === 'GET' && ['public', 'optional'].includes(ROUTE_ACCESS[r.file]))
    expect(publicGets.map((r) => r.pattern).filter((p) => !answered200.has(`anonymous ${p}`))).toEqual([])
  })

  it('a large field: 40 players, all with phones, all registered in one grouped tournament', async () => {
    const players = Array.from({ length: 40 }, (_, i) => ({ name: `Jugadora ${i} ñ`, phone: true, rated: i % 2 === 0 }))
    const world = await seedWorld({
      players,
      tournaments: [{ status: 'active', organized: true, registrants: players.map((_, i) => i), groups: 3 }],
      friendlies: [[0, 1], [2, 3]],
      invites: [0],
    })
    for (const caller of [anonymous, stranger]) {
      const { leaks } = await leaksFor(caller, world)
      expect(leaks).toEqual([])
    }
  }, 300_000)
})

// Audit 2026-09-26, finding 1: anonymous GET /api/tournaments returned 13 tournaments with 39 phone_number
// fields (17 non-null) and 39 user_id values, from `registrations: { with: { player: true } }` and the
// full created_by_player / organizer rows (tournaments/index.get.ts:51-58).
describe('regression: tournament routes returned whole player rows', () => {
  let world: World
  let phones: string[]
  let userIds: string[]

  beforeAll(async () => {
    world = await seedWorld({
      players: [
        { name: 'Organizadora Pública', phone: true, rated: true },
        { name: 'Inscrita Uno', phone: true, rated: false },
        { name: 'Inscrito Dos', phone: false, rated: true },
      ],
      tournaments: [
        { status: 'upcoming', organized: true, registrants: [0, 1, 2], groups: 1 },
        { status: 'completed', organized: true, registrants: [1, 2], groups: 0 },
      ],
      friendlies: [],
      invites: [],
    })
    const rows = await q<{ phone_number: string | null; user_id: string }>(
      `select phone_number, user_id from players where id = any($1::uuid[])`,
      [world.players],
    )
    phones = rows.map((r) => r.phone_number).filter((p): p is string => p !== null)
    userIds = rows.map((r) => r.user_id)
    expect(phones).toHaveLength(2)
  })

  const cases: Array<[string, () => string, Record<string, string>?]> = [
    ['tournaments/index.get.ts:51-58 GET /api/tournaments', () => '/api/tournaments'],
    ['tournaments/past.get.ts:34-38 GET /api/tournaments/past', () => '/api/tournaments/past'],
    ['tournaments/[id].get.ts:20-23 GET /api/tournaments/:id', () => `/api/tournaments/${world.tournaments[0]}`],
    ['tournaments/[id]/bracket.get.ts:27-28 GET /api/tournaments/:id/bracket', () => `/api/tournaments/${world.tournaments[0]}/bracket`],
  ]

  it.each(cases)('%s: no phone_number or user_id, still lists the players by name', async (_, path) => {
    const res = await app.request('GET', path())
    expect(res.status).toBe(200)
    const text = JSON.stringify(res.body)
    for (const phone of phones) expect(text).not.toContain(phone)
    for (const id of userIds) expect(text).not.toContain(id)
    expect(privateKeysIn(res.body)).toEqual([])
    expect(text).toMatch(/Inscrita Uno|Inscrito Dos/)
  })

  it('the tournament page still gets what it renders: organizer, creator, registrant name and category', async () => {
    const res = await app.request('GET', `/api/tournaments/${world.tournaments[0]}`)
    const t = res.body as {
      organizer: { id: string; name: string }
      created_by_player: { id: string; name: string }
      registrations: Array<{ player: { id: string; name: string; category: { name: string } | null } }>
      groups: Array<{ players: Array<{ player: { id: string; name: string } }> }>
    }
    expect(t.organizer).toMatchObject({ id: world.players[0], name: 'Organizadora Pública' })
    expect(t.created_by_player).toMatchObject({ id: world.players[0], name: 'Organizadora Pública' })
    expect(t.registrations.map((r) => r.player.name).sort()).toEqual(['Inscrita Uno', 'Inscrito Dos', 'Organizadora Pública'])
    expect(t.registrations.every((r) => r.player.category?.name === 'Cuarta')).toBe(true)
    expect(t.groups[0].players.map((p) => p.player.id).sort()).toEqual([...world.players].sort())
  })
})

// The signed-in views that carry contact details on purpose keep them, and lose the auth user id: a match
// participant sees the opponent's phone (the WhatsApp button), a tournament's organizer sees registrants'
// phone and email. Neither ever needed another person's user_id or an invitee's email.
describe('signed-in views: contact details where the product uses them, never auth ids', () => {
  async function account(email: string, role: 'player' | 'tournament_organizer' = 'player') {
    const { cookie, userId } = await app.signUp(email, role)
    const phone = `+593 97 ${String(1_000_000 + ++seq).slice(-7)}`
    const [row] = await q<{ id: string }>(
      `insert into players (user_id, name, phone_number, category_id) values ($1, $2, $3, $4) returning id`,
      [userId, email.split('@')[0], phone, categoryId],
    )
    return { cookie, userId, phone, playerId: row.id, email }
  }

  it('matches/[id] and its messages: the opponent\'s phone, no user_id of anyone, no invitee email', async () => {
    const ana = await account('ana.partido@tenis.ec')
    const beto = await account('beto.partido@tenis.ec')
    const [m] = await q<{ id: string }>(`insert into matches (player1_id, player2_id, status) values ($1, $2, 'scheduled') returning id`, [
      ana.playerId,
      beto.playerId,
    ])
    await q(`insert into match_messages (match_id, player_id, message) values ($1, $2, 'hola')`, [m.id, beto.playerId])

    const detail = await app.request('GET', `/api/matches/${m.id}`, { cookie: ana.cookie })
    expect(detail.status).toBe(200)
    expect((detail.body as { player2: { phone_number: string } }).player2.phone_number).toBe(beto.phone)
    const messages = await app.request('GET', `/api/matches/${m.id}/messages`, { cookie: ana.cookie })
    expect(messages.status).toBe(200)
    expect((messages.body as Array<{ player: { name: string } }>)[0].player.name).toBe('beto.partido')
    for (const res of [detail, messages]) {
      const text = JSON.stringify(res.body)
      expect(text).not.toContain(beto.userId)
      expect(text).not.toContain(ana.userId)
      expect(privateKeysIn(res.body).filter((k) => !k.endsWith('.phone_number'))).toEqual([])
    }

    const [pending] = await q<{ id: string }>(
      `insert into pending_players (name, email, category_id, invited_by_player_id) values ('Por llegar', 'por.llegar@correo.ec', $1, $2) returning id`,
      [categoryId, ana.playerId],
    )
    const [invite] = await q<{ id: string }>(
      `insert into matches (player1_id, pending_player2_id, status) values ($1, $2, 'scheduled') returning id`,
      [ana.playerId, pending.id],
    )
    const invited = await app.request('GET', `/api/matches/${invite.id}`, { cookie: ana.cookie })
    const listed = await app.request('GET', '/api/matches', { cookie: ana.cookie, query: { skip_24h_filter: 'true' } })
    for (const res of [invited, listed]) {
      expect(res.status).toBe(200)
      expect(JSON.stringify(res.body)).toContain('Por llegar')
      expect(JSON.stringify(res.body)).not.toContain('por.llegar@correo.ec')
    }
  })

  it('organizer/tournaments/[id]: registrants\' phone and email for their organizer, no user_id, groups stay public', async () => {
    const org = await account('dueno.torneo@tenis.ec', 'tournament_organizer')
    const carla = await account('carla.torneo@tenis.ec')
    const [t] = await q<{ id: string }>(
      `insert into tournaments (name, start_date, created_by, organizer_id) values ('Copa Contacto', now(), $1, $1) returning id`,
      [org.playerId],
    )
    await q(`insert into tournament_registrations (tournament_id, player_id, status) values ($1, $2, 'confirmed')`, [t.id, carla.playerId])
    const [g] = await q<{ id: string }>(`insert into tournament_groups (tournament_id, group_name, group_number) values ($1, 'Group A', 1) returning id`, [t.id])
    await q(`insert into tournament_group_players (tournament_id, group_id, player_id) values ($1, $2, $3)`, [t.id, g.id, carla.playerId])

    for (const path of [`/api/organizer/tournaments/${t.id}`, '/api/organizer/tournaments']) {
      const res = await app.request('GET', path, { cookie: org.cookie })
      expect(res.status, path).toBe(200)
      const text = JSON.stringify(res.body)
      expect(text, path).not.toContain(carla.userId)
      expect(privateKeysIn(res.body).filter((k) => k.includes('user_id')), path).toEqual([])
      expect(text, path).toContain('carla.torneo')
    }
    const detail = (await app.request('GET', `/api/organizer/tournaments/${t.id}`, { cookie: org.cookie })).body as {
      registrations: Array<{ player: { phone_number: string; email: string } }>
      groups: Array<{ players: Array<{ player: Record<string, unknown> }> }>
    }
    expect(detail.registrations[0].player).toMatchObject({ phone_number: carla.phone, email: carla.email })
    expect(privateKeysIn(detail.groups)).toEqual([])
  })
})
