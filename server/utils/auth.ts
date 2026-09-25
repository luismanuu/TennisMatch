import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { useDb } from '../db'
import { account, rateLimit, session, user, verification } from '../db/schema'
import { sendEmail } from './email'
import { resolveServerConfig } from './server-config'

const https = (host?: string) => (host ? `https://${host}` : undefined)

// Auth rate limits (Better Auth "Rate Limit" docs: https://www.better-auth.com/docs/concepts/rate-limit).
// Better Auth enables them only when NODE_ENV=production by default and keeps counters in memory, which
// a serverless function loses between invocations; here they are always on and stored in the
// `rate_limit` table (storage: 'database', schema in server/db/schema.ts, migration 0003).
// Keys are client IP + path; the IP comes from AUTH_IP_ADDRESS below.
export const AUTH_RATE_LIMIT = {
  enabled: true,
  storage: 'database' as const,
  modelName: 'rateLimit',
  window: 60,
  max: 100,
  customRules: {
    '/sign-in/email': { window: 60, max: 5 },
    '/sign-up/email': { window: 60 * 60, max: 5 },
  },
}

// Which header names the client for rate limiting (better-auth 1.7.6: option `advanced.ipAddress`,
// @better-auth/core/dist/types/init-options.d.mts:243 `ipAddressHeaders`, :257 `ipv6Subnet`; resolution in
// @better-auth/core/dist/utils/ip.mjs:203-219, headers tried in order, first usable value wins).
// The default is x-forwarded-for alone, and ip.mjs:190 rejects any multi-hop value when no trustedProxies are
// set; the limiter then keys every such request on "no-trusted-ip|<path>" (better-auth/dist/api/rate-limiter/
// index.mjs:233,245), one bucket for the whole site. Vercel sets x-vercel-forwarded-for and x-real-ip to the
// client address and an upstream proxy cannot overwrite them
// (https://vercel.com/docs/edge-network/headers/request-headers), so they come first. Off Vercel a client
// could send them itself; production runs on Vercel. ipv6Subnet stays at its default /64 (ip.mjs:105).
export const AUTH_IP_ADDRESS = {
  ipAddressHeaders: ['x-vercel-forwarded-for', 'x-real-ip', 'x-forwarded-for'],
}

function createAuth() {
  const config = resolveServerConfig()
  // Vercel sets these per deployment; they are our own hosts, so requests from them are trusted.
  const trustedOrigins = [
    config.baseURL,
    ...[process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL].map(https),
  ].filter((o): o is string => Boolean(o))

  return betterAuth({
    // Pinned from configuration (server-config.ts); never inferred from the request Host.
    baseURL: config.baseURL,
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins,
    database: drizzleAdapter(useDb(), {
      provider: 'pg',
      schema: { user, session, account, verification, rateLimit },
    }),
    rateLimit: AUTH_RATE_LIMIT,
    advanced: { ipAddress: AUTH_IP_ADDRESS },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      autoSignIn: true,
      // Always required in production (boot refuses without a sender); elsewhere only when email can be delivered.
      requireEmailVerification: config.requireEmailVerification,
    },
    emailVerification: {
      sendOnSignUp: config.emailDelivery,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user: u, url }) => {
        await sendEmail({
          to: u.email,
          subject: 'Confirma tu correo en Tenis Ecuador',
          text: `Hola ${u.name}, confirma tu correo abriendo este enlace: ${url}`,
        })
      },
    },
    user: {
      additionalFields: {
        role: { type: 'string', required: false, defaultValue: 'player', input: false },
      },
    },
  })
}

let instance: ReturnType<typeof createAuth> | undefined

export function serverAuth() {
  instance ??= createAuth()
  return instance
}

// Tests build a fresh database per suite; the auth instance must follow it.
export function resetServerAuthForTests() {
  instance = undefined
}
