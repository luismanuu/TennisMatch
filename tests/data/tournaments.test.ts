// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestApp, type TestApp } from '../security/harness'
import { assertGroupStage, bracketRowCounts, rows, seedPlayers, signUpPlayer, type Actor } from './tournaments-helpers'

let app: TestApp
let admin: Actor
let organizer: Actor
let otherOrganizer: Actor

type Created = { tournament: { id: string; organizer_id: string | null; created_by: string; current_phase: string } }

async function adminTournament(extra: Record<string, unknown> = {}): Promise<string> {
  const res = await app.request('POST', '/api/admin/tournaments', {
    cookie: admin.cookie,
    body: { name: 'Abierto de Guayaquil', start_date: '2026-11-01T09:00', group_size: 4, ...extra },
  })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return (res.body as Created).tournament.id
}

async function organizerTournament(owner: Actor): Promise<string> {
  const res = await app.request('POST', '/api/organizer/tournaments', {
    cookie: owner.cookie,
    body: { name: 'Copa del Organizador', start_date: '2026-11-08T09:00', group_size: 4 },
  })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  const created = (res.body as Created).tournament
  expect(created.organizer_id).toBe(owner.playerId)
  return created.id
}

beforeAll(async () => {
  app = await startTestApp()
  admin = await signUpPlayer(app, 'admin.torneos@tenis.ec', 'admin')
  organizer = await signUpPlayer(app, 'organiza.torneos@tenis.ec', 'tournament_organizer')
  otherOrganizer = await signUpPlayer(app, 'otro.organiza@tenis.ec', 'tournament_organizer')
}, 120_000)

afterAll(async () => {
  await app?.close()
})

