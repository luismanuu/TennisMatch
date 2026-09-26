// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestApp, type TestApp } from '../security/harness'
import { approve, activeMatch, createCategory, createPlayer, playerRow, put, type Account } from './matches-helpers'

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
  const { rows } = await app.client.query<{ player_id: string; elo_before: number; elo_after: number; elo_change: number; rating_reversed: boolean }>(
    `select player_id, elo_before, elo_after, elo_change, rating_reversed from rating_history where match_id = $1`,
    [matchId],
  )
  return rows
}

async function matchRow(matchId: string) {
  const { rows } = await app.client.query<{
    status: string
    winner_id: string | null
    score_approved_by: string | null
    llm_elo_calculated: boolean | null
    llm_calculation_failed: boolean | null
    llm_calculation_reasoning: string | null
  }>(
    `select status, winner_id, score_approved_by, llm_elo_calculated, llm_calculation_failed, llm_calculation_reasoning from matches where id = $1`,
    [matchId],
  )
  return rows[0]
}

describe('full match flow through the API', () => {
  it('create → accept → propose score → approve completes the match and applies both ratings', async () => {
    const a = await createPlayer(app, categoryId, 'ana')
    const b = await createPlayer(app, categoryId, 'bruno')
    const aBefore = await playerRow(app, a.playerId)
    const bBefore = await playerRow(app, b.playerId)

    const matchId = await activeMatch(app, a, b)

    const proposed = await put(app, a, matchId, 'propose_score', { score: '6-3, 6-4', winner_id: a.playerId })
    expect(proposed.status).toBe(200)
    const { rows: pending } = await app.client.query(
      `select 1 from notifications where player_id = $1 and match_id = $2 and type = 'score_proposal' and not is_dismissed`,
      [b.playerId, matchId],
    )
    expect(pending).toHaveLength(1)

    const approved = await approve(app, b, matchId)
    expect(approved.status).toBe(200)
    const body = approved.body as { status: string; winner: { id: string } | null; player1: { id: string; category: unknown } }
    expect(body.status).toBe('completed')
    expect(body.winner?.id).toBe(a.playerId)
    expect(body.player1.id).toBe(a.playerId)

    const match = await matchRow(matchId)
    expect(match.status).toBe('completed')
    expect(match.winner_id).toBe(a.playerId)
    expect(match.score_approved_by).toBe(b.playerId)
    // No model in the rating path: the legacy LLM columns are never written
    expect(match.llm_elo_calculated).toBe(false)
    expect(match.llm_calculation_failed).toBe(false)
    expect(match.llm_calculation_reasoning).toBeNull()

    const aAfter = await playerRow(app, a.playerId)
    const bAfter = await playerRow(app, b.playerId)
    expect(aAfter.elo).toBeGreaterThan(aBefore.elo)
    expect(bAfter.elo).toBeLessThan(bBefore.elo)
    expect(aAfter.total_matches_played).toBe(aBefore.total_matches_played + 1)
    expect(bAfter.total_matches_played).toBe(bBefore.total_matches_played + 1)

    const rows = await history(matchId)
    expect(rows).toHaveLength(2)
    expect(rows.find((r) => r.player_id === a.playerId)?.elo_after).toBe(aAfter.elo)
    expect(rows.find((r) => r.player_id === b.playerId)?.elo_after).toBe(bAfter.elo)

    const { rows: stillPending } = await app.client.query(
      `select 1 from notifications where match_id = $1 and type = 'score_proposal' and not is_dismissed`,
      [matchId],
    )
    expect(stillPending).toHaveLength(0)

    // What the match page polls for
    const ratingHistory = await app.request('GET', `/api/matches/${matchId}/rating-history`, { cookie: b.cookie })
    expect(ratingHistory.status).toBe(200)
    expect(ratingHistory.body).toMatchObject({
      success: true,
      rating_history: {
        player1: { elo_after: aAfter.elo, why: { formula: 'elo-v2', opponent_before: bBefore.elo, classification: { completion: 'completed', sets: 'straight', source: 'parser' } } },
        player2: { elo_after: bAfter.elo, why: { formula: 'elo-v2', opponent_before: aBefore.elo } },
      },
    })
  })

  // B11: calculate-elo on a rated match answered success "ELO recalculated successfully" with result null
  it('rating a match twice is a no-op: admin calculate-elo on an already rated match is a 409 and changes nothing', async () => {
    const a = await createPlayer(app, categoryId)
    const b = await createPlayer(app, categoryId)
    const matchId = await activeMatch(app, a, b)
    await put(app, a, matchId, 'propose_score', { score: '1-6 1-6', winner_id: b.playerId })
    expect((await approve(app, b, matchId)).status).toBe(200)
    const aRated = await playerRow(app, a.playerId)

    const admin = await app.signUp(`admin-${Date.now()}@tenis.ec`, 'admin')
    const again = await app.request('POST', `/api/matches/${matchId}/calculate-elo`, { cookie: admin.cookie })
    expect(again.status).toBe(409)
    expect(await playerRow(app, a.playerId)).toEqual(aRated)
    expect(await history(matchId)).toHaveLength(2)
  })

  it('a friendly match completes without touching ratings', async () => {
    const a = await createPlayer(app, categoryId)
    const b = await createPlayer(app, categoryId)
    const matchId = await activeMatch(app, a, b, false)
    await put(app, a, matchId, 'propose_score', { score: '6-4 6-4', winner_id: a.playerId })
    expect((await approve(app, b, matchId)).status).toBe(200)
    expect((await matchRow(matchId)).status).toBe('completed')
    expect((await playerRow(app, a.playerId)).total_matches_played).toBe(0)
    expect(await history(matchId)).toHaveLength(0)
  })

  it('admin recalculate reverses the old rows and writes new ones in one go', async () => {
    const a = await createPlayer(app, categoryId)
    const b = await createPlayer(app, categoryId)
    const matchId = await activeMatch(app, a, b)
    await put(app, a, matchId, 'propose_score', { score: '7-5 6-7(3) 6-2', winner_id: a.playerId })
    await approve(app, b, matchId)

    const admin = await app.signUp(`admin-recalc-${Date.now()}@tenis.ec`, 'admin')
    const res = await app.request('POST', '/api/admin/matches/recalculate', { cookie: admin.cookie, query: { match_id: matchId } })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ success: true })

    const rows = await history(matchId)
    expect(rows.filter((r) => r.rating_reversed)).toHaveLength(2)
    const live = rows.filter((r) => !r.rating_reversed)
    expect(live).toHaveLength(2)
    for (const p of [a, b]) {
      const row = await playerRow(app, p.playerId)
      expect(live.find((r) => r.player_id === p.playerId)?.elo_after).toBe(row.elo)
      expect(row.total_matches_played).toBe(1)
    }
  })
})

