import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import * as h3 from 'h3'
import type { PGlite } from '@electric-sql/pglite'
import { setDbForTests, type Db } from '../../server/db'
import { resetServerAuthForTests } from '../../server/utils/auth'
import { createTestDb } from '../db/pglite'

export const ROOT = new URL('../../', import.meta.url).pathname
const API_DIR = join(ROOT, 'server/api')

export const IDENTITY_KEYS = ['clerk_id', 'clerkId', 'clerk_user_id', 'clerkUserId', 'user_id', 'userId']
export const IDENTITY_HEADERS = ['x-clerk-id', 'x-user-id', 'x-clerk-user-id']

export type Route = { file: string; method: string | undefined; pattern: string }

export function discoverRoutes(): Route[] {
  const files: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) walk(full)
      else if (entry.endsWith('.ts')) files.push(full)
    }
  }
  walk(API_DIR)
  return files.sort().map((full) => {
    let rel = relative(API_DIR, full).slice(0, -3)
    const m = rel.match(/\.(get|post|put|patch|delete)$/)
    const method = m ? m[1].toUpperCase() : undefined
    if (m) rel = rel.slice(0, -m[0].length)
    const segments = rel
      .split('/')
      .filter((s) => s !== 'index')
      .map((s) => s.replace(/^\[\.\.\.\w+\]$/, '**').replace(/\[(\w+)\]/g, ':$1'))
    return { file: relative(ROOT, full), method, pattern: `/api/${segments.join('/')}`.replace(/\/$/, '') }
  })
}

export function concretePath(pattern: string, id: string): string {
  return pattern.replace(/:\w+/g, id).replace('/**', '/session')
}

// Every read of an identity key from the query, the body or the headers is recorded per request.
const identityReads = new Map<string, string[]>()

function record(event: h3.H3Event, what: string) {
  const id = event.headers.get('x-test-request')
  if (!id) return
  identityReads.set(id, [...(identityReads.get(id) ?? []), what])
}

function watch<T>(value: T, event: h3.H3Event, source: string): T {
  if (!value || typeof value !== 'object') return value
  return new Proxy(value as object, {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && (IDENTITY_KEYS.includes(prop) || IDENTITY_HEADERS.includes(prop.toLowerCase()))) {
        record(event, `${source}.${prop}`)
      }
      return Reflect.get(target, prop, receiver)
    },
  }) as T
}

function installNitroGlobals() {
  const g = globalThis as Record<string, unknown>
  Object.assign(g, h3)
  g.getQuery = (e: h3.H3Event) => watch(h3.getQuery(e), e, 'query')
  g.readBody = async (e: h3.H3Event) => watch(await h3.readBody(e), e, 'body')
  g.getHeaders = (e: h3.H3Event) => watch(h3.getHeaders(e), e, 'headers')
  g.getRequestHeaders = (e: h3.H3Event) => watch(h3.getRequestHeaders(e), e, 'headers')
  const header = (e: h3.H3Event, name: string) => {
    if (IDENTITY_HEADERS.includes(name.toLowerCase())) record(e, `header.${name}`)
    return h3.getHeader(e, name)
  }
  g.getHeader = header
  g.getRequestHeader = header
  g.useRuntimeConfig = () => ({ public: {}, openRouterApiKey: '' })
}

async function installServerUtilGlobals() {
  const dir = join(ROOT, 'server/utils')
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
    Object.assign(globalThis, await import(join(dir, file)))
  }
}

export type TestApp = {
  baseURL: string
  db: Db
  client: PGlite
  routes: Route[]
  close: () => Promise<void>
  request: (
    method: string,
    path: string,
    init?: { cookie?: string; body?: unknown; query?: Record<string, string>; headers?: Record<string, string> },
  ) => Promise<{ status: number; reads: string[]; body: unknown }>
  signUp: (email: string, role?: 'player' | 'admin' | 'tournament_organizer') => Promise<{ cookie: string; userId: string }>
  setRole: (userId: string, role: 'player' | 'admin' | 'tournament_organizer') => Promise<void>
}

let seq = 0

export async function startTestApp(): Promise<TestApp> {
  process.env.BETTER_AUTH_SECRET = 'test-secret-for-the-security-suite-0123456789'
  delete process.env.RESEND_API_KEY
  const { client, db } = await createTestDb()
  setDbForTests(db)
  resetServerAuthForTests()
  installNitroGlobals()
  await installServerUtilGlobals()

  const app = h3.createApp()
  const router = h3.createRouter()
  const routes = discoverRoutes()
  for (const route of routes) {
    const mod = await import(join(ROOT, route.file))
    const method = (route.method?.toLowerCase() ?? 'use') as 'get' | 'post' | 'put' | 'patch' | 'delete' | 'use'
    router[method](route.pattern, mod.default)
  }
  app.use(router)

  const server: Server = createServer(h3.toNodeListener(app))
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  process.env.BETTER_AUTH_URL = baseURL

  const request: TestApp['request'] = async (method, path, init = {}) => {
    const id = `r${++seq}`
    const url = new URL(path, baseURL)
    for (const [k, v] of Object.entries(init.query ?? {})) url.searchParams.set(k, v)
    const headers: Record<string, string> = { 'x-test-request': id, origin: baseURL, ...init.headers }
    if (init.cookie) headers.cookie = init.cookie
    let body: string | undefined
    if (init.body !== undefined && method !== 'GET' && method !== 'HEAD') {
      headers['content-type'] = 'application/json'
      body = JSON.stringify(init.body)
    }
    const res = await fetch(url, { method, headers, body })
    const text = await res.text()
    let parsed: unknown = text
    try {
      parsed = JSON.parse(text)
    } catch {
      /* not JSON */
    }
    const reads = identityReads.get(id) ?? []
    identityReads.delete(id)
    return { status: res.status, reads, body: parsed }
  }

  const setRole: TestApp['setRole'] = async (userId, role) => {
    await client.query(`update "user" set role = $1 where id = $2`, [role, userId])
  }

  const signUp: TestApp['signUp'] = async (email, role = 'player') => {
    const res = await fetch(`${baseURL}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: baseURL },
      body: JSON.stringify({ name: email.split('@')[0], email, password: 'correct-horse-battery' }),
    })
    if (res.status !== 200) throw new Error(`sign-up failed: ${res.status} ${await res.text()}`)
    const { user } = (await res.json()) as { user: { id: string } }
    const cookie = res.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ')
    if (role !== 'player') await setRole(user.id, role)
    return { cookie, userId: user.id }
  }

  return {
    baseURL,
    db,
    client,
    routes,
    request,
    signUp,
    setRole,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()))
      setDbForTests(undefined)
      resetServerAuthForTests()
      await client.close()
    },
  }
}
