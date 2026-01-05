import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'
import { getClerkClient, createInvitation } from '~/server/utils/clerk'
import { randomUUID } from 'crypto'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<{
      clerk_id: string
      name: string
      email: string
    }>(event)

    const { clerk_id, name, email } = body

    if (!clerk_id || !name || !email) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: clerk_id, name, email'
      })
    }

    await requireAdmin(clerk_id)

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid email format'
      })
    }

    const supabase = getSupabaseAdmin()
    const clerkClient = getClerkClient()

    // Check if user already exists in Clerk
    try {
      const existingUsers = await clerkClient.users.getUserList({
        emailAddress: [email]
      })

      if (existingUsers.data.length > 0) {
        const existingUser = existingUsers.data[0]
        const role = existingUser.publicMetadata?.role as string | undefined

        if (role === 'tournament_organizer') {
          throw createError({
            statusCode: 409,
            statusMessage: `User with email ${email} is already a tournament organizer`
          })
        }

        // If user exists but is not an organizer, we can't convert them
        throw createError({
          statusCode: 409,
          statusMessage: `User with email ${email} already exists with a different role`
        })
      }
    } catch (checkError: any) {
      if (checkError.statusCode) {
        throw checkError
      }
      // User doesn't exist, continue with invitation
    }

    // Check if email is already registered as a player
    const { data: existingPlayer } = await supabase
      .from('players')
      .select('id, name, clerk_id')
      .eq('clerk_id', email)
      .single()

    if (existingPlayer) {
      throw createError({
        statusCode: 409,
        statusMessage: `Email ${email} is already registered as a player (${existingPlayer.name})`
      })
    }

    // Generate unique invitation token
    const invitationToken = randomUUID()

    // Get the base URL for invitation links
    const config = useRuntimeConfig()
    const baseUrl = config.public?.appUrl || process.env.NUXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const invitationUrl = `${baseUrl}/invitation/${invitationToken}`

    // Create Clerk invitation with tournament_organizer role
    try {
      const invitation = await clerkClient.invitations.createInvitation({
        emailAddress: email,
        publicMetadata: {
          name: name,
          invitationToken: invitationToken,
          role: 'tournament_organizer'
        },
        redirectUrl: invitationUrl // Redirect to our custom invitation page
      })

      return {
        success: true,
        message: 'Tournament organizer invitation sent successfully',
        invitation: {
          id: invitation.id,
          email: invitation.emailAddress,
          status: invitation.status,
          name: name
        }
      }
    } catch (invitationError: any) {
      console.error('Error creating organizer invitation:', invitationError)
      throw createError({
        statusCode: invitationError.statusCode || 500,
        statusMessage: invitationError.errors?.[0]?.message || invitationError.message || 'Failed to create invitation'
      })
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

