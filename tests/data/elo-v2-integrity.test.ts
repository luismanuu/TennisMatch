// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { startTestApp, type TestApp } from '../security/harness'
import { rateMatch } from '../../server/utils/elo'
import { calculateGroupStandings } from '../../server/utils/tournament-brackets'
import { activeMatch, approve, createCategory, createPlayer, playerRow, put, type Account } from './matches-helpers'

// Match integrity around the rating (audit S1-S6, B2-B4, B6, B9): parsed scores, versioned approval, the status
// whitelist, and one rating per match. Every case goes through the real API over PGlite.

let app: TestApp
let categoryId: string

beforeAll(async () => {
  app = await startTestApp()
  categoryId = await createCategory(app, 1500)
}, 120_000)

afterAll(async () => {
  await app?.close()
})

async function history(matchId: string) {
  const { rows } = await app.client.query<{ player_id: string; elo_change: number; rating_reversed: boolean }>(
    `select player_id, elo_change, rating_reversed from rating_history where match_id = $1`,
    [matchId],
  )
  return rows
}

async function matchRow(matchId: string) {
  const { rows } = await app.client.query<{ status: string; score: string | null; winner_id: string | null }>(
    `select status, score, winner_id from matches where id = $1`,
    [matchId],
  )
  return rows[0]
}

const pairOf = async (label: string) => [await createPlayer(app, categoryId, label), await createPlayer(app, categoryId, label)] as const

describe('score validation on propose_score (S5)', () => {
  it.each([
    ['banana', 'p1'],
    ['7-7 6-3', 'p1'],
    ['6-5 6-3', 'p1'],
    ['6-0 6-0', 'p2'], // player 1 took every game, player 2 named as winner
  ])('%j with winner %s is a 400 and stores nothing', async (score, winnerSide) => {
    const [a, b] = await pairOf('marcador')
    const matchId = await activeMatch(app, a, b)
    const winner = winnerSide === 'p1' ? a : b
    const res = await put(app, a, matchId, 'propose_score', { score, winner_id: winner.playerId })
    expect(res.status).toBe(400)
    expect(await matchRow(matchId)).toMatchObject({ status: 'active', score: null, winner_id: null })
  })

  it('stores the canonical text: "6-4, 3-6, 7-6 (7-5)" is saved as "6-4 3-6 7-6(5)"', async () => {
    const [a, b] = await pairOf('canon')
    const matchId = await activeMatch(app, a, b)
    expect((await put(app, a, matchId, 'propose_score', { score: '6-4, 3-6, 7-6 (7-5)', winner_id: a.playerId })).status).toBe(200)
    expect((await matchRow(matchId)).score).toBe('6-4 3-6 7-6(5)')
  })

  it('a retirement names its winner: "6-4 2-1 ret." can be won by either player', async () => {
    const [a, b] = await pairOf('retiro')
    const matchId = await activeMatch(app, a, b)
    expect((await put(app, a, matchId, 'propose_score', { score: '6-4 2-1 ret', winner_id: b.playerId })).status).toBe(200)
    expect((await approve(app, b, matchId)).status).toBe(200)
    const rows = await history(matchId)
    expect(rows.find((r) => r.player_id === b.playerId)!.elo_change).toBeGreaterThan(0)
  })
})

describe('approve carries the proposal it saw (S4)', () => {
  it('re-proposing after the opponent loaded the page: the stale approval is a 409 and nothing is rated', async () => {
    const [a, b] = await pairOf('version')
    const matchId = await activeMatch(app, a, b)
    await put(app, a, matchId, 'propose_score', { score: '6-4 6-4', winner_id: a.playerId })
    const { rows } = await app.client.query<{ score_proposed_at: Date }>(`select score_proposed_at from matches where id = $1`, [matchId])
    const seen = { score: '6-4 6-4', winner_id: a.playerId, score_proposed_at: new Date(rows[0].score_proposed_at).toISOString() }

    await new Promise((r) => setTimeout(r, 5))
    await put(app, a, matchId, 'propose_score', { score: '6-0 6-0', winner_id: a.playerId })
    const stale = await put(app, b, matchId, 'approve_score', seen)
    expect(stale.status).toBe(409)
    expect((await matchRow(matchId)).status).toBe('active')
    expect(await history(matchId)).toHaveLength(0)

    // The opponent's notification shows the proposal that is on the table now
    const { rows: notes } = await app.client.query<{ metadata: { score: string } }>(
      `select metadata from notifications where player_id = $1 and match_id = $2 and type = 'score_proposal' and not is_dismissed`,
      [b.playerId, matchId],
    )
    expect(notes.map((n) => n.metadata.score)).toEqual(['6-0 6-0'])

    expect((await approve(app, b, matchId)).status).toBe(200)
    expect((await matchRow(matchId)).score).toBe('6-0 6-0')
  })

  it('an approval without the proposal it saw is a 400', async () => {
    const [a, b] = await pairOf('sinversion')
    const matchId = await activeMatch(app, a, b)
    await put(app, a, matchId, 'propose_score', { score: '6-4 6-4', winner_id: a.playerId })
    expect((await put(app, b, matchId, 'approve_score')).status).toBe(400)
    expect((await matchRow(matchId)).status).toBe('active')
  })
})

