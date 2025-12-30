import { getSupabaseAdmin } from '~/server/utils/supabase'
import { updateClerkUserName } from '~/server/utils/clerk'
import type { UpdatePlayerPayload } from '~/types'

export default defineEventHandler(async (event) => {
  try {
    const playerId = getRouterParam(event, 'id')
    const body = await readBody<UpdatePlayerPayload & { clerk_id: string }>(event)
    const { clerk_id, name, category_id } = body
    
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
      .select('*')
      .eq('id', playerId)
      .eq('clerk_id', clerk_id)
      .single()
    
    if (fetchError || !existingPlayer) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Player profile not found or unauthorized'
      })
    }
    
    // If category_id is provided, verify it exists
    if (category_id) {
      const { data: category, error: categoryError } = await supabase
        .from('categories')
        .select('id')
        .eq('id', category_id)
        .single()
      
      if (categoryError || !category) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid category_id'
        })
      }
    }
    
    // Prepare update payload
    const updatePayload: any = {}
    if (name !== undefined) {
      updatePayload.name = name
    }
    if (category_id !== undefined) {
      updatePayload.category_id = category_id
    }
    
    // Update player in Supabase
    const { data: updatedPlayer, error: updateError } = await supabase
      .from('players')
      .update(updatePayload)
      .eq('id', playerId)
      .select(`
        *,
        category:categories(*)
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
        console.error('Failed to update Clerk user name:', clerkError)
      }
    }
    
    return updatedPlayer
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

