import { requireCronSecret } from '~/server/utils/cron'
import { applyMonthlyDecayToAllPlayers } from '~/server/utils/rating-system'

// Scheduled in vercel.json. Vercel Cron only issues GET requests; this is the one GET that writes.
export default defineEventHandler(async (event) => {
  requireCronSecret(event)
  const counts = await applyMonthlyDecayToAllPlayers()
  if (counts.failed > 0) {
    throw createError({ statusCode: 500, statusMessage: 'Monthly decay failed for some players', data: counts })
  }
  return { success: true, ...counts }
})
