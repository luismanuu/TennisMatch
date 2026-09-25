import { eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { categories, cities, players } from '~/server/db/schema'
import { requireUser } from '~/server/utils/session'
import { setAccountName } from '~/server/utils/users'
import { eloToMmr } from '~/server/utils/rating-system'
import type { UpdatePlayerPayload } from '~/types'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  const playerId = getRouterParam(event, 'id')
  const body = await readBody<UpdatePlayerPayload>(event)
  const { name, phone_number, city_id, category_id } = body

  if (!playerId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing required fields: id' })
  }

  try {
    const db = useDb()

    // Player ids are already public (GET /api/players/[id]), so existence isn't a secret:
    // a real id owned by someone else is 403, a made-up id is 404.
    const existingPlayer = UUID.test(playerId)
      ? await db.query.players.findFirst({
          where: eq(players.id, playerId),
          with: { category: { columns: { id: true, default_elo: true } } },
        })
      : undefined

    if (!existingPlayer) {
      throw createError({ statusCode: 404, statusMessage: 'Player profile not found' })
    }
    if (existingPlayer.user_id !== user.id) {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden - not your player profile' })
    }

    // If category_id is provided, verify it exists and get default_elo
    let newCategoryDefaultElo: number | null = null
    if (category_id !== undefined && category_id !== null) {
      const category = UUID.test(category_id)
        ? await db.query.categories.findFirst({
            columns: { id: true, default_elo: true },
            where: eq(categories.id, category_id),
          })
        : undefined

      if (!category) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid category_id' })
      }

      newCategoryDefaultElo = category.default_elo || 1000
    }

    // If city_id is provided, verify it exists
    if (city_id) {
      const city = UUID.test(city_id)
        ? await db.query.cities.findFirst({ columns: { id: true }, where: eq(cities.id, city_id) })
        : undefined

      if (!city) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid city_id' })
      }
    }

    // Validate phone number format if provided
    if (phone_number !== undefined && phone_number !== null && phone_number.trim() !== '') {
      const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/
      if (!phoneRegex.test(phone_number.trim())) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid phone number format' })
      }
    }

    // Prepare update payload
    const updatePayload: Partial<typeof players.$inferInsert> = {}
    if (name !== undefined) {
      updatePayload.name = name
    }
    if (phone_number !== undefined) {
      updatePayload.phone_number = phone_number && phone_number.trim() !== '' ? phone_number.trim() : null
    }
    if (city_id !== undefined) {
      if (!city_id) {
        throw createError({ statusCode: 400, statusMessage: 'City is required for ranking and matchmaking' })
      }
      updatePayload.city_id = city_id
    }

    // Handle category change: only adjust ELO if player hasn't played any placement matches
    if (category_id !== undefined) {
      updatePayload.category_id = category_id

      const isCategoryChanging = category_id !== existingPlayer.category_id
      const hasNoPlacementMatches = (existingPlayer.placement_matches_completed || 0) === 0

      if (isCategoryChanging && hasNoPlacementMatches && newCategoryDefaultElo !== null) {
        updatePayload.elo = newCategoryDefaultElo
        updatePayload.mmr = eloToMmr(newCategoryDefaultElo)
      }
      // If player has already played matches, keep their current ELO (don't update it)
    }

    const [updatedPlayer] = await db
      .update(players)
      .set(updatePayload)
      .where(eq(players.id, playerId))
      .returning({ id: players.id })

    if (!updatedPlayer) {
      throw createError({ statusCode: 500, statusMessage: 'Failed to update player profile' })
    }

    // If name changed, keep the account name in sync (the player row belongs to this account, checked above)
    if (name && name !== existingPlayer.name) {
      try {
        await setAccountName(user.id, name)
      } catch (accountError) {
        console.error('Failed to update account name:', accountError)
      }
    }

    return await db.query.players.findFirst({
      where: eq(players.id, playerId),
      with: { category: true, city: true },
    })
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error',
    })
  }
})
