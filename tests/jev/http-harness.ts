import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest'
import { startTestApp, type TestApp } from '../security/harness'
import { createCategory } from '../data/matches-helpers'
import { resetJevBreakerForTests } from '../../server/utils/jev'
import { fakeGateway, FLAGS_ON, interceptGateway, type FakeGateway, type GatewayBehaviour } from './helpers'

export type JevTestApp = {
  app: TestApp
  cityId: string
  categoryId: string
  useGateway: (behaviour: GatewayBehaviour | ((body: any) => GatewayBehaviour)) => FakeGateway
  releaseGateway: () => void
  countRows: (table: string, where?: string, params?: unknown[]) => Promise<number>
}

// One PGlite-backed app per test file, every JEV flag on, and gateway calls routed to a fake.
export function setupJevTestApp(): JevTestApp {
  const savedEnv = { ...process.env }
  let restoreFetch: (() => void) | undefined
  const t = {
    releaseGateway: () => {
      restoreFetch?.()
      restoreFetch = undefined
    },
    useGateway: (behaviour: GatewayBehaviour | ((body: any) => GatewayBehaviour)) => {
      const gw = fakeGateway(behaviour)
      restoreFetch = interceptGateway(gw)
      return gw
    },
    countRows: async (table: string, where = 'true', params: unknown[] = []) =>
      (await t.app.client.query<{ n: number }>(`select count(*)::int as n from ${table} where ${where}`, params)).rows[0].n,
  } as JevTestApp

  beforeAll(async () => {
    t.app = await startTestApp()
    t.cityId = ((await t.app.request('GET', '/api/cities')).body as Array<{ id: string }>)[0].id
    t.categoryId = await createCategory(t.app)
  }, 60_000)

  afterAll(async () => {
    await t.app?.close()
  })

  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    Object.assign(process.env, FLAGS_ON)
  })

  afterEach(() => {
    t.releaseGateway()
    resetJevBreakerForTests()
    for (const key of Object.keys(FLAGS_ON)) {
      if (savedEnv[key] === undefined) delete process.env[key]
      else process.env[key] = savedEnv[key]
    }
    vi.restoreAllMocks()
  })

  return t
}