describe('one rating per match (S6)', () => {
  it('two approvals at the same time: one 200, one non-200, one pair of rating rows', async () => {
    const [a, b] = await pairOf('doble')
    const matchId = await activeMatch(app, a, b)
    await put(app, a, matchId, 'propose_score', { score: '6-3 6-3', winner_id: a.playerId })
    const before = await playerRow(app, a.playerId)
    const results = await Promise.all([approve(app, b, matchId), approve(app, b, matchId)])
    expect(results.filter((r) => r.status === 200)).toHaveLength(1)
    expect(await history(matchId)).toHaveLength(2)
    expect((await playerRow(app, a.playerId)).total_matches_played).toBe(before.total_matches_played + 1)
  })

  // The interleaving the test above cannot force (PGlite runs one query at a time): the second approval has read the
  // match as active, with the same proposal, and the first approval commits before the second writes. Only the
  // conditional write stops it.
  it('an approval that read the match before another approval committed is a 409 and rates nothing', async () => {
    const [a, b] = await pairOf('carrera')
    const matchId = await activeMatch(app, a, b)
    await put(app, a, matchId, 'propose_score', { score: '6-3 6-3', winner_id: a.playerId })
    const before = await playerRow(app, a.playerId)
    const queries = app.db.query.matches
    const findFirst = queries.findFirst.bind(queries)
    let interleaved: Awaited<ReturnType<typeof approve>> | null = null
    const spy = vi.spyOn(queries, 'findFirst').mockImplementation(((config: Parameters<typeof findFirst>[0]) => {
      const read = findFirst(config)
      if (interleaved !== null) return read
      return (async () => {
        const row = await read
        spy.mockRestore()
        interleaved = await approve(app, b, matchId)
        return row
      })() as unknown as ReturnType<typeof findFirst>
    }) as typeof queries.findFirst)
    let late: Awaited<ReturnType<typeof approve>>
    try {
      late = await approve(app, b, matchId)
    } finally {
      spy.mockRestore()
    }
    expect(interleaved!.status).toBe(200)
    expect(late.status).toBe(409)
    expect(await history(matchId)).toHaveLength(2)
    expect((await playerRow(app, a.playerId)).total_matches_played).toBe(before.total_matches_played + 1)
  })

  it('a second approval after completion changes nothing', async () => {
    const [a, b] = await pairOf('segunda')
    const matchId = await activeMatch(app, a, b)
    await put(app, a, matchId, 'propose_score', { score: '6-3 6-3', winner_id: a.playerId })
    expect((await approve(app, b, matchId)).status).toBe(200)
    const after = [await playerRow(app, a.playerId), await playerRow(app, b.playerId)]
    expect((await approve(app, b, matchId)).status).toBe(400)
    expect([await playerRow(app, a.playerId), await playerRow(app, b.playerId)]).toEqual(after)
    expect(await history(matchId)).toHaveLength(2)
  })
})

