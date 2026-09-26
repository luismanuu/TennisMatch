import { desc, eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { match_messages } from '~/server/db/schema'
import { requireAdmin } from '~/server/utils/session'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return useDb().query.match_messages.findMany({
    where: eq(match_messages.moderation_status, 'held'),
    with: { player: { columns: { id: true, name: true } } },
    orderBy: [desc(match_messages.created_at)],
    limit: 100,
  })
})
