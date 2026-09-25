// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { startTestApp, type TestApp } from '../security/harness'
import { getDefaultEloCalculation } from '../../server/utils/llm-score-resolver'
import { activeMatch, createCategory, createPlayer, playerRow, put, type Account } from './matches-helpers'

// The LLM call (up to 3 attempts with sleeps) must not run while the rating transaction holds its FOR UPDATE locks
// on the match and both players. No live call ever: OpenRouter is answered in-process.
//
// Probe: PGlite runs one transaction at a time and queues every other query behind it, so a query from outside
// that cannot run within 300 ms means a transaction is open at that moment.

let app: TestApp
let categoryId: string

beforeAll(async () => {
  app = await startTestApp()
  categoryId = await createCategory(app, 1500)
}, 120_000)

afterAll(async () => {
  await app?.close()
})

async function transactionOpen(): Promise<boolean> {
  return Promise.race([
    app.client.query('select 1').then(() => false),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 300)),
  ])
}

const LLM_CHANGE = 17

// Installs an OpenRouter answer (player 1 gains LLM_CHANGE) and a key, runs `fn`, and restores both.
// `onCall` runs inside each OpenRouter request, while the rating code is waiting on the LLM.
async function withLlm<T>(onCall: () => Promise<void>, fn: () => Promise<T>): Promise<T> {
  const realFetch = globalThis.fetch
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!url.startsWith('https://openrouter.ai/')) return realFetch(input, init)
    await onCall()
    const content = JSON.stringify({
      player1_elo_change: LLM_CHANGE,
      player2_elo_change: -LLM_CHANGE,
      match_rating: 1500,
      match_weight: 1,
      format_detected: 'best_of_3',
      games_won_p1: 12,
      games_lost_p1: 7,
      total_games: 19,
      reasoning: 'Partido parejo.',
    })
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 })
  })
  const g = globalThis as { useRuntimeConfig?: () => unknown }
  const realConfig = g.useRuntimeConfig
  g.useRuntimeConfig = () => ({ public: {}, openRouterApiKey: 'test-key-never-sent-anywhere' })
  try {
    return await fn()
  } finally {
    g.useRuntimeConfig = realConfig
    fetchSpy.mockRestore()
  }
}

async function matchRow(matchId: string) {
  const { rows } = await app.client.query<{
    llm_elo_calculated: boolean | null
    llm_calculation_failed: boolean | null
    llm_calculation_reasoning: string | null
  }>(`select llm_elo_calculated, llm_calculation_failed, llm_calculation_reasoning from matches where id = $1`, [matchId])
  return rows[0]
}

async function liveHistory(matchId: string, playerId: string) {
  const { rows } = await app.client.query<{ elo_before: number; elo_after: number; elo_change: number }>(
    `select elo_before, elo_after, elo_change from rating_history where match_id = $1 and player_id = $2 and rating_reversed = false`,
    [matchId, playerId],
  )
  return rows
}

// A rated player: past placement, with the given ELO
async function rated(label: string, elo: number): Promise<Account> {
  const p = await createPlayer(app, categoryId, label)
  await app.client.query(
    `update players set elo = $2, total_matches_played = 5, placement_matches_completed = 3 where id = $1`,
    [p.playerId, elo],
  )
  return p
}

