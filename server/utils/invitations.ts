import { randomBytes } from 'node:crypto'
import type { H3Event } from 'h3'
import { getRequestURL } from 'h3'
import { sendEmail } from './email'

export function newInvitationToken(): string {
  return randomBytes(32).toString('hex')
}

export function invitationUrl(event: H3Event, token: string): string {
  const base = process.env.BETTER_AUTH_URL ?? getRequestURL(event).origin
  return `${base.replace(/\/$/, '')}/invitation/${token}`
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
