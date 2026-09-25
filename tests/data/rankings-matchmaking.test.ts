// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { startTestApp, type TestApp } from '../security/harness'
import { anyCityId, deletePlayers, seedPlayer, seedPlayerForUser } from './rankings-helpers'

let app: TestApp
let viewer: { cookie: string; userId: string }
let viewerPlayerId: string
let cityId: string

beforeAll(async () => {
  app = await startTestApp()
  viewer = await app.signUp('rankings-matchmaking@tenis.ec', 'player')
  cityId = await anyCityId(app)
  // Rated, mid-range ELO (Gold tier: 2000-2499) so candidates in [1500, 3499] are all eligible by the
  // tier-range filter - keeps the property from being vacuously true because nothing qualified at all.
  viewerPlayerId = await seedPlayerForUser(app, viewer.userId, { elo: 2000, total_matches_played: 10, city_id: cityId })
}, 120_000)

afterAll(async () => {
  await app?.close()
})

async function fetchAllRecommendations(): Promise<Array<{ player: { id: string } }>> {
  const all: Array<{ player: { id: string } }> = []
  let page = 1
  for (let guard = 0; guard < 20; guard++) {
    const res = await app.request('GET', '/api/matchmaking/recommendations', { cookie: viewer.cookie, query: { page: String(page), limit: '10' } })
    if (res.status !== 200) throw new Error(`unexpected status ${res.status}`)
    const body = res.body as {
      recommendations: Array<{ player: { id: string } }>
      top_recommendations: Array<{ player: { id: string } }>
      pagination: { has_more: boolean }
    }
    all.push(...body.top_recommendations, ...body.recommendations)
    if (!body.pagination.has_more) break
    page++
  }
  return all
}

describe('GET /api/matchmaking/recommendations never recommends the viewer or a soft-deleted player (property)', () => {
  it('excludes the viewer themself and every soft-deleted candidate, for random candidate pools', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({ elo: fc.integer({ min: 1600, max: 2400 }), deleted: fc.boolean() }), { minLength: 2, maxLength: 6 }),
        async (candidates) => {
          const ids: string[] = []
          try {
            for (const c of candidates) {
              const id = await seedPlayer(app, {
                elo: c.elo,
                total_matches_played: 10,
                city_id: cityId,
                status: c.deleted ? 'deleted' : 'active',
                deleted_at: c.deleted ? new Date() : null,
              })
              ids.push(id)
            }

            const recommendations = await fetchAllRecommendations()
            const recommendedIds = recommendations.map((r) => r.player.id)

            if (recommendedIds.includes(viewerPlayerId)) return false

            const deletedIds = new Set(ids.filter((_, i) => candidates[i].deleted))
            if (recommendedIds.some((id) => deletedIds.has(id))) return false

            return true
          } finally {
            await deletePlayers(app, ids)
          }
        },
      ),
      { seed: 20260925, numRuns: 12 },
    )
  }, 60_000)

  it('sanity: an eligible active candidate in range and city DOES show up (the property above is not vacuous)', async () => {
    const candidateId = await seedPlayer(app, { elo: 2050, total_matches_played: 10, city_id: cityId })
    try {
      const recommendations = await fetchAllRecommendations()
      expect(recommendations.map((r) => r.player.id)).toContain(candidateId)
    } finally {
      await deletePlayers(app, [candidateId])
    }
  })
})