describe('IDOR: matches/[id].put.ts', () => {
  let a: Account
  let b: Account
  let outsider: Account
  let matchId: string

  beforeAll(async () => {
    a = await createPlayer(app, categoryId, 'duena')
    b = await createPlayer(app, categoryId, 'rival')
    outsider = await createPlayer(app, categoryId, 'intruso')
    matchId = await activeMatch(app, a, b)
  })

  it('a non-participant cannot propose a score (403), even naming a participant as the winner', async () => {
    const res = await put(app, outsider, matchId, 'propose_score', { score: '6-0 6-0', winner_id: a.playerId })
    expect(res.status).toBe(403)
    expect((await matchRow(matchId)).winner_id).toBeNull()
  })

  it('a non-participant cannot approve a proposed score (403) and nothing is rated', async () => {
    expect((await put(app, a, matchId, 'propose_score', { score: '6-2 6-2', winner_id: a.playerId })).status).toBe(200)
    const res = await approve(app, outsider, matchId)
    expect(res.status).toBe(403)
    expect((await matchRow(matchId)).status).toBe('active')
    expect(await history(matchId)).toHaveLength(0)
  })

  it("A cannot approve A's own proposed score, even with B's player id in the body", async () => {
    const res = await app.request('PUT', `/api/matches/${matchId}`, {
      cookie: a.cookie,
      body: { action: 'approve_score', player_id: b.playerId, score_approved_by: b.playerId, data: { player_id: b.playerId } },
    })
    expect(res.status).toBe(400)
    const match = await matchRow(matchId)
    expect(match.status).toBe('active')
    expect(match.score_approved_by).toBeNull()
    expect((await playerRow(app, a.playerId)).total_matches_played).toBe(0)
  })
})

