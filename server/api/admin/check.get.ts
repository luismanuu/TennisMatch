import { checkIsAdmin } from '~/server/utils/admin'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const clerkId = query.clerk_id as string
    
    if (!clerkId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing clerk_id'
      })
    }
    
    const isAdmin = await checkIsAdmin(clerkId)
    
    return {
      isAdmin,
      clerkId
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

