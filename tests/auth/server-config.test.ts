// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import fc from 'fast-check'
import { ProductionConfigError, resolveServerConfig } from '../../server/utils/server-config'
import { resetServerAuthForTests, serverAuth } from '../../server/utils/auth'

const SEED = 20260925

const value = fc.oneof(
  fc.constant(undefined),
  fc.constant(''),
  fc.constantFrom('tenis.ec', 'tennis-match.vercel.app', 'tennis-git-staging.vercel.app', 'ñandú.ec', 'localhost:3000'),
  fc.constantFrom('https://tenis.ec', 'https://tenis.ec/', 'https://tenis.ec/path?q=1', 'http://tenis.ec', 'not a url', 'javascript:alert(1)', 'ftp://tenis.ec'),
  fc.string(),
)

const envArb = fc.record(
  {
    NODE_ENV: fc.constantFrom(undefined, 'production', 'development', 'test'),
    VERCEL_ENV: fc.constantFrom(undefined, 'production', 'preview', 'development'),
    BETTER_AUTH_URL: value,
    VERCEL_URL: value,
    VERCEL_BRANCH_URL: value,
    VERCEL_PROJECT_PRODUCTION_URL: value,
    RESEND_API_KEY: fc.constantFrom(undefined, '', 're_test'),
    EMAIL_FROM: fc.constantFrom(undefined, '', 'Tenis Ecuador <hola@tenis.ec>'),
    PORT: fc.constantFrom(undefined, '3000', '4321'),
    ALLOW_UNSAFE_LOCAL_PRODUCTION: fc.constantFrom(undefined, '', '1', 'true'),
  },
  { requiredKeys: [] },
)

// Independent statement of the rule: on Vercel only VERCEL_ENV=production; off Vercel every production run
// unless the local opt-out is exactly '1'.
const isProd = (env: Record<string, string | undefined>) =>
  env.NODE_ENV === 'production' &&
  (env.VERCEL_ENV ? env.VERCEL_ENV === 'production' : env.ALLOW_UNSAFE_LOCAL_PRODUCTION !== '1')

function attempt(env: Record<string, string | undefined>) {
  try {
    return { ok: true as const, config: resolveServerConfig(env) }
  } catch (error) {
    return { ok: false as const, error }
  }
}