describe('IDOR: matches/[id].put.ts update_status', () => {
  // Found while porting: update_status took any status, so the proposer could complete the match on the
  // opponent's behalf and collect the rating without the opponent's approval.
  it('the score proposer cannot complete the match through update_status', async () => {
    const a = await createPlayer(app, categoryId, 'atajo')
    const b = await createPlayer(app, categoryId, 'burlado')
    const matchId = await activeMatch(app, a, b)
    await put(app, a, matchId, 'propose_score', { score: '6-0 6-0', winner_id: a.playerId })
    const res = await put(app, a, matchId, 'update_status', { status: 'completed' })
    expect(res.status).toBe(400)
    expect((await matchRow(matchId)).status).toBe('active')
    expect(await history(matchId)).toHaveLength(0)
    expect((await playerRow(app, a.playerId)).total_matches_played).toBe(0)
  })

  it('a completed, rated match cannot be moved to another status through update_status', async () => {
    const a = await createPlayer(app, categoryId)
    const b = await createPlayer(app, categoryId)
    const matchId = await activeMatch(app, a, b)
    await put(app, a, matchId, 'propose_score', { score: '6-4 6-4', winner_id: a.playerId })
    await approve(app, b, matchId)
    const res = await put(app, b, matchId, 'update_status', { status: 'cancelled' })
    expect(res.status).toBe(400)
    expect((await matchRow(matchId)).status).toBe('completed')
  })
})

describe('IDOR: matches/index.post.ts', () => {
  it("A's session cannot create a match as B (player1_id = B)", async () => {
    const a = await createPlayer(app, categoryId)
    const b = await createPlayer(app, categoryId)
    const c = await createPlayer(app, categoryId)
    const res = await app.request('POST', '/api/matches', {
      cookie: a.cookie,
      body: { player1_id: b.playerId, player2_id: c.playerId, scheduled_at: '2099-01-01T10:00' },
    })
    expect(res.status).toBe(403)
    const { rows } = await app.client.query(`select 1 from matches where player1_id = $1`, [b.playerId])
    expect(rows).toHaveLength(0)
  })
})

describe('IDOR: matches/[id]/messages.post.ts', () => {
  it('a non-participant cannot post in a match chat', async () => {
    const a = await createPlayer(app, categoryId)
    const b = await createPlayer(app, categoryId)
    const outsider = await createPlayer(app, categoryId)
    const matchId = await activeMatch(app, a, b)
    const res = await app.request('POST', `/api/matches/${matchId}/messages`, { cookie: outsider.cookie, body: { message: 'hola' } })
    expect(res.status).toBe(403)
    const { rows } = await app.client.query(`select 1 from match_messages where match_id = $1`, [matchId])
    expect(rows).toHaveLength(0)
  })
})

