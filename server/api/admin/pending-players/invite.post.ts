import { asc, eq, sql } from 'drizzle-orm'
import { findPlayerByUserId, requireAdmin } from '~/server/utils/session'
import { findAccountByEmail } from '~/server/utils/users'
import { invitationUrl, newInvitationToken, sendInvitationEmail } from '~/server/utils/invitations'
import { useDb } from '~/server/db'
import { categories, pending_players } from '~/server/db/schema'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)

  try {
    const body = await readBody<{
      name: string
      email: string
      category_id?: string
    }>(event)

    const name = body?.name?.trim()
    const email = body?.email?.trim()

    if (!name || !email) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: name, email'
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

    // pending_players.invited_by_player_id is required, so the admin needs a player profile to invite.
    const inviter = await findPlayerByUserId(admin.id)
    if (!inviter) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Necesitas un perfil de jugador para enviar invitaciones'
      })
    }

    const existingAccount = await findAccountByEmail(email)
    if (existingAccount) {
      throw createError({
        statusCode: 409,
        statusMessage: `Email ${email} is already registered`
      })
    }

    const db = useDb()

    // The admin form does not pick a category; fall back to the first category in display order.
    const category = body.category_id
      ? UUID.test(body.category_id)
        ? await db.query.categories.findFirst({ columns: { id: true }, where: eq(categories.id, body.category_id) })
        : undefined
      : await db.query.categories.findFirst({ columns: { id: true }, orderBy: asc(categories.order) })

    if (!category) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid category_id'
      })
    }

    const existing = await db.query.pending_players.findFirst({
      columns: { id: true, status: true },
      where: eq(sql`lower(${pending_players.email})`, email.toLowerCase()),
    })

    if (existing && existing.status !== 'expired') {
      throw createError({
        statusCode: 409,
        statusMessage: existing.status === 'pending'
          ? 'A pending invitation already exists for this email'
          : `Email ${email} has already accepted an invitation`
      })
    }

    const token = newInvitationToken()
    const values = {
      name,
      category_id: category.id,
      invited_by_player_id: inviter.id,
      invitation_token: token,
      status: 'pending' as const,
    }

    // pending_players.email is unique: an expired invitation for the same email is reopened, not duplicated.
    const [pendingPlayer] = existing
      ? await db
          .update(pending_players)
          .set({ ...values, updated_at: new Date() })
          .where(eq(pending_players.id, existing.id))
          .returning()
      : await db
          .insert(pending_players)
          .values({ ...values, email })
          .returning()

    const url = invitationUrl(token)
    const emailSent = await sendInvitationEmail({ to: email, name, url })

    return {
      success: true,
      message: emailSent
        ? 'Invitation sent successfully'
        : 'Invitation created. Email is not configured; share the link manually.',
      invitation: {
        id: pendingPlayer.id,
        email: pendingPlayer.email,
        status: pendingPlayer.status,
        name: pendingPlayer.name
      },
      pendingPlayer,
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
