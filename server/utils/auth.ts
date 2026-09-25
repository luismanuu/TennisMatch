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
// Keys are client IP + path; the IP comes from x-forwarded-for, which Vercel sets to the client address.
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
