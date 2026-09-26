// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { startTestApp, type TestApp } from '../security/harness'
import { reverseMatchRatings } from '../../server/utils/rating-system'
import { approve, activeMatch, createCategory, createPlayer, put, type Account } from './matches-helpers'

// Admin recalculation (reverse a match's ratings, then rate it again) with no LLM key: the deterministic path.
// Oracle: recalculating a match that is both players' latest rating changes nothing, and a player's ratings after
// a recalculation equal a fresh rating of the same sequence of matches.

let app: TestApp
let admin: { cookie: string }
let lowCategory: string // default ELO 1000: every player starts below 2250 ELO, so MMR is negative
let midCategory: string

beforeAll(async () => {
  app = await startTestApp()
  lowCategory = await createCategory(app, 1000)
  midCategory = await createCategory(app, 1500)
  admin = await app.signUp('admin.recalculo@tenis.ec', 'admin')
}, 120_000)

afterAll(async () => {
  await app?.close()
})

type State = {
  elo: number
  mmr: string
  mmr_uncertainty: string
  win_streak: number
  loss_streak: number
  matches_this_month: number
  total_matches_played: number
  placement_matches_completed: number
}

async function state(playerId: string): Promise<State> {
  const { rows } = await app.client.query<State>(
    `select elo, mmr, mmr_uncertainty, win_streak, loss_streak, matches_this_month, total_matches_played,
            placement_matches_completed
       from players where id = $1`,
    [playerId],
  )
  return rows[0]
}

async function liveHistory(matchId: string) {
  const { rows } = await app.client.query<{
    player_id: string
    elo_before: number
    elo_after: number
    elo_change: number
    mmr_before: string
    mmr_after: string
    win_streak_bonus: number
    is_placement_match: boolean
  }>(
    `select player_id, elo_before, elo_after, elo_change, mmr_before, mmr_after, win_streak_bonus, is_placement_match
       from rating_history where match_id = $1 and rating_reversed = false order by player_id`,
    [matchId],
  )
  return rows
}

// player1 proposes the match; `winner` wins with `score` (player1's games first)
async function play(p1: Account, p2: Account, winner: Account, score: string): Promise<string> {
  const matchId = await activeMatch(app, p1, p2)
  expect((await put(app, p1, matchId, 'propose_score', { score, winner_id: winner.playerId })).status).toBe(200)
  expect((await approve(app, p2, matchId)).status).toBe(200)
  return matchId
}

async function recalculate(matchId: string) {
  const res = await app.request('POST', '/api/admin/matches/recalculate', { cookie: admin.cookie, query: { match_id: matchId } })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  expect(res.body).toMatchObject({ success: true })
}

