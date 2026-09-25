// Deployment-dependent settings, resolved from the environment only. Nothing here reads the request:
// outbound links and the auth origin must never follow a client-supplied Host header.
//
// Production fails closed: a missing email sender or an unusable base URL throws, and the startup plugin
// (server/plugins/production-config.ts) refuses to boot. Production means NODE_ENV=production and either
// VERCEL_ENV=production or no VERCEL_ENV at all (a non-Vercel host). Vercel previews (VERCEL_ENV=preview,
// i.e. staging) and `vercel dev` are not production: they keep working without an email sender and
// verification is then not enforced.
//
// A local `nuxt build && node .output/server/index.mjs` is also NODE_ENV=production without VERCEL_ENV;
// it needs ALLOW_UNSAFE_LOCAL_PRODUCTION=1 to boot without a sender. The opt-out is ignored whenever
// VERCEL_ENV is set, so it can never switch the check off on a Vercel deployment.
// See docs/MIGRATION-CHECKLIST.md, "Production configuration".

type Env = Record<string, string | undefined>

export type ServerConfig = {
  production: boolean
  baseURL: string
  emailDelivery: boolean
  requireEmailVerification: boolean
}

export class ProductionConfigError extends Error {
  constructor(problems: string[]) {
    super(`Refusing to start in production: ${problems.join('; ')}`)
    this.name = 'ProductionConfigError'
  }
}

export function isProductionDeployment(env: Env = process.env): boolean {
  if (env.NODE_ENV !== 'production') return false
  if (env.VERCEL_ENV) return env.VERCEL_ENV === 'production'
  return env.ALLOW_UNSAFE_LOCAL_PRODUCTION !== '1'
}

const https = (host?: string) => (host ? `https://${host}` : undefined)

// An absolute http(s) origin, without path or trailing slash. Anything else is unusable as a link base.
function origin(value: string | undefined): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : undefined
  } catch {
    return undefined
  }
}

export function resolveServerConfig(env: Env = process.env): ServerConfig {
  const production = isProductionDeployment(env)
  const emailDelivery = Boolean(env.RESEND_API_KEY && env.EMAIL_FROM)
  const problems: string[] = []

  let baseURL: string | undefined
  if (production) {
    // Pinned values only: the configured URL, or the project's production domain as Vercel sets it.
    // Never VERCEL_URL / VERCEL_BRANCH_URL: those are per-deployment hosts.
    baseURL = env.BETTER_AUTH_URL ? origin(env.BETTER_AUTH_URL) : origin(https(env.VERCEL_PROJECT_PRODUCTION_URL))
    if (!baseURL) problems.push('BETTER_AUTH_URL (or VERCEL_PROJECT_PRODUCTION_URL) must be an absolute URL')
    else if (!baseURL.startsWith('https://')) problems.push('the production base URL must use https')
    if (!env.RESEND_API_KEY) problems.push('RESEND_API_KEY is missing')
    if (!env.EMAIL_FROM) problems.push('EMAIL_FROM is missing')
  } else {
    baseURL =
      origin(env.BETTER_AUTH_URL) ??
      origin(https(env.VERCEL_BRANCH_URL)) ??
      origin(https(env.VERCEL_URL)) ??
      `http://localhost:${env.PORT || 3000}`
  }

  if (problems.length > 0) throw new ProductionConfigError(problems)

  return {
    production,
    baseURL: baseURL!,
    emailDelivery,
    // Production always requires verification (the boot check above guarantees a sender exists).
    // Elsewhere it is only enforced when the email can actually be delivered.
    requireEmailVerification: production || emailDelivery,
  }
}
