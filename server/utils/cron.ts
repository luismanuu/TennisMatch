import { createHash, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'
import { createError } from 'h3'

const digest = (value: string) => createHash('sha256').update(value).digest()

// Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. Without a configured secret every request is refused.
export function requireCronSecret(event: H3Event): void {
  const secret = process.env.CRON_SECRET
  const given = event.headers.get('authorization') ?? ''
  if (!secret || !timingSafeEqual(digest(given), digest(`Bearer ${secret}`))) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
}
