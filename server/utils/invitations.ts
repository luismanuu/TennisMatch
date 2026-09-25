import { randomBytes } from 'node:crypto'
import { sendEmail } from './email'
import type { RateLimitRule } from './rate-limit'
import { resolveServerConfig } from './server-config'

// Every invitation emails a stranger from our domain (server/api/pending-players/index.post.ts).
export const INVITES_PER_INVITER: RateLimitRule = { windowSeconds: 60 * 60, max: 10 }
export const INVITES_PER_TARGET_EMAIL: RateLimitRule = { windowSeconds: 24 * 60 * 60, max: 3 }
// Admin sends and resends (server/api/admin/...) have their own per-email bucket, so players probing an
// address cannot lock an admin out of resending, and an admin account still cannot mail-bomb one address.
export const ADMIN_INVITES_PER_TARGET_EMAIL: RateLimitRule = { windowSeconds: 24 * 60 * 60, max: 5 }

export function adminTargetEmailLimit(email: string) {
  return {
    key: `invite:admin-email:${email.trim().toLowerCase()}`,
    rule: ADMIN_INVITES_PER_TARGET_EMAIL,
    message: 'Too many invitations for this email, try again later',
  }
}

export function newInvitationToken(): string {
  return randomBytes(32).toString('hex')
}

// The link base comes from configuration only, never from the request: a forged Host or
// X-Forwarded-Host header must not be able to point an emailed link at another site.
export function invitationUrl(token: string): string {
  return `${resolveServerConfig().baseURL}/invitation/${token}`
}

// Returns false when email delivery is not configured; the caller then shares `invitationUrl` by hand.
// Delivery failures are logged, never thrown: the invitation already exists and its link still works.
export async function sendInvitationEmail(message: { to: string; name: string; url: string }): Promise<boolean> {
  return sendEmail({
    to: message.to,
    subject: 'Te invitaron a Tenis Ecuador',
    text: `Hola ${message.name}, te invitaron a unirte a Tenis Ecuador. Crea tu cuenta aquí: ${message.url}`,
  }).catch((error) => {
    console.error('Invitation email delivery failed:', error)
    return false
  })
}
