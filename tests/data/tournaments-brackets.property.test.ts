// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { startTestApp, type TestApp } from '../security/harness'
import { assertGroupStage, bracketRowCounts, seedPlayers, signUpPlayer, type Actor } from './tournaments-helpers'

let app: TestApp
let admin: Actor

beforeAll(async () => {
  app = await startTestApp()
  admin = await signUpPlayer(app, 'admin.propiedad@tenis.ec', 'admin')
}, 120_000)

afterAll(async () => {
  await app?.close()
})

// Oracle, from the product rules rather than the code: every registered player lands in exactly one group of at most
// group_size players, each group of n plays n*(n-1)/2 matches with every pair exactly once, standings start at zero,
// and a second generation is refused with 400 without adding or removing a row. Below min_players nothing is written.
describe('bracket generation (property, fixed seed)', () => {
  it('groups every registered player once, plays every pair once, and refuses to generate twice', async () => {
    const scenario = fc
      .record({ minPlayers: fc.integer({ min: 2, max: 8 }), groupSize: fc.integer({ min: 1, max: 8 }) })
      .chain(({ minPlayers, groupSize }) =>
        fc.record({
          minPlayers: fc.constant(minPlayers),
          groupSize: fc.constant(groupSize),
          // Mostly between min_players and 16, sometimes just below the minimum
          registered: fc.oneof(
            { weight: 4, arbitrary: fc.integer({ min: minPlayers, max: 16 }) },
            { weight: 1, arbitrary: fc.integer({ min: 0, max: minPlayers - 1 }) },
          ),
          // Some registrations are withdrawn or waitlisted and must not be grouped
          notConfirmed: fc.integer({ min: 0, max: 2 }),
        }),
      )

    await fc.assert(
      fc.asyncProperty(scenario, async ({ minPlayers, groupSize, registered, notConfirmed }) => {
        const created = await app.request('POST', '/api/admin/tournaments', {
          cookie: admin.cookie,
          body: { name: `Propiedad ${minPlayers}/${groupSize}/${registered}`, start_date: '2026-11-01T09:00', min_players: minPlayers, group_size: groupSize },
        })
        expect(created.status).toBe(200)
        const tournamentId = (created.body as { tournament: { id: string } }).tournament.id

        const playerIds = await seedPlayers(app, registered)
        for (const playerId of playerIds) {
          const res = await app.request('POST', `/api/admin/tournaments/${tournamentId}/register`, {
            cookie: admin.cookie,
            body: { player_id: playerId },
          })
          expect(res.status).toBe(200)
        }
        const others = await seedPlayers(app, notConfirmed)
        for (const [i, playerId] of others.entries()) {
          await app.client.query(
            `insert into tournament_registrations (tournament_id, player_id, status, withdrawn_at) values ($1, $2, $3, $4)`,
            [tournamentId, playerId, i % 2 === 0 ? 'withdrawn' : 'waitlisted', i % 2 === 0 ? new Date() : null],
          )
        }

        const first = await app.request('POST', `/api/admin/tournaments/${tournamentId}/generate-brackets`, { cookie: admin.cookie })

        if (registered < minPlayers) {
          expect(first.status).toBe(400)
          expect(Object.values(await bracketRowCounts(app, tournamentId)).every((n) => n === 0)).toBe(true)
          return
        }

        expect(first.status, JSON.stringify(first.body)).toBe(200)
        const expectedMatches = (() => {
          let total = 0
          for (let left = registered; left > 0; left -= groupSize) {
            const n = Math.min(groupSize, left)
            total += (n * (n - 1)) / 2
          }
          return total
        })()
        expect(first.body).toMatchObject({ groups: Math.ceil(registered / groupSize), groupMatches: expectedMatches })
        expect(await assertGroupStage(app, tournamentId, playerIds, groupSize)).toEqual([])

        const before = await bracketRowCounts(app, tournamentId)
        const second = await app.request('POST', `/api/admin/tournaments/${tournamentId}/generate-brackets`, { cookie: admin.cookie })
        expect(second.status).toBe(400)
        expect(await bracketRowCounts(app, tournamentId)).toEqual(before)
      }),
      { seed: 20260925, numRuns: 12 },
    )
  }, 300_000)
})