describe('the LLM runs outside the rating transaction', () => {
  it('approve_score: the LLM is called with no transaction open, and its answer is written', async () => {
    const a = await rated('lucia', 1600)
    const b = await rated('mario', 1450)
    const matchId = await activeMatch(app, a, b)
    expect((await put(app, a, matchId, 'propose_score', { score: '6-4 6-3', winner_id: a.playerId })).status).toBe(200)

    const probes: boolean[] = []
    await withLlm(
      async () => {
        probes.push(await transactionOpen())
      },
      async () => expect((await put(app, b, matchId, 'approve_score')).status).toBe(200),
    )

    expect(probes).toEqual([false])
    expect(await matchRow(matchId)).toMatchObject({ llm_elo_calculated: true, llm_calculation_failed: false })
    expect(await liveHistory(matchId, a.playerId)).toEqual([{ elo_before: 1600, elo_after: 1600 + LLM_CHANGE, elo_change: LLM_CHANGE }])
    expect(await liveHistory(matchId, b.playerId)).toEqual([{ elo_before: 1450, elo_after: 1450 - LLM_CHANGE, elo_change: -LLM_CHANGE }])
  }, 30_000)

  // Decision: when a player's rating changed while the LLM was answering (their other match was rated meanwhile),
  // the LLM answer was computed for ratings that no longer exist. It is dropped, the match is rated with the
  // deterministic fallback from the fresh ratings, and it is flagged llm_calculation_failed so the
  // reprocess-fallback queue can rate it with the LLM later. No second LLM call inside the request.
  it('ratings changed while the LLM was answering: the fresh ratings are rated with the fallback and the match is flagged for reprocess', async () => {
    const a = await rated('nora', 1600)
    const b = await rated('oscar', 1450)
    const matchId = await activeMatch(app, a, b)
    expect((await put(app, a, matchId, 'propose_score', { score: '6-4 6-3', winner_id: a.playerId })).status).toBe(200)

    const probes: boolean[] = []
    await withLlm(
      async () => {
        const open = await transactionOpen()
        probes.push(open)
        // Oscar's other match is rated meanwhile (only possible when no transaction holds his row)
        if (!open) await app.client.query(`update players set elo = elo + 40 where id = $1`, [b.playerId])
      },
      async () => expect((await put(app, b, matchId, 'approve_score')).status).toBe(200),
    )

    expect(probes).toEqual([false])
    const match = await matchRow(matchId)
    expect(match.llm_elo_calculated).toBe(false)
    expect(match.llm_calculation_failed).toBe(true)
    expect(match.llm_calculation_reasoning).toMatch(/changed while the LLM was calculating/)
    const expected = getDefaultEloCalculation(1600, 1490, a.playerId, a.playerId)
    expect(await liveHistory(matchId, a.playerId)).toEqual([
      { elo_before: 1600, elo_after: 1600 + expected.player1EloChange, elo_change: expected.player1EloChange },
    ])
    expect(await liveHistory(matchId, b.playerId)).toEqual([
      { elo_before: 1490, elo_after: 1490 + expected.player2EloChange, elo_change: expected.player2EloChange },
    ])
    expect((await playerRow(app, b.playerId)).elo).toBe(1490 + expected.player2EloChange)
  }, 30_000)

  it('admin recalculate: the LLM is called with no transaction open, and its answer replaces the old rating', async () => {
    const a = await rated('paula', 1600)
    const b = await rated('quique', 1450)
    const matchId = await activeMatch(app, a, b)
    expect((await put(app, a, matchId, 'propose_score', { score: '6-4 6-3', winner_id: a.playerId })).status).toBe(200)
    expect((await put(app, b, matchId, 'approve_score')).status).toBe(200) // rated without a key
    expect(await matchRow(matchId)).toMatchObject({ llm_elo_calculated: false })

    const admin = await app.signUp('admin.llm@tenis.ec', 'admin')
    const probes: boolean[] = []
    await withLlm(
      async () => {
        probes.push(await transactionOpen())
      },
      async () => {
        const res = await app.request('POST', '/api/admin/matches/recalculate', { cookie: admin.cookie, query: { match_id: matchId } })
        expect(res.status, JSON.stringify(res.body)).toBe(200)
        expect(res.body).toMatchObject({ success: true, result: { llm_used: true, player1_elo_change: LLM_CHANGE } })
      },
    )

    expect(probes).toEqual([false])
    expect(await matchRow(matchId)).toMatchObject({ llm_elo_calculated: true, llm_calculation_failed: false })
    expect(await liveHistory(matchId, a.playerId)).toEqual([{ elo_before: 1600, elo_after: 1600 + LLM_CHANGE, elo_change: LLM_CHANGE }])
    expect((await playerRow(app, a.playerId)).elo).toBe(1600 + LLM_CHANGE)
    expect((await playerRow(app, b.playerId)).elo).toBe(1450 - LLM_CHANGE)
  }, 30_000)
})