describe('status whitelist (S1-S3)', () => {
  it('S1: update_status cannot cancel an active match', async () => {
    const [a, b] = await pairOf('cancela')
    const matchId = await activeMatch(app, a, b)
    expect((await put(app, a, matchId, 'update_status', { status: 'cancelled' })).status).toBe(400)
    expect((await matchRow(matchId)).status).toBe('active')
  })

  it('S2: update_status cannot move an active match back to scheduled', async () => {
    const [a, b] = await pairOf('atras')
    const matchId = await activeMatch(app, a, b)
    expect((await put(app, a, matchId, 'update_status', { status: 'scheduled' })).status).toBe(400)
    expect((await matchRow(matchId)).status).toBe('active')
  })

  it('S1: a player cannot cancel a scheduled tournament match, through cancel or update_status', async () => {
    const [a, b] = await pairOf('torneo')
    const { rows: t } = await app.client.query<{ id: string }>(
      `insert into tournaments (name, start_date, tournament_type, created_by) values ('Copa prueba', now(), 'round_robin', $1) returning id`,
      [a.playerId],
    )
    const { rows: m } = await app.client.query<{ id: string }>(
      `insert into matches (player1_id, player2_id, tournament_id, status, match_accepted_by) values ($1, $2, $3, 'scheduled', $2) returning id`,
      [a.playerId, b.playerId, t[0].id],
    )
    expect((await put(app, a, m[0].id, 'cancel')).status).toBe(403)
    expect((await put(app, a, m[0].id, 'update_status', { status: 'cancelled' })).status).toBe(400)
    expect((await matchRow(m[0].id)).status).toBe('scheduled')
  })

  it('S3: an organizer result cannot complete a cancelled match', async () => {
    const [a, b] = await pairOf('cancelado')
    const created = await app.request('POST', '/api/matches', {
      cookie: a.cookie,
      body: { player1_id: a.playerId, player2_id: b.playerId, scheduled_at: '2099-06-15T18:30', is_competitive: true },
    })
    const matchId = (created.body as { id: string }).id
    expect((await put(app, a, matchId, 'cancel')).status).toBe(200)
    const staff = await createPlayer(app, categoryId, 'staff')
    await app.setRole(staff.userId, 'admin')
    const res = await put(app, staff, matchId, 'organizer_set_result', { winner_id: a.playerId, score: '6-0 6-0' })
    expect(res.status).toBe(400)
    expect(await matchRow(matchId)).toMatchObject({ status: 'cancelled', winner_id: null })
    expect(await history(matchId)).toHaveLength(0)
  })

  it('B10: an organizer walkover (checkbox or typed "w/o") completes the match without rating it', async () => {
    const staff = await createPlayer(app, categoryId, 'staff')
    await app.setRole(staff.userId, 'admin')
    for (const data of [{ is_wo: true }, { score: 'w/o' }]) {
      const [a, b] = await pairOf('wo')
      const matchId = await activeMatch(app, a, b)
      const before = await playerRow(app, a.playerId)
      const res = await put(app, staff, matchId, 'organizer_set_result', { winner_id: a.playerId, ...data })
      expect(res.status).toBe(200)
      expect(await matchRow(matchId)).toMatchObject({ status: 'completed', score: 'W/O' })
      expect(await history(matchId)).toHaveLength(0)
      expect(await playerRow(app, a.playerId)).toEqual(before)
      const view = await app.request('GET', `/api/matches/${matchId}/rating-history`, { cookie: a.cookie })
      expect(view.body).toMatchObject({ rating_history: null, not_rated: 'walkover' })
    }
  })
})

describe('the rating reads only SR and experience (B2, B3, B4, B6, B9)', () => {
  it('streaks, MMR and uncertainty do not change the delta; an admin-set SR is the SR used', async () => {
    const [a, b] = await pairOf('entradas')
    // B9: an unrated player whose SR an admin set to 2000 in a category whose default is 1500
    await app.client.query(`update players set elo = 2000, win_streak = 2, mmr = 3, mmr_uncertainty = 0.5 where id = $1`, [a.playerId])
    await app.client.query(`update players set mmr = -2 where id = $1`, [b.playerId])
    const matchId = await activeMatch(app, a, b)
    await put(app, a, matchId, 'propose_score', { score: '6-3 3-6 6-4', winner_id: a.playerId })

    // B6: no network call on the approval, even with an OpenRouter key configured
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const g = globalThis as { useRuntimeConfig?: () => unknown }
    const realConfig = g.useRuntimeConfig
    g.useRuntimeConfig = () => ({ public: {}, openRouterApiKey: 'test-key-never-sent-anywhere' })
    try {
      expect((await approve(app, b, matchId)).status).toBe(200)
    } finally {
      g.useRuntimeConfig = realConfig
    }
    const external = fetchSpy.mock.calls
      .map(([input]) => new URL(input instanceof Request ? input.url : String(input)).hostname)
      .filter((host) => host !== '127.0.0.1' && host !== 'localhost')
    fetchSpy.mockRestore()
    expect(external).toEqual([])

    const expected = rateMatch(
      { rating: 2000, ratedMatches: 0 },
      { rating: 1500, ratedMatches: 0 },
      { completion: 'completed', sets: 'deciding', source: 'parser' },
    )
    const { rows } = await app.client.query<{ player_id: string; elo_before: number; elo_change: number }>(
      `select player_id, elo_before, elo_change from rating_history where match_id = $1`,
      [matchId],
    )
    expect(rows.find((r) => r.player_id === a.playerId)).toMatchObject({ elo_before: 2000, elo_change: expected.winner.delta })
    expect(rows.find((r) => r.player_id === b.playerId)).toMatchObject({ elo_before: 1500, elo_change: expected.loser.delta })
  })
})