describe('admin flow: create, register 8, generate a 2-group stage', () => {
  it('builds groups, group players, every pair once, zeroed standings, and the round once a deadline is set', async () => {
    const tournamentId = await adminTournament()

    // Four players register themselves, four are registered by the admin
    const selfRegistered: Actor[] = []
    for (let i = 0; i < 4; i++) selfRegistered.push(await signUpPlayer(app, `auto${i}@tenis.ec`))
    for (const p of selfRegistered) {
      const res = await app.request('POST', `/api/tournaments/${tournamentId}/register`, { cookie: p.cookie, body: {} })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
    }
    const byAdmin = await seedPlayers(app, 4)
    for (const playerId of byAdmin) {
      const res = await app.request('POST', `/api/admin/tournaments/${tournamentId}/register`, {
        cookie: admin.cookie,
        body: { player_id: playerId },
      })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
    }
    const playerIds = [...selfRegistered.map((p) => p.playerId), ...byAdmin]

    const gen = await app.request('POST', `/api/admin/tournaments/${tournamentId}/generate-brackets`, { cookie: admin.cookie })
    expect(gen.status, JSON.stringify(gen.body)).toBe(200)
    expect(gen.body).toMatchObject({ success: true, groups: 2, groupMatches: 12 })
    expect(await assertGroupStage(app, tournamentId, playerIds, 4)).toEqual([])

    // Generation does not invent a deadline: the group round appears when one is set, and reaches every group match
    expect(await rows(app, `select id from tournament_rounds where tournament_id = $1`, [tournamentId])).toEqual([])
    const deadline = '2026-12-01T23:00:00.000Z'
    const dl = await app.request('PUT', `/api/admin/tournaments/${tournamentId}/group-deadline`, {
      cookie: admin.cookie,
      body: { deadline },
    })
    expect(dl.status, JSON.stringify(dl.body)).toBe(200)
    const rounds = await rows<{ bracket_type: string; round_number: number; deadline: Date }>(
      app,
      `select bracket_type, round_number, deadline from tournament_rounds where tournament_id = $1`,
      [tournamentId],
    )
    expect(rounds).toHaveLength(1)
    expect(rounds[0]).toMatchObject({ bracket_type: 'group', round_number: 1 })
    expect(new Date(rounds[0].deadline).toISOString()).toBe(deadline)
    const deadlines = await rows<{ round_deadline: Date | null }>(
      app,
      `select round_deadline from tournament_matches where tournament_id = $1`,
      [tournamentId],
    )
    expect(deadlines).toHaveLength(12)
    expect(deadlines.every((d) => d.round_deadline && new Date(d.round_deadline).toISOString() === deadline)).toBe(true)

    // The read routes serve the same bracket
    const bracket = await app.request('GET', `/api/tournaments/${tournamentId}/bracket`)
    expect(bracket.status).toBe(200)
    const b = bracket.body as {
      groups: Array<{ players: unknown[]; standings: Array<{ player: { id: string } }> }>
      group: Array<{ match: { player1: { name: string }; player2: { name: string } } }>
      main: unknown[]
    }
    expect(b.groups.map((g) => [g.players.length, g.standings.length])).toEqual([[4, 4], [4, 4]])
    expect(b.group).toHaveLength(12)
    expect(b.group.every((m) => m.match.player1.name && m.match.player2.name)).toBe(true)
    expect(b.main).toEqual([])

    const detail = await app.request('GET', `/api/tournaments/${tournamentId}`)
    expect(detail.status).toBe(200)
    expect((detail.body as { registrations: unknown[]; groups: unknown[] }).registrations).toHaveLength(8)
    expect((detail.body as { groups: unknown[] }).groups).toHaveLength(2)

    const unscheduled = await app.request('GET', `/api/admin/tournaments/${tournamentId}/unscheduled-matches`, { cookie: admin.cookie })
    expect(unscheduled.status).toBe(200)
    expect(unscheduled.body).toHaveLength(12)
  })

  it('refuses a second generation with 400 and leaves the rows as they were', async () => {
    const tournamentId = await adminTournament()
    for (const playerId of await seedPlayers(app, 5)) {
      await app.request('POST', `/api/admin/tournaments/${tournamentId}/register`, { cookie: admin.cookie, body: { player_id: playerId } })
    }
    expect((await app.request('POST', `/api/admin/tournaments/${tournamentId}/generate-brackets`, { cookie: admin.cookie })).status).toBe(200)
    const before = await bracketRowCounts(app, tournamentId)
    const again = await app.request('POST', `/api/admin/tournaments/${tournamentId}/generate-brackets`, { cookie: admin.cookie })
    expect(again.status).toBe(400)
    expect(await bracketRowCounts(app, tournamentId)).toEqual(before)
  })

  it('is all-or-nothing: a failure on the last insert leaves no groups, players, standings or matches behind', async () => {
    const tournamentId = await adminTournament()
    for (const playerId of await seedPlayers(app, 8)) {
      await app.request('POST', `/api/admin/tournaments/${tournamentId}/register`, { cookie: admin.cookie, body: { player_id: playerId } })
    }
    // Make the tournament_matches insert (the last write of a generation) fail for this tournament only
    await app.client.exec(`
      create or replace function fail_tm_insert() returns trigger language plpgsql as $$
      begin
        if new.tournament_id = '${tournamentId}' then raise exception 'injected failure'; end if;
        return new;
      end $$;
      create trigger fail_tm_insert before insert on tournament_matches for each row execute function fail_tm_insert();
    `)
    try {
      const res = await app.request('POST', `/api/admin/tournaments/${tournamentId}/generate-brackets`, { cookie: admin.cookie })
      expect(res.status).toBe(500)
      expect(await bracketRowCounts(app, tournamentId)).toEqual({
        tournament_groups: 0,
        tournament_group_players: 0,
        tournament_standings: 0,
        tournament_matches: 0,
        matches: 0,
      })
    } finally {
      await app.client.exec(`drop trigger fail_tm_insert on tournament_matches; drop function fail_tm_insert();`)
    }
    // And it works once the failure is gone
    const retry = await app.request('POST', `/api/admin/tournaments/${tournamentId}/generate-brackets`, { cookie: admin.cookie })
    expect(retry.status).toBe(200)
  })
})

