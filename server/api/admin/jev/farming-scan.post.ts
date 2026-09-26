import { useDb } from '~/server/db'
import { requireAdmin } from '~/server/utils/session'
import { isJevFeatureEnabled } from '~/server/utils/jev'
import { scanForRatingFarming } from '~/server/utils/farming'
import { enforceRateLimits } from '~/server/utils/rate-limit'

// One shared bucket for every admin: each scan can make up to 50 gateway calls.
const SCAN_LIMIT = { windowSeconds: 60, max: 3 }

// On-demand, admin-only review list. It reads and returns; it never changes a rating, a match or a player.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  if (!isJevFeatureEnabled('farming')) return { enabled: false, pairs: [] }
  await enforceRateLimits(event, useDb(), [
    { key: 'jev-farming-scan', rule: SCAN_LIMIT, message: 'Too many farming scans, retry in a minute' },
  ])
  return { enabled: true, pairs: await scanForRatingFarming() }
})