// Review findings on the canonical score text and the status whitelist
describe('regressions from review', () => {
  it('group standings read "7-6(5) 6-4" as 13-10 in games, not 69 lost games', () => {
    const standings = calculateGroupStandings('g', [{ player1_id: 'a', player2_id: 'b', winner_id: 'a', score: '7-6(5) 6-4' }])
    expect(standings.get('a')).toMatchObject({ games_won: 13, games_lost: 10, game_difference: 3 })
    expect(standings.get('b')).toMatchObject({ games_won: 10, games_lost: 13, game_difference: -3 })
  })

  it('an admin can cancel an abandoned active match; a player still cannot', async () => {
    const [a, b] = await pairOf('lluvia')
    const matchId = await activeMatch(app, a, b)
    expect((await put(app, a, matchId, 'cancel')).status).toBe(400)
    const staff = await createPlayer(app, categoryId, 'staff')
    await app.setRole(staff.userId, 'admin')
    expect((await put(app, staff, matchId, 'cancel')).status).toBe(200)
    expect(await matchRow(matchId)).toMatchObject({ status: 'cancelled', winner_id: null })
    expect(await history(matchId)).toHaveLength(0)
  })
})

// Round 2 (review of #54): a player-proposed walkover completed the match unrated, so two players could agree to
// dodge the rating (or an opponent could tap "Aprobar" without reading). Walkovers only come from organizer/admin.
describe('round 2: players cannot propose an unrated result', () => {
  it.each([['W/O'], ['wo'], ['Walkover'], ['6-4 3-3 abd.']])('propose_score %j is a 400 and stores nothing', async (score) => {
    const [a, b] = await pairOf('esquiva')
    const matchId = await activeMatch(app, a, b)
    const res = await put(app, a, matchId, 'propose_score', { score, winner_id: a.playerId })
    expect(res.status).toBe(400)
    expect(await matchRow(matchId)).toMatchObject({ status: 'active', score: null, winner_id: null })
  })

  it('a retirement is still a player result (and it is rated)', async () => {
    const [a, b] = await pairOf('retira')
    const matchId = await activeMatch(app, a, b)
    expect((await put(app, a, matchId, 'propose_score', { score: '6-4 2-1 ret.', winner_id: a.playerId })).status).toBe(200)
    expect((await approve(app, b, matchId)).status).toBe(200)
    expect(await history(matchId)).toHaveLength(2)
  })

  it('calculate-elo rates a completed match that has no rating yet', async () => {
    const [a, b] = await pairOf('sinrating')
    const { rows } = await app.client.query<{ id: string }>(
      `insert into matches (player1_id, player2_id, winner_id, status, score, is_competitive, played_at)
       values ($1, $2, $1, 'completed', '6-3 6-4', true, now()) returning id`,
      [a.playerId, b.playerId],
    )
    const admin = await app.signUp(`admin-calc-${Date.now()}@tenis.ec`, 'admin')
    const res = await app.request('POST', `/api/matches/${rows[0].id}/calculate-elo`, { cookie: admin.cookie })
    expect(res.status).toBe(200)
    const expected = rateMatch({ rating: 1500, ratedMatches: 0 }, { rating: 1500, ratedMatches: 0 }, { completion: 'completed', sets: 'straight', source: 'parser' })
    expect(res.body).toMatchObject({ success: true, result: { player1: { eloChange: expected.winner.delta }, player2: { eloChange: expected.loser.delta } } })
    expect(await history(rows[0].id)).toHaveLength(2)
  })
})

describe('pro set through the API (CEO 14:29Z)', () => {
  it('"9-8 (7-4)" is stored as "9-8(4)" and rated as a pro set; "8-7" and a mismatched winner are refused', async () => {
    const [a, b] = await pairOf('proset')
    const matchId = await activeMatch(app, a, b)
    expect((await put(app, a, matchId, 'propose_score', { score: '8-7', winner_id: a.playerId })).status).toBe(400)
    expect((await put(app, a, matchId, 'propose_score', { score: '9-8(4)', winner_id: b.playerId })).status).toBe(400)
    expect((await put(app, a, matchId, 'propose_score', { score: '9-8 (7-4)', winner_id: a.playerId })).status).toBe(200)
    expect((await matchRow(matchId)).score).toBe('9-8(4)')
    expect((await approve(app, b, matchId)).status).toBe(200)
    const view = await app.request('GET', `/api/matches/${matchId}/rating-history`, { cookie: a.cookie })
    expect(view.body).toMatchObject({ rating_history: { player1: { why: { margin: 0.9, classification: { sets: 'pro' } } } } })
  })
})
