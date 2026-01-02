import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'

export default defineEventHandler(async (event) => {
  try {
    const playerId = getRouterParam(event, 'id')
    const body = await readBody<{
      clerk_id: string
      name?: string
      phone_number?: string
      category_id?: string
      elo?: number
    }>(event)

    const { clerk_id, name, phone_number, category_id, elo } = body

    if (!playerId || !clerk_id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: player_id, clerk_id'
      })
    }

    await requireAdmin(clerk_id)

    const supabase = getSupabaseAdmin()

    // Check if player exists
    const { data: player, error: fetchError } = await supabase
      .from('players')
      .select('id, name')
      .eq('id', playerId)
      .single()

    if (fetchError || !player) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Player not found'
      })
    }

    // Build update object
    const updateData: any = {}
    if (name !== undefined) updateData.name = name.trim()
    if (phone_number !== undefined) updateData.phone_number = phone_number?.trim() || null
    if (category_id !== undefined) updateData.category_id = category_id || null
    if (elo !== undefined) {
      // Validate ELO is a positive number
      const eloNum = Number(elo)
      if (isNaN(eloNum) || eloNum < 0) {
        throw createError({
          statusCode: 400,
          statusMessage: 'ELO must be a positive number'
        })
      }
      updateData.elo = eloNum
    }

    // If category_id is provided, verify it exists
    if (category_id) {
      const { data: category } = await supabase
        .from('categories')
        .select('id')
        .eq('id', category_id)
        .single()

      if (!category) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Category not found'
        })
      }
    }

    const { data: updatedPlayer, error: updateError } = await supabase
      .from('players')
      .update(updateData)
      .eq('id', playerId)
      .select(`
        id,
        clerk_id,
        name,
        phone_number,
        category_id,
        category:categories(id, name, description, order),
        elo,
        status,
        deleted_at,
        created_at,
        updated_at
      `)
      .single()

    if (updateError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to update player',
        data: updateError
      })
    }

    return {
      success: true,
      message: 'Player updated successfully',
      player: updatedPlayer
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