describe('organizer flow', () => {
  let tournamentId: string
  let playerIds: string[]

  beforeAll(async () => {
    tournamentId = await organizerTournament(organizer)
    playerIds = await seedPlayers(app, 8)
    for (const playerId of playerIds) {
      const res = await app.request('POST', `/api/organizer/tournaments/${tournamentId}/register`, {
        cookie: organizer.cookie,
        body: { player_id: playerId },
      })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
    }
  })

  it('generates the group stage for an owned tournament and moves it to group_stage', async () => {
    const gen = await app.request('POST', `/api/organizer/tournaments/${tournamentId}/generate-brackets`, { cookie: organizer.cookie })
    expect(gen.status, JSON.stringify(gen.body)).toBe(200)
    expect(gen.body).toMatchObject({ groups: 2, groupMatches: 12 })
    expect(await assertGroupStage(app, tournamentId, playerIds, 4)).toEqual([])
    const [t] = await rows<{ current_phase: string }>(app, `select current_phase from tournaments where id = $1`, [tournamentId])
    expect(t.current_phase).toBe('group_stage')

    const detail = await app.request('GET', `/api/organizer/tournaments/${tournamentId}`, { cookie: organizer.cookie })
    expect(detail.status).toBe(200)
    const regs = (detail.body as { registrations: Array<{ player: { email: string | null } }> }).registrations
    expect(regs).toHaveLength(8)
    expect(regs.every((r) => r.player.email?.endsWith('@tenis.ec'))).toBe(true)
  })

  it('advances to playoffs once every group match is played: main and backdraw brackets in one step', async () => {
    const early = await app.request('POST', `/api/organizer/tournaments/${tournamentId}/advance-phase`, { cookie: organizer.cookie })
    expect(early.status).toBe(400)

    // Player 1 of every group match wins 6-3 6-2
    await app.client.query(
      `update matches set status = 'completed', winner_id = player1_id, score = '6-3, 6-2', played_at = now()
        where tournament_id = $1`,
      [tournamentId],
    )
    const status = await app.request('GET', `/api/organizer/tournaments/${tournamentId}/phase-status`, { cookie: organizer.cookie })
    expect(status.body).toMatchObject({ currentPhase: 'group_stage', canAdvanceToPlayoffs: true })

    const adv = await app.request('POST', `/api/organizer/tournaments/${tournamentId}/advance-phase`, { cookie: organizer.cookie })
    expect(adv.status, JSON.stringify(adv.body)).toBe(200)
    expect(adv.body).toMatchObject({ newPhase: 'playoffs' })

    const playoff = await rows<{ bracket_type: string; n: number }>(
      app,
      `select bracket_type, count(*)::int as n from tournament_matches
        where tournament_id = $1 and bracket_type <> 'group' group by bracket_type order by bracket_type`,
      [tournamentId],
    )
    expect(playoff).toEqual([{ bracket_type: 'backdraw', n: 2 }, { bracket_type: 'main', n: 2 }])

    // Standings were persisted from the results: 6 matches per group, 3 points a win
    const totals = await rows<{ wins: number; losses: number; points: number }>(
      app,
      `select sum(wins)::int as wins, sum(losses)::int as losses, sum(points)::int as points
         from tournament_standings where tournament_id = $1 group by group_id`,
      [tournamentId],
    )
    expect(totals).toEqual([{ wins: 6, losses: 6, points: 18 }, { wins: 6, losses: 6, points: 18 }])
  })

  describe('IDOR: organizer/tournaments/[id]/... on a tournament another organizer owns', () => {
    // [label, method, path, body built from a player the attacker tries to register]
    const cases: Array<[string, string, (id: string) => string, ((playerId: string) => unknown)?]> = [
      ['GET [id]', 'GET', (id) => `/api/organizer/tournaments/${id}`],
      ['PUT [id]', 'PUT', (id) => `/api/organizer/tournaments/${id}`, () => ({ name: 'Robado' })],
      ['DELETE [id]', 'DELETE', (id) => `/api/organizer/tournaments/${id}`],
      ['POST register', 'POST', (id) => `/api/organizer/tournaments/${id}/register`, (playerId) => ({ player_id: playerId })],
      ['POST generate-brackets', 'POST', (id) => `/api/organizer/tournaments/${id}/generate-brackets`],
      ['POST generate-playoffs', 'POST', (id) => `/api/organizer/tournaments/${id}/generate-playoffs`],
      ['POST advance-phase', 'POST', (id) => `/api/organizer/tournaments/${id}/advance-phase`],
      ['PUT group-deadline', 'PUT', (id) => `/api/organizer/tournaments/${id}/group-deadline`, () => ({ deadline: '2026-12-24T00:00:00Z' })],
      ['PUT playoff-deadline', 'PUT', (id) => `/api/organizer/tournaments/${id}/playoff-deadline`, () => ({ bracket_type: 'main', rounds: [{ round_number: 1, round_name: 'Final', deadline: '2026-12-24T00:00:00Z' }] })],
      ['POST recalculate-standings', 'POST', (id) => `/api/organizer/tournaments/${id}/recalculate-standings`],
      ['POST update-bracket', 'POST', (id) => `/api/organizer/tournaments/${id}/update-bracket`, () => ({})],
      ['GET phase-status', 'GET', (id) => `/api/organizer/tournaments/${id}/phase-status`],
      ['GET unscheduled-matches', 'GET', (id) => `/api/organizer/tournaments/${id}/unscheduled-matches`],
      ['GET players.search', 'GET', (id) => `/api/organizer/tournaments/${id}/players.search?q=Jugador`],
    ]

    it.each(cases)('%s → 403 and nothing changes', async (_, method, path, body) => {
      const victimTournament = await organizerTournament(organizer)
      const [victimPlayer] = await seedPlayers(app, 1)
      const payload = body?.(victimPlayer)
      const before = await rows(app, `select name, current_phase from tournaments where id = $1`, [victimTournament])

      const res = await app.request(method, path(victimTournament), { cookie: otherOrganizer.cookie, body: payload })
      expect(res.status, JSON.stringify(res.body)).toBe(403)

      expect(await rows(app, `select name, current_phase from tournaments where id = $1`, [victimTournament])).toEqual(before)
      expect(await rows(app, `select id from tournament_registrations where tournament_id = $1`, [victimTournament])).toEqual([])
      expect(await rows(app, `select id from tournament_rounds where tournament_id = $1`, [victimTournament])).toEqual([])
    })

    it('the same organizer does reach their own tournament through those routes (control)', async () => {
      const own = await organizerTournament(otherOrganizer)
      const res = await app.request('GET', `/api/organizer/tournaments/${own}`, { cookie: otherOrganizer.cookie })
      expect(res.status).toBe(200)
    })
  })
})

