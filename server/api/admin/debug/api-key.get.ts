import { requireAdmin } from '~/server/utils/admin'

/**
 * Debug endpoint to check if API key is configured
 * Admin only - for troubleshooting
 */
export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const clerkId = query.clerk_id as string
    
    if (!clerkId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized - Clerk ID required'
      })
    }

    await requireAdmin(clerkId)

    const config = useRuntimeConfig()
    const hasApiKey = !!config.openRouterApiKey
    const apiKeyLength = config.openRouterApiKey?.length || 0
    const apiKeyPrefix = config.openRouterApiKey?.substring(0, 10) || 'N/A'

    return {
      hasApiKey,
      apiKeyLength,
      apiKeyPrefix: hasApiKey ? `${apiKeyPrefix}...` : 'N/A',
      envVarName: 'OPENROUTER_API_KEY',
      note: 'Check that OPENROUTER_API_KEY is set in Vercel environment variables'
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error',
      data: error
    })
  }
})
