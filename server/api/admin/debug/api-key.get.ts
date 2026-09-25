import { requireAdmin } from '~/server/utils/session'

/**
 * Debug endpoint to check if API key is configured
 * Admin only - for troubleshooting
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
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
