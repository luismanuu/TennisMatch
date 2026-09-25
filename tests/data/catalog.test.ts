// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { startTestApp, type TestApp } from '../security/harness'

let app: TestApp
let admin: { cookie: string; userId: string }

beforeAll(async () => {
  app = await startTestApp()
  admin = await app.signUp('catalog-admin@tenis.ec', 'admin')
}, 60_000)

afterAll(async () => {
  await app?.close()
})

describe('GET /api/categories', () => {
  it('the seeded 7 categories come back ordered by order', async () => {
    const res = await app.request('GET', '/api/categories')
    expect(res.status).toBe(200)
    const cats = res.body as Array<{ order: number }>
    expect(cats).toHaveLength(7)
    const orders = cats.map((c) => c.order)
    expect(orders).toEqual([...orders].sort((a, b) => a - b))
  })
})

describe('admin category CRUD and reorder', () => {
  it('create, update, reorder, delete', async () => {
    const created = await app.request('POST', '/api/admin/categories', {
      cookie: admin.cookie,
      body: { name: 'Categoría de Prueba XYZ', order: 99, default_elo: 1234 },
    })
    expect(created.status).toBe(200)
    const categoryId = (created.body as { category: { id: string } }).category.id

    const updated = await app.request('PUT', `/api/admin/categories/${categoryId}`, {
      cookie: admin.cookie,
      body: { description: 'nueva descripción' },
    })
    expect(updated.status).toBe(200)
    expect((updated.body as { category: { description: string } }).category.description).toBe('nueva descripción')

    const reordered = await app.request('POST', '/api/admin/categories/reorder', {
      cookie: admin.cookie,
      body: { category_orders: [{ id: categoryId, order: 5 }] },
    })
    expect(reordered.status).toBe(200)

    const list = await app.request('GET', '/api/admin/categories', { cookie: admin.cookie })
    const row = (list.body as Array<{ id: string; order: number }>).find((c) => c.id === categoryId)
    expect(row?.order).toBe(5)

    const deleted = await app.request('DELETE', `/api/admin/categories/${categoryId}`, { cookie: admin.cookie })
    expect(deleted.status).toBe(200)

    const listAfter = await app.request('GET', '/api/admin/categories', { cookie: admin.cookie })
    expect((listAfter.body as Array<{ id: string }>).some((c) => c.id === categoryId)).toBe(false)
  })

  it('rejects a duplicate name', async () => {
    const first = await app.request('POST', '/api/admin/categories', {
      cookie: admin.cookie,
      body: { name: 'Nombre Único ABC' },
    })
    expect(first.status).toBe(200)

    const dup = await app.request('POST', '/api/admin/categories', {
      cookie: admin.cookie,
      body: { name: 'Nombre Único ABC' },
    })
    expect(dup.status).toBe(400)
  })
})

describe('admin city segments CRUD', () => {
  it('create, add city, remove city, rename, delete', async () => {
    const citiesRes = await app.request('GET', '/api/cities')
    const cityIds = (citiesRes.body as Array<{ id: string }>).map((c) => c.id)
    expect(cityIds.length).toBeGreaterThanOrEqual(2)

    const created = await app.request('POST', '/api/admin/city-segments', {
      cookie: admin.cookie,
      body: { name: 'Segmento de Prueba', city_ids: [cityIds[0]] },
    })
    expect(created.status).toBe(200)
    const segment = (created.body as { segment: { id: string; cities: Array<{ id: string }> } }).segment
    expect(segment.cities.map((c) => c.id)).toEqual([cityIds[0]])

    const added = await app.request('POST', `/api/admin/city-segments/${segment.id}/cities`, {
      cookie: admin.cookie,
      body: { city_ids: [cityIds[1]] },
    })
    expect(added.status).toBe(200)
    expect((added.body as { segment: { cities: unknown[] } }).segment.cities).toHaveLength(2)

    const removed = await app.request('DELETE', `/api/admin/city-segments/${segment.id}/cities`, {
      cookie: admin.cookie,
      query: { city_id: cityIds[1] },
    })
    expect(removed.status).toBe(200)
    expect((removed.body as { segment: { cities: unknown[] } }).segment.cities).toHaveLength(1)

    const renamed = await app.request('PUT', `/api/admin/city-segments/${segment.id}`, {
      cookie: admin.cookie,
      body: { name: 'Segmento Renombrado' },
    })
    expect(renamed.status).toBe(200)
    expect((renamed.body as { segment: { name: string } }).segment.name).toBe('Segmento Renombrado')

    const list = await app.request('GET', '/api/admin/city-segments', { cookie: admin.cookie })
    expect((list.body as { segments: Array<{ id: string }> }).segments.some((s) => s.id === segment.id)).toBe(true)

    const deleted = await app.request('DELETE', `/api/admin/city-segments/${segment.id}`, { cookie: admin.cookie })
    expect(deleted.status).toBe(200)
  })
})

// Fresh, isolated app: every iteration wipes players (and non-admin users) it created, so the
// property never inherits state from another run.
describe('pagination on the admin players list (property)', () => {
  let pgApp: TestApp
  let pgAdmin: { cookie: string; userId: string }
  let seq = 0

  beforeAll(async () => {
    pgApp = await startTestApp()
    pgAdmin = await pgApp.signUp('pagination-admin@tenis.ec', 'admin')
  }, 60_000)

  afterAll(async () => {
    await pgApp?.close()
  })

  it('partitions the rows: no duplicates, no gaps, and the total matches', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.boolean(), { minLength: 0, maxLength: 14 }), // true = soft-deleted
        fc.integer({ min: 1, max: 6 }),
        async (deletedFlags, pageSize) => {
          await pgApp.client.query('delete from players')
          await pgApp.client.query('delete from "user" where id <> $1', [pgAdmin.userId])

          for (const deleted of deletedFlags) {
            seq++
            const userId = `pg-user-${seq}`
            const email = `pg-${seq}@t.ec`
            await pgApp.client.query(`insert into "user" (id, name, email) values ($1, $2, $3)`, [userId, 'x', email])
            await pgApp.client.query(`insert into players (user_id, name, status) values ($1, $2, $3)`, [
              userId,
              `Player ${seq}`,
              deleted ? 'deleted' : 'active',
            ])
          }
          const activeCount = deletedFlags.filter((d) => !d).length

          const seen = new Set<string>()
          let offset = 0
          let total = -1
          for (let guard = 0; guard < deletedFlags.length + 5; guard++) {
            const page = await pgApp.request('GET', '/api/admin/players', {
              cookie: pgAdmin.cookie,
              query: { limit: String(pageSize), offset: String(offset) },
            })
            expect(page.status).toBe(200)
            const body = page.body as { data: Array<{ id: string }>; total: number }
            total = body.total
            if (body.data.length === 0) break
            for (const row of body.data) {
              expect(seen.has(row.id)).toBe(false) // no duplicates across pages
              seen.add(row.id)
            }
            offset += pageSize
          }

          expect(total).toBe(activeCount)
          expect(seen.size).toBe(activeCount) // no gaps: every active row was seen exactly once
        },
      ),
      { seed: 20260925, numRuns: 12 },
    )
  })
})
