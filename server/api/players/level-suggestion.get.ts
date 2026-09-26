import { requireUser } from '~/server/utils/session'
import { isJevFeatureEnabled } from '~/server/utils/jev'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  return { enabled: isJevFeatureEnabled('onboarding') && Boolean(process.env.AI_GATEWAY_API_KEY) }
})
