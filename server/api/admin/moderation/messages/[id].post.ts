import { eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { match_messages } from '~/server/db/schema'
import { requireAdmin } from '~/server/utils/session'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const STATUS_BY_ACTION = { approve: 'visible', reject: 'rejected' } as const

// The admin's word overrides Jev either way. Nothing is deleted: a rejected message stays in the table.
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  const body = await readBody<{ action?: string }>(event)
  const action = body?.action
  if (!id || !UUID.test(id) || (action !== 'approve' && action !== 'reject')) {
    throw createError({ statusCode: 400, statusMessage: 'Expected a message id and action approve or reject' })
  }
  const [updated] = await useDb()
    .update(match_messages)
    .set({
      moderation_status: STATUS_BY_ACTION[action],
      moderation_reviewed_by: admin.id,
      moderation_reviewed_at: new Date(),
    })
    .where(eq(match_messages.id, id))
    .returning({ id: match_messages.id, moderation_status: match_messages.moderation_status })
  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Message not found' })
  }
  return updated
})
