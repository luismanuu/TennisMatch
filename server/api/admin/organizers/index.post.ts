import { findPlayerByUserId, requireAdmin } from '~/server/utils/session'
import { findAccountByEmail, setAccountRole } from '~/server/utils/users'

// Promotes an existing account to tournament organizer. There are no organizer invitations any more:
// the person creates an account first, then an admin promotes it by email.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const body = await readBody<{ email: string; name?: string }>(event)
    const email = body?.email?.trim()

    if (!email) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: email'
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

    const account = await findAccountByEmail(email)

    if (!account) {
      throw createError({
        statusCode: 404,
        statusMessage: `No existe una cuenta con el correo ${email}. La persona debe crear una cuenta primero.`
      })
    }

    if (account.role === 'tournament_organizer') {
      throw createError({
        statusCode: 409,
        statusMessage: `User with email ${email} is already a tournament organizer`
      })
    }

    // Promoting would silently strip admin rights; an admin must be demoted deliberately.
    if (account.role === 'admin') {
      throw createError({
        statusCode: 409,
        statusMessage: `User with email ${email} is an admin`
      })
    }

    await setAccountRole(account.id, 'tournament_organizer')
    const player = await findPlayerByUserId(account.id)

    return {
      success: true,
      message: 'User promoted to tournament organizer',
      organizer: {
        id: player?.id ?? account.id,
        user_id: account.id,
        player_id: player?.id ?? null,
        name: player?.name ?? account.name,
        email: account.email,
        role: 'tournament_organizer'
      }
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
