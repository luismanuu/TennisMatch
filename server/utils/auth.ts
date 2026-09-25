import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { useDb } from '../db'
import { account, session, user, verification } from '../db/schema'
import { sendEmail } from './email'

const https = (host?: string) => (host ? `https://${host}` : undefined)

function createAuth() {
  const vercelOrigins = [
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ].map(https)
  const emailDelivery = Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)

  return betterAuth({
    baseURL:
      process.env.BETTER_AUTH_URL ??
      (process.env.VERCEL_ENV === 'production'
        ? https(process.env.VERCEL_PROJECT_PRODUCTION_URL)
        : https(process.env.VERCEL_BRANCH_URL ?? process.env.VERCEL_URL)),
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: vercelOrigins.filter((o): o is string => Boolean(o)),
    database: drizzleAdapter(useDb(), {
      provider: 'pg',
      schema: { user, session, account, verification },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      autoSignIn: true,
      // Verification is only enforced when we can actually deliver the email.
      requireEmailVerification: emailDelivery,
    },
    emailVerification: {
      sendOnSignUp: emailDelivery,
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
