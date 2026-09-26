import { eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { categories, cities, players } from '~/server/db/schema'
import { requireUser } from '~/server/utils/session'
import { eloToMmr } from '~/server/utils/rating-system'
import { assertDisplayNameAllowed } from '~/server/utils/moderation'
import type { CreatePlayerPayload } from '~/types'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  const body = await readBody<Partial<CreatePlayerPayload>>(event)
  const name = body?.name?.trim()
  const phone_number = body?.phone_number
  const city_id = body?.city_id
  const category_id = body?.category_id

  if (!name || !category_id || !city_id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required fields: name, category_id, city_id',
    })
  }

  const db = useDb()

  const city = UUID.test(city_id)
    ? await db.query.cities.findFirst({ columns: { id: true }, where: eq(cities.id, city_id) })
    : undefined
  if (!city) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid city_id' })
  }

  const category = UUID.test(category_id)
    ? await db.query.categories.findFirst({
        columns: { id: true, default_elo: true },
        where: eq(categories.id, category_id),
      })
    : undefined
  if (!category) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid category_id' })
  }

  // One player profile per account. This check is the fast path; the DB's own unique
  // constraint on players.user_id is what actually protects against a race between two
  // concurrent POSTs (see the catch below: a 23505 there means we lost that race).
  const existingPlayer = await db.query.players.findFirst({
    columns: { id: true },
    where: eq(players.user_id, user.id),
  })
  if (existingPlayer) {
    throw createError({ statusCode: 409, statusMessage: 'Player profile already exists' })
  }

  await assertDisplayNameAllowed(name)

  const initialElo = category.default_elo || 1000
  const initialMmr = eloToMmr(initialElo)

  try {
    const [created] = await db
      .insert(players)
      .values({
        user_id: user.id,
        name,
        phone_number: phone_number || null,
        city_id,
        category_id,
        elo: initialElo,
        mmr: initialMmr,
        mmr_uncertainty: 2.0,
      })
      .returning({ id: players.id })

    return await db.query.players.findFirst({
      where: eq(players.id, created.id),
      with: { category: true, city: true },
    })
  } catch (error: any) {
    // node-postgres/pglite/neon drivers all surface the pg error code, but some wrap it in
    // `.cause` (h3/drizzle) rather than putting it directly on the thrown error.
    const pgCode = error?.code ?? error?.cause?.code
    if (pgCode === '23505') {
      throw createError({ statusCode: 409, statusMessage: 'Player profile already exists' })
    }
    throw error
  }
})