describe('resolveServerConfig (property)', () => {
  it('production without an email sender never resolves; elsewhere resolution never throws', () => {
    fc.assert(
      fc.property(envArb, (env) => {
        const r = attempt(env)
        if (isProd(env) && !(env.RESEND_API_KEY && env.EMAIL_FROM)) return !r.ok && r.error instanceof ProductionConfigError
        if (!isProd(env)) return r.ok
        return true
      }),
      { seed: SEED, numRuns: 2000 },
    )
  })

  it('production always requires verification; elsewhere only when email can be delivered', () => {
    fc.assert(
      fc.property(envArb, (env) => {
        const r = attempt(env)
        if (!r.ok) return true
        return r.config.requireEmailVerification === (isProd(env) || Boolean(env.RESEND_API_KEY && env.EMAIL_FROM))
      }),
      { seed: SEED, numRuns: 2000 },
    )
  })

  it('the base URL is always a bare http(s) origin, and https in production', () => {
    fc.assert(
      fc.property(envArb, (env) => {
        const r = attempt(env)
        if (!r.ok) return true
        const url = new URL(r.config.baseURL)
        return url.origin === r.config.baseURL && (isProd(env) ? url.protocol === 'https:' : /^https?:$/.test(url.protocol))
      }),
      { seed: SEED, numRuns: 2000 },
    )
  })

  it('production ignores per-deployment hosts: VERCEL_URL / VERCEL_BRANCH_URL never change the outcome', () => {
    fc.assert(
      fc.property(envArb, value, value, (env, a, b) => {
        const prod = { ...env, NODE_ENV: 'production', VERCEL_ENV: 'production' }
        const one = attempt({ ...prod, VERCEL_URL: a, VERCEL_BRANCH_URL: b })
        const two = attempt({ ...prod, VERCEL_URL: 'evil.example', VERCEL_BRANCH_URL: 'evil.example' })
        return one.ok === two.ok && (!one.ok || !two.ok || one.config.baseURL === two.config.baseURL)
      }),
      { seed: SEED, numRuns: 1000 },
    )
  })

  it('staging (Vercel preview) keeps sign-up open without an email sender', () => {
    const config = resolveServerConfig({ NODE_ENV: 'production', VERCEL_ENV: 'preview', VERCEL_BRANCH_URL: 'tennis-git-staging.vercel.app' })
    expect(config).toEqual({
      production: false,
      baseURL: 'https://tennis-git-staging.vercel.app',
      emailDelivery: false,
      requireEmailVerification: false,
    })
  })

  it('a non-Vercel production host (no VERCEL_ENV) fails closed too', () => {
    expect(() => resolveServerConfig({ NODE_ENV: 'production', BETTER_AUTH_URL: 'https://tenis.ec' })).toThrow(
      /RESEND_API_KEY is missing; EMAIL_FROM is missing/,
    )
    expect(() =>
      resolveServerConfig({ NODE_ENV: 'production', RESEND_API_KEY: 're_test', EMAIL_FROM: 'Tenis <hola@tenis.ec>' }),
    ).toThrow(/BETTER_AUTH_URL/)
  })

  it('ALLOW_UNSAFE_LOCAL_PRODUCTION=1 lets a local production build boot, and is ignored on Vercel', () => {
    expect(resolveServerConfig({ NODE_ENV: 'production', ALLOW_UNSAFE_LOCAL_PRODUCTION: '1', PORT: '4321' })).toEqual({
      production: false,
      baseURL: 'http://localhost:4321',
      emailDelivery: false,
      requireEmailVerification: false,
    })
    expect(() =>
      resolveServerConfig({ NODE_ENV: 'production', VERCEL_ENV: 'production', ALLOW_UNSAFE_LOCAL_PRODUCTION: '1', BETTER_AUTH_URL: 'https://tenis.ec' }),
    ).toThrow(ProductionConfigError)
  })

  it('production with sender and pinned URL requires verification', () => {
    const config = resolveServerConfig({
      NODE_ENV: 'production',
      VERCEL_ENV: 'production',
      BETTER_AUTH_URL: 'https://tenis.ec/',
      RESEND_API_KEY: 're_test',
      EMAIL_FROM: 'Tenis Ecuador <hola@tenis.ec>',
    })
    expect(config).toMatchObject({ production: true, baseURL: 'https://tenis.ec', requireEmailVerification: true })
  })
})

describe('production refuses to boot without an email sender', () => {
  const env = { ...process.env }
  afterEach(() => {
    process.env = { ...env }
    resetServerAuthForTests()
    vi.unstubAllGlobals()
  })

  function productionWithoutEmail() {
    process.env.NODE_ENV = 'production'
    process.env.VERCEL_ENV = 'production'
    process.env.BETTER_AUTH_URL = 'https://tenis.ec'
    process.env.DATABASE_URL = 'postgres://unused@localhost/unused'
    delete process.env.RESEND_API_KEY
    delete process.env.EMAIL_FROM
  }

  it('the startup plugin throws', async () => {
    vi.stubGlobal('defineNitroPlugin', (plugin: () => void) => plugin)
    const { default: plugin } = await import('../../server/plugins/production-config')
    productionWithoutEmail()
    expect(() => (plugin as unknown as () => void)()).toThrow(/RESEND_API_KEY is missing; EMAIL_FROM is missing/)
    process.env.RESEND_API_KEY = 're_test'
    process.env.EMAIL_FROM = 'Tenis Ecuador <hola@tenis.ec>'
    expect(() => (plugin as unknown as () => void)()).not.toThrow()
  })

  it('the auth instance cannot be built, so sign-up is refused too', () => {
    productionWithoutEmail()
    resetServerAuthForTests()
    expect(() => serverAuth()).toThrow(ProductionConfigError)
  })
})
