import { requireAdmin } from '~/server/utils/session'
import { updatePreviousRanks } from '~/server/utils/update-previous-ranks'

/**
 * API endpoint to update previous_rank for all players
 * This should be called periodically (e.g., daily via cron job)
 *
 * POST /api/admin/rankings/update-previous-ranks
 *
 * Requires admin authentication
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    // Update previous ranks
    const updatedCount = await updatePreviousRanks()

    return {
      success: true,
      message: `Updated previous_rank for ${updatedCount} players`,
      updated_count: updatedCount,
    }
  } catch (error: any) {
    console.error('Error updating previous ranks:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to update previous ranks',
    })
  }
})