describe('rating writes are atomic', () => {
  // S8: the match was completed in one statement and rated in another, and a rating failure was swallowed, so a
  // match could stay completed and unrated. Completing and rating now commit together.
  it('a failure writing the second rating row rolls back the approval, both players and the history', async () => {
    const a = await createPlayer(app, categoryId, 'firme')
    const b = await createPlayer(app, categoryId, 'roto')
    const matchId = await activeMatch(app, a, b)
    await put(app, a, matchId, 'propose_score', { score: '6-4 6-4', winner_id: a.playerId })
    const aBefore = await playerRow(app, a.playerId)
    const bBefore = await playerRow(app, b.playerId)
    // Fault injection: the insert of B's rating_history row fails after A's player row and history row were written
    await app.client.exec(`
      create or replace function fail_for_roto() returns trigger language plpgsql as $$
      begin raise exception 'injected failure'; end $$;
      create trigger fail_for_roto before insert on rating_history
        for each row when (new.player_id = '${b.playerId}') execute function fail_for_roto();
    `)
    try {
      const approved = await approve(app, b, matchId)
      expect(approved.status).toBe(500)
    } finally {
      await app.client.exec(`drop trigger fail_for_roto on rating_history; drop function fail_for_roto();`)
    }
    expect(await playerRow(app, a.playerId)).toEqual(aBefore)
    expect(await playerRow(app, b.playerId)).toEqual(bBefore)
    expect(await history(matchId)).toHaveLength(0)
    expect((await matchRow(matchId)).status).toBe('active')

    // Nothing was lost: the same approval goes through once the fault is gone
    expect((await approve(app, b, matchId)).status).toBe(200)
    expect(await history(matchId)).toHaveLength(2)
    expect((await playerRow(app, a.playerId)).total_matches_played).toBe(aBefore.total_matches_played + 1)
  })
})

describe('regressions', () => {
  // organizer_set_result rewrote the winner and score of a completed match. The rating stayed on the old result
  // (the match was already rated, so the re-rate was skipped), so the ranking and the result disagreed.
  it('organizer_set_result on a completed, rated match is a 400 and changes nothing', async () => {
    const a = await createPlayer(app, categoryId, 'resultado')
    const b = await createPlayer(app, categoryId, 'resultado')
    const matchId = await activeMatch(app, a, b)
    await put(app, a, matchId, 'propose_score', { score: '6-3 6-4', winner_id: a.playerId })
    expect((await approve(app, b, matchId)).status).toBe(200)
    const staff = await createPlayer(app, categoryId, 'staff')
    await app.setRole(staff.userId, 'admin')
    const before = await matchRow(matchId)
    const ratingsBefore = await history(matchId)

    const res = await put(app, staff, matchId, 'organizer_set_result', { winner_id: b.playerId, score: '0-6 0-6' })

    expect(res.status).toBe(400)
    expect(JSON.stringify(res.body)).toContain('Este partido ya está completado: no puedes cambiar su resultado.')
    expect(await matchRow(matchId)).toEqual(before)
    expect(await history(matchId)).toEqual(ratingsBefore)
    const { rows } = await app.client.query<{ score: string }>(`select score from matches where id = $1`, [matchId])
    expect(rows[0].score).toBe('6-3 6-4')
  })

  // created_at is stored with microseconds but serialised with milliseconds. Polling with the last message's
  // created_at as ?since= returned that same message again (seen while porting messages.get.ts).
  it('messages.get.ts: ?since=<last message created_at> does not return the last message again', async () => {
    const a = await createPlayer(app, categoryId)
    const b = await createPlayer(app, categoryId)
    const matchId = await activeMatch(app, a, b)
    // A microsecond part that a millisecond ISO string cannot carry
    await app.client.query(
      `insert into match_messages (match_id, player_id, message, created_at) values ($1, $2, 'hola', '2026-09-25T10:00:00.123456Z')`,
      [matchId, a.playerId],
    )
    const all = await app.request('GET', `/api/matches/${matchId}/messages`, { cookie: b.cookie })
    const messages = all.body as Array<{ created_at: string }>
    expect(messages).toHaveLength(1)
    expect(messages[0].created_at).toBe('2026-09-25T10:00:00.123Z')
    const since = await app.request('GET', `/api/matches/${matchId}/messages`, { cookie: b.cookie, query: { since: messages[0].created_at } })
    expect(since.status).toBe(200)
    expect(since.body).toEqual([])
  })
})
