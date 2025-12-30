import { getSupabaseAdmin } from '~/server/utils/supabase'
import { getClerkUser } from '~/server/utils/clerk'
import type { CreatePlayerPayload } from '~/types'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<CreatePlayerPayload & { clerk_id: string }>(event)
    const { clerk_id, name, category_id } = body
    
    if (!clerk_id || !name || !category_id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: clerk_id, name, category_id'
      })
    }
    
    // Verify Clerk user exists
    const clerkUser = await getClerkUser(clerk_id)
    
    // Verify category exists
    const supabase = getSupabaseAdmin()
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
    
    // Check if player already exists
    const { data: existingPlayer } = await supabase
      .from('players')
      .select('id')
      .eq('clerk_id', clerk_id)
      .single()
    
    if (existingPlayer) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Player profile already exists'
      })
    }
    
    // Create player profile
    const { data: player, error: createError } = await supabase
      .from('players')
      .insert({
        clerk_id,
        name,
        category_id,
        elo: 1000
      })
      .select(`
        *,
        category:categories(*)
      `)
      .single()
    
    if (createError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to create player profile',
        data: createError
      })
    }
    
    return player
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