// Each case signs up real accounts (password hashing) and plays matches over HTTP: fixed CPU-bound work timed by
// the wall clock. Measured for the first case: 1.65-1.80 s alone (5 runs), 2.06-2.10 s in the full suite (3 runs),
// 4.09 s with all 4 cores saturated (1 run). The 5 s default timed out once on a loaded host.
describe('recalculate: named regressions', { timeout: 30_000 }, () => {
  // reverseMatchRatings clamped MMR at 0 (so every player below 2250 ELO came back with MMR 0) and ELO at 1000.
  it('recalculating the latest match of rated players below 2250 ELO: ELO and MMR equal a fresh rating of the same sequence', async () => {
    const ana = await createPlayer(app, lowCategory, 'ana')
    const beto = await createPlayer(app, lowCategory, 'beto')
    await play(ana, beto, beto, '1-6 2-6')
    await play(ana, beto, beto, '3-6 2-6')
    await play(ana, beto, beto, '4-6 6-7(4)')
    const last = await play(ana, beto, beto, '5-7 4-6')
    const anaBefore = await state(ana.playerId)
    const betoBefore = await state(beto.playerId)
    // The case the clamps broke: ELO below 1000, MMR below 0
    expect(anaBefore.elo).toBeLessThan(1000)
    expect(Number(anaBefore.mmr)).toBeLessThan(0)
    expect(Number(betoBefore.mmr)).toBeLessThan(0)

    await recalculate(last)

    const carla = await createPlayer(app, lowCategory, 'carla')
    const dani = await createPlayer(app, lowCategory, 'dani')
    await play(carla, dani, dani, '1-6 2-6')
    await play(carla, dani, dani, '3-6 2-6')
    await play(carla, dani, dani, '4-6 6-7(4)')
    await play(carla, dani, dani, '5-7 4-6')

    const anaAfter = await state(ana.playerId)
    const betoAfter = await state(beto.playerId)
    const fresh1 = await state(carla.playerId)
    const fresh2 = await state(dani.playerId)
    expect({ elo: anaAfter.elo, mmr: anaAfter.mmr }).toEqual({ elo: fresh1.elo, mmr: fresh1.mmr })
    expect({ elo: betoAfter.elo, mmr: betoAfter.mmr }).toEqual({ elo: fresh2.elo, mmr: fresh2.mmr })
    expect(anaAfter).toEqual(anaBefore)
    expect(betoAfter).toEqual(betoBefore)
  })

  // The reversal left win_streak / loss_streak / matches_this_month as they were and the re-rate added one more,
  // so the streak grew to 4. (The +6 streak bonus it also broke no longer exists: audit B2, it created points.)
  it('recalculating a win that extended a streak of 2 keeps streak 3, no streak bonus, and the ELO', async () => {
    const eva = await createPlayer(app, midCategory, 'eva')
    const rivals = [
      await createPlayer(app, midCategory, 'rival'),
      await createPlayer(app, midCategory, 'rival'),
      await createPlayer(app, midCategory, 'rival'),
    ]
    await play(eva, rivals[0], eva, '6-3 6-3')
    await play(eva, rivals[1], eva, '6-4 6-4')
    const m = await play(eva, rivals[2], eva, '6-2 7-5')
    const before = await state(eva.playerId)
    const bonusBefore = (await liveHistory(m)).find((h) => h.player_id === eva.playerId)!
    expect(before.win_streak).toBe(3)
    expect(bonusBefore.win_streak_bonus).toBe(0)

    await recalculate(m)

    const after = await state(eva.playerId)
    const bonusAfter = (await liveHistory(m)).find((h) => h.player_id === eva.playerId)!
    expect(after.win_streak).toBe(3)
    expect(after.loss_streak).toBe(0)
    expect(after.matches_this_month).toBe(before.matches_this_month)
    expect(bonusAfter.win_streak_bonus).toBe(0)
    expect(after.elo).toBe(before.elo)
    expect(after).toEqual(before)
  })

  // A reversed entry that is not the player's latest cannot be restored from its before-values: the deltas are
  // subtracted instead, with no MMR floor at 0, no ELO floor at 1000, and uncertainty kept inside its 0.5-2.0 CHECK.
  it('reversing a non-latest entry subtracts its deltas: MMR stays negative, ELO may be below 1000, uncertainty ≤ 2.0', async () => {
    const fede = await createPlayer(app, lowCategory, 'fede')
    const gabi = await createPlayer(app, lowCategory, 'gabi')
    const hugo = await createPlayer(app, lowCategory, 'hugo')
    const m1 = await play(fede, gabi, gabi, '2-6 3-6')
    await play(fede, hugo, hugo, '4-6 4-6')
    // Monthly decay raised Fede's uncertainty back to the maximum after both matches
    await app.client.query(`update players set mmr_uncertainty = 2.0 where id = $1`, [fede.playerId])
    const fedeBefore = await state(fede.playerId)
    const gabiBefore = await state(gabi.playerId)
    const [m1Fede] = (await liveHistory(m1)).filter((h) => h.player_id === fede.playerId)
    const [m1Gabi] = (await liveHistory(m1)).filter((h) => h.player_id === gabi.playerId)

    expect(await reverseMatchRatings(m1)).toBe(2)

    const fedeAfter = await state(fede.playerId)
    expect(fedeAfter.elo).toBe(fedeBefore.elo - m1Fede.elo_change)
    expect(fedeAfter.elo).toBeLessThan(1000)
    expect(Number(fedeAfter.mmr)).toBeCloseTo(Number(fedeBefore.mmr) - (Number(m1Fede.mmr_after) - Number(m1Fede.mmr_before)), 2)
    expect(Number(fedeAfter.mmr)).toBeLessThan(0)
    expect(Number(fedeAfter.mmr_uncertainty)).toBe(2)
    expect(fedeAfter.total_matches_played).toBe(1)
    // Gabi's only match was m1: restored to exactly what she had before it
    const gabiAfter = await state(gabi.playerId)
    expect(gabiAfter.elo).toBe(m1Gabi.elo_before)
    expect(gabiAfter.mmr).toBe(m1Gabi.mmr_before)
    expect(gabiAfter).toMatchObject({ total_matches_played: 0, win_streak: 0, loss_streak: 0, matches_this_month: 0 })
    expect(gabiBefore.total_matches_played).toBe(1)
  })

  // elo_after was clamped at ELO_MIN (1) but elo_change was not, so subtracting the delta from a clamped rating
  // landed on the wrong ELO: 1 - (-20) = 21 instead of the 5 the player had. The formula now caps the change at
  // what the loser has above the floor, so the ledger adds up, and the reversal still restores 5.
  it('reversing the latest entry of a rating at ELO_MIN restores elo_before (5), and elo_before + elo_change = elo_after', async () => {
    const ines = await createPlayer(app, midCategory, 'ines')
    const juan = await createPlayer(app, midCategory, 'juan')
    for (const p of [ines, juan]) {
      await app.client.query(
        `update players set elo = 5, mmr = -2.993, total_matches_played = 6, placement_matches_completed = 3 where id = $1`,
        [p.playerId],
      )
    }
    const m = await play(ines, juan, juan, '3-6 3-6')
    const [entry] = (await liveHistory(m)).filter((h) => h.player_id === ines.playerId)
    expect(entry.elo_after).toBe(1)
    expect(entry.elo_before + entry.elo_change).toBe(1)

    await reverseMatchRatings(m)

    expect(await state(ines.playerId)).toMatchObject({ elo: 5, mmr: '-2.993', total_matches_played: 6 })
  })

  // Monthly decay lowers ELO without a rating_history row. Restoring elo_before would undo the decay too.
  it('reversing the latest entry after a decay keeps the decay: deltas are subtracted, not restored', async () => {
    const kike = await createPlayer(app, midCategory, 'kike')
    const lola = await createPlayer(app, midCategory, 'lola')
    const m = await play(kike, lola, kike, '6-4 6-4')
    const [entry] = (await liveHistory(m)).filter((h) => h.player_id === kike.playerId)
    await app.client.query(`update players set elo = elo - 50 where id = $1`, [kike.playerId]) // the decay

    await reverseMatchRatings(m)

    expect((await state(kike.playerId)).elo).toBe(entry.elo_before - 50)
  })
})

