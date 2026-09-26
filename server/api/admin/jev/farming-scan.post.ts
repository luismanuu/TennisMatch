import { requireAdmin } from '~/server/utils/session'
import { isJevFeatureEnabled } from '~/server/utils/jev'
import { scanForRatingFarming } from '~/server/utils/farming'

// On-demand, admin-only review list. It reads and returns; it never changes a rating, a match or a player.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  if (!isJevFeatureEnabled('farming')) return { enabled: false, pairs: [] }
  return { enabled: true, pairs: await scanForRatingFarming() }
})
