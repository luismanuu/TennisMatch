import { requireAdmin } from '~/server/utils/admin'
import { clerkIdQuerySchema, validateQuery } from '~/server/utils/validation'
import { getQuery } from 'h3'

/**
 * Debug endpoint to check if API key is configured
 * Admin only - for troubleshooting
 */
export default defineEventHandler(async (event) => {
  try {
    const query = validateQuery(clerkIdQuerySchema, getQuery(event))
    const clerkId = query.clerk_id

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
  } catch (error: unknown) {
    handleApiError(error, 'GET /api/admin/debug/api-key')
  }
})
