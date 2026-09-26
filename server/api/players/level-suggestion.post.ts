import { asc } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { categories } from '~/server/db/schema'
import { requireUser } from '~/server/utils/session'
import { isJevFeatureEnabled } from '~/server/utils/jev'
import { parseLevelAnswers, suggestLevel } from '~/server/utils/level-suggestion'
import { consumeRateLimit } from '~/server/utils/rate-limit'

// Advisory only: this reads categories and asks Jev. It never writes a player or a tier; the player
// confirms a category themselves through POST /api/players/me.
// Past the per-account limit the player simply gets no suggestion, the same as when Jev is down.
const LEVEL_SUGGESTION_LIMIT = { windowSeconds: 3600, max: 10 }

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const answers = parseLevelAnswers(await readBody(event))
  if (!answers) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid questionnaire answers' })
  }
  if (!isJevFeatureEnabled('onboarding')) return { suggestion: null }

  const db = useDb()
  const quota = await consumeRateLimit(db, `jev-level-suggestion:${user.id}`, LEVEL_SUGGESTION_LIMIT)
  if (!quota.allowed) return { suggestion: null }

  const rows = await db.query.categories.findMany({
    columns: { id: true, name: true, description: true, order: true },
    orderBy: [asc(categories.order)],
  })
  return { suggestion: await suggestLevel(answers, rows) }
})
