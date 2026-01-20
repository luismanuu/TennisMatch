import { getSupabaseAdmin } from '~/server/utils/supabase'
import { getClerkUser } from '~/server/utils/clerk'
import type { CreatePlayerPayload } from '~/types'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<CreatePlayerPayload & { clerk_id: string }>(event)
    const { clerk_id, name, phone_number, city_id, category_id } = body
    
    if (!clerk_id || !name || !category_id || !city_id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: clerk_id, name, category_id, city_id'
      })
    }
    
    // Verify city exists
    const supabase = getSupabaseAdmin()
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
    
    // Verify Clerk user exists
    let clerkUser
    try {
      clerkUser = await getClerkUser(clerk_id)
    } catch (clerkError: any) {
      console.error('Clerk user verification error:', clerkError)
      throw createError({
        statusCode: 404,
        statusMessage: 'Clerk user not found',
        data: clerkError
      })
    }
    
    // Verify category exists
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
    const { data: player, error: insertError } = await supabase
      .from('players')
      .insert({
        clerk_id,
        name,
        phone_number: phone_number || null,
        city_id,
        category_id,
        elo: 1000
      })
      .select(`
        *,
        category:categories(*),
        city:cities(*)
      `)
      .single()
    
    if (insertError) {
      console.error('Supabase insert error:', insertError)
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to create player profile',
        data: insertError
      })
    }
    
    return player
  } catch (error: any) {
    console.error('Error in /api/players/me POST:', error)
    
    // If it's already a createError, re-throw it
    if (error.statusCode) {
      throw error
    }
    
    // Otherwise, wrap it
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Internal server error',
      data: error.data || error
    })
  }
})