// ---- property: recalculating the latest match is a no-op on every player, for random match sequences ----

// Written from the winner's side; mirrored when player 2 wins, since a score lists player 1's games first
const scores = ['6-3 6-4', '7-5 6-7(5) 6-2', '6-0 6-1', '4-6 6-3 7-6(8)', 'WO'] as const
const fromPlayer1 = (score: string, player1Wins: boolean) =>
  player1Wins ? score : score.replace(/(\d+)-(\d+)/g, (_, w, l) => `${l}-${w}`)

const plan = fc.integer({ min: 2, max: 4 }).chain((n) =>
  fc.record({
    n: fc.constant(n),
    categoryOf: fc.array(fc.constantFrom(0, 1), { minLength: n, maxLength: n }),
    matches: fc.array(
      fc.record({
        pair: fc.uniqueArray(fc.integer({ min: 0, max: n - 1 }), { minLength: 2, maxLength: 2 }),
        player1Wins: fc.boolean(),
        score: fc.constantFrom(...scores),
      }),
      { minLength: 1, maxLength: 6 },
    ),
  }),
)

describe('recalculate: property over random match sequences', () => {
  it('recalculating the latest match leaves every player and the ledger exactly as before', async () => {
    await fc.assert(
      fc.asyncProperty(plan, async ({ categoryOf, matches }) => {
        const accounts: Account[] = []
        for (const c of categoryOf) accounts.push(await createPlayer(app, c === 0 ? lowCategory : midCategory, 'prop'))
        const perPair = new Map<string, number>()
        let last: string | null = null
        for (const m of matches) {
          const key = [...m.pair].sort().join()
          if ((perPair.get(key) ?? 0) >= 4) continue // product rule: at most 4 competitive matches per pair per month
          perPair.set(key, (perPair.get(key) ?? 0) + 1)
          const p1 = accounts[m.pair[0]]
          const p2 = accounts[m.pair[1]]
          const matchId = await play(p1, p2, m.player1Wins ? p1 : p2, fromPlayer1(m.score, m.player1Wins))
          if (m.score !== 'WO') last = matchId // a walkover is never rated, so there is nothing to recalculate
        }
        if (!last) return true

        const before = await Promise.all(accounts.map((a) => state(a.playerId)))
        const ledgerBefore = await liveHistory(last)
        await recalculate(last)
        const after = await Promise.all(accounts.map((a) => state(a.playerId)))
        expect(after).toEqual(before)
        const ledgerAfter = await liveHistory(last)
        expect(ledgerAfter).toEqual(ledgerBefore)
        // players.elo is the latest live elo_after
        for (const a of accounts) {
          const { rows } = await app.client.query<{ elo_after: number }>(
            `select elo_after from rating_history where player_id = $1 and rating_reversed = false order by created_at desc limit 1`,
            [a.playerId],
          )
          if (rows[0]) expect((await state(a.playerId)).elo).toBe(rows[0].elo_after)
        }
        return true
      }),
      { seed: 20260925, numRuns: 8, endOnFailure: true },
    )
  }, 300_000)
})
