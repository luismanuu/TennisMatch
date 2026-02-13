import { getSupabaseAdmin } from '~/server/utils/supabase'
import { updateClerkUserName } from '~/server/utils/clerk'
import { eloToMmr } from '~/server/utils/rating-system'
import { logger } from '~/server/utils/logger'
import type { UpdatePlayerPayload } from '~/types'
import { CATEGORY_SELECT_FULL, CITY_SELECT_FULL } from '~/server/utils/supabase-selects'

export default defineEventHandler(async (event) => {
  try {
    const playerId = getRouterParam(event, 'id')
    const body = await readBody<UpdatePlayerPayload & { clerk_id: string }>(event)
    const { clerk_id, name, phone_number, city_id, category_id } = body
    
    if (!playerId || !clerk_id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: id, clerk_id'
      })
    }
    
    const supabase = getSupabaseAdmin()
    
    // Verify the player exists and belongs to the clerk_id
    const { data: existingPlayer, error: fetchError } = await supabase
      .from('players')
      .select('*, category:categories(id, default_elo)')
      .eq('id', playerId)
      .eq('clerk_id', clerk_id)
      .single()
    
    if (fetchError || !existingPlayer) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Player profile not found or unauthorized'
      })
    }
    
    // If category_id is provided, verify it exists and get default_elo
    let newCategoryDefaultElo: number | null = null
    if (category_id !== undefined && category_id !== null) {
      const { data: category, error: categoryError } = await supabase
        .from('categories')
        .select('id, default_elo')
        .eq('id', category_id)
        .single()
      
      if (categoryError || !category) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid category_id'
        })
      }
      
      const defaultElo =
        category && typeof category === 'object' && typeof (category as { default_elo?: unknown }).default_elo === 'number'
          ? (category as { default_elo: number }).default_elo
          : null
      newCategoryDefaultElo = defaultElo ?? 1000
    }
    
    // If city_id is provided, verify it exists
    if (city_id) {
      const { data: city, error: cityError } = await supabase
        .from('cities')
        .select('id')
        .eq('id', city_id)
        .single()
      
      if (cityError || !city) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid city_id'
        })
      }
    }
    
    // Validate phone number format if provided
    if (phone_number !== undefined && phone_number !== null && phone_number.trim() !== '') {
      // Basic phone number validation (allows international formats)
      const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/
      if (!phoneRegex.test(phone_number.trim())) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid phone number format'
        })
      }
    }
    
    // Prepare update payload
    const updatePayload: Record<string, unknown> = {}
    if (name !== undefined) {
      updatePayload.name = name
    }
    if (phone_number !== undefined) {
      updatePayload.phone_number = phone_number && phone_number.trim() !== '' ? phone_number.trim() : null
    }
    if (city_id !== undefined) {
      if (!city_id) {
        throw createError({
          statusCode: 400,
          statusMessage: 'City is required for ranking and matchmaking'
        })
      }
      updatePayload.city_id = city_id
    }
    
    // Handle category change: only adjust ELO if player hasn't played any placement matches
    if (category_id !== undefined) {
      updatePayload.category_id = category_id
      
      // Check if category is actually changing
      const isCategoryChanging = category_id !== existingPlayer.category_id
      const hasNoPlacementMatches = (existingPlayer.placement_matches_completed || 0) === 0
      
      // Only adjust ELO if:
      // 1. Category is actually changing
      // 2. Player hasn't played any placement matches yet
      // 3. New category has a default_elo
      if (isCategoryChanging && hasNoPlacementMatches && newCategoryDefaultElo !== null) {
        updatePayload.elo = newCategoryDefaultElo
        updatePayload.mmr = eloToMmr(newCategoryDefaultElo)
      }
      // If player has already played matches, keep their current ELO (don't update it)
    }
    
    // Update player in Supabase
    const { data: updatedPlayer, error: updateError } = await supabase
      .from('players')
      .update(updatePayload)
      .eq('id', playerId)
      .select(`
        *,
        category:categories(${CATEGORY_SELECT_FULL}),
        city:cities(${CITY_SELECT_FULL})
      `)
      .single()
    
    if (updateError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to update player profile',
        data: updateError
      })
    }
    
    // If name changed, update Clerk user
    if (name && name !== existingPlayer.name) {
      try {
        await updateClerkUserName(clerk_id, name)
      } catch (clerkError) {
        // Log error but don't fail the request
        logger.error('Failed to update Clerk user name', clerkError, { playerId, clerkId: clerk_id })
      }
    }
    
    return updatedPlayer
  } catch (error: unknown) {
    handleApiError(error, 'PUT /api/players/[id]')
  }
})

