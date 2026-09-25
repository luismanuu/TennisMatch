import { eq, sql } from 'drizzle-orm'
import { requirePlayer } from '~/server/utils/session'
import { findAccountByEmail } from '~/server/utils/users'
import {
  INVITES_PER_INVITER,
  INVITES_PER_TARGET_EMAIL,
  invitationUrl,
  newInvitationToken,
  sendInvitationEmail,
} from '~/server/utils/invitations'
import { enforceRateLimits } from '~/server/utils/rate-limit'
import { useDb } from '~/server/db'
import { categories, pending_players } from '~/server/db/schema'
import type { CreatePendingPlayerPayload } from '~/types'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  // The inviter is always the signed-in player.
  const { player: inviter } = await requirePlayer(event)

  try {
    const body = await readBody<Partial<CreatePendingPlayerPayload>>(event)
    const name = body?.name?.trim()
    const email = body?.email?.trim()
    const category_id = body?.category_id

    if (!name || !email || !category_id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: name, email, category_id'
      })
    }

    // Older clients still send invited_by_player_id; it may only name the signed-in player.
    if (body.invited_by_player_id && body.invited_by_player_id !== inviter.id) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Unauthorized: invited_by_player_id does not match authenticated user'
      })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid email format'
      })
    }

    const db = useDb()

    // Checked before any lookup: attempts count, not only successes, so the limits also cap probing
    // which emails already have an account (the 409 below).
    await enforceRateLimits(event, db, [
      {
        key: `invite:inviter:${inviter.id}`,
        rule: INVITES_PER_INVITER,
        message: 'Too many invitations sent, try again later',
      },
      {
        key: `invite:email:${email.toLowerCase()}`,
        rule: INVITES_PER_TARGET_EMAIL,
        message: 'Too many invitations for this email, try again later',
      },
    ])

    // Verify category exists
    const category = UUID.test(category_id)
      ? await db.query.categories.findFirst({ columns: { id: true }, where: eq(categories.id, category_id) })
      : undefined
    if (!category) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid category_id'
      })
    }

    if (await findAccountByEmail(email)) {
      throw createError({
        statusCode: 409,
        statusMessage: 'This email already has an account'
      })
    }

    const existing = await db.query.pending_players.findFirst({
      columns: { id: true, status: true },
      where: eq(sql`lower(${pending_players.email})`, email.toLowerCase()),
    })

    if (existing?.status === 'pending') {
      throw createError({
        statusCode: 409,
        statusMessage: 'A pending invitation already exists for this email'
      })
    }
    if (existing?.status === 'accepted') {
      throw createError({
        statusCode: 409,
        statusMessage: 'This email has already accepted an invitation'
      })
    }

    const token = newInvitationToken()
    const values = {
      name,
      category_id,
      invited_by_player_id: inviter.id,
      invitation_token: token,
      status: 'pending' as const,
    }

    // pending_players.email is unique: an expired invitation for the same email is reopened, not duplicated.
    const [created] = existing
      ? await db
          .update(pending_players)
          .set({ ...values, updated_at: new Date() })
          .where(eq(pending_players.id, existing.id))
          .returning({ id: pending_players.id })
      : await db
          .insert(pending_players)
          .values({ ...values, email })
          .returning({ id: pending_players.id })

    const pendingPlayer = await db.query.pending_players.findFirst({
      where: eq(pending_players.id, created.id),
      with: {
        category: { columns: { id: true, name: true, description: true, order: true } },
        invited_by_player: { columns: { id: true, name: true } },
      },
    })

    const url = invitationUrl(token)
    const emailSent = await sendInvitationEmail({ to: email, name, url })

    return {
      ...pendingPlayer,
      invitation_url: url,
      email_sent: emailSent
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