describe('self-registration: tournaments/[id]/register.post.ts', () => {
  it('IDOR: tournaments/[id]/register.post.ts registers the session player, never the player_id in the body', async () => {
    const tournamentId = await adminTournament()
    const attacker = await signUpPlayer(app, 'atacante@tenis.ec')
    const victim = await signUpPlayer(app, 'victima.registro@tenis.ec')

    const res = await app.request('POST', `/api/tournaments/${tournamentId}/register`, {
      cookie: attacker.cookie,
      body: { player_id: victim.playerId, playerId: victim.playerId },
    })
    expect(res.status, JSON.stringify(res.body)).toBe(200)

    const registered = await rows<{ player_id: string }>(
      app,
      `select player_id from tournament_registrations where tournament_id = $1`,
      [tournamentId],
    )
    expect(registered).toEqual([{ player_id: attacker.playerId }])
  })

  it('a player cannot register twice: the second request is 400 and one row remains', async () => {
    const tournamentId = await adminTournament()
    const p = await signUpPlayer(app, 'dos.veces@tenis.ec')
    expect((await app.request('POST', `/api/tournaments/${tournamentId}/register`, { cookie: p.cookie, body: {} })).status).toBe(200)
    const again = await app.request('POST', `/api/tournaments/${tournamentId}/register`, { cookie: p.cookie, body: { waitlist: true } })
    expect(again.status).toBe(400)
    const regs = await rows(app, `select id from tournament_registrations where tournament_id = $1`, [tournamentId])
    expect(regs).toHaveLength(1)
  })
})

describe('delete', () => {
  async function tournamentWithBracketMatches(tournamentId: string) {
    const [a, b, c] = await seedPlayers(app, 3)
    // A played match (both players) and an unplayed next-round match waiting for its second player
    const [played] = await rows<{ id: string }>(
      app,
      `insert into matches (player1_id, player2_id, winner_id, tournament_id, status, score, played_at)
       values ($1, $2, $1, $3, 'completed', '6-1, 6-1', now()) returning id`,
      [a, b, tournamentId],
    )
    const [pending] = await rows<{ id: string }>(
      app,
      `insert into matches (player1_id, tournament_id, status) values ($1, $2, 'scheduled') returning id`,
      [c, tournamentId],
    )
    await app.client.query(
      `insert into tournament_matches (tournament_id, match_id, bracket_type, round_number, bracket_position)
       values ($1, $2, 'main', 1, '1'), ($1, $3, 'main', 2, '1')`,
      [tournamentId, played.id, pending.id],
    )
    return { played: played.id, pending: pending.id }
  }

  it('an admin deletes a tournament with an unplayed single-player bracket match; the played match survives unlinked', async () => {
    const tournamentId = await adminTournament()
    const { played, pending } = await tournamentWithBracketMatches(tournamentId)

    const res = await app.request('DELETE', `/api/admin/tournaments/${tournamentId}`, { cookie: admin.cookie })
    expect(res.status, JSON.stringify(res.body)).toBe(200)

    expect(await rows(app, `select id from tournaments where id = $1`, [tournamentId])).toEqual([])
    expect(await rows(app, `select id from matches where id = $1`, [pending])).toEqual([])
    expect(await rows(app, `select tournament_id, status from matches where id = $1`, [played])).toEqual([
      { tournament_id: null, status: 'completed' },
    ])
  })

  it('an organizer deletes their own tournament with an unplayed single-player bracket match', async () => {
    const tournamentId = await organizerTournament(organizer)
    const { pending } = await tournamentWithBracketMatches(tournamentId)
    const res = await app.request('DELETE', `/api/organizer/tournaments/${tournamentId}`, { cookie: organizer.cookie })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(await rows(app, `select id from matches where id = $1`, [pending])).toEqual([])
  })

  it('deleting a tournament that does not exist is 404', async () => {
    const res = await app.request('DELETE', '/api/admin/tournaments/00000000-0000-4000-8000-00000000abcd', { cookie: admin.cookie })
    expect(res.status).toBe(404)
  })
})
