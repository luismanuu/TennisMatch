import { getSupabaseAdmin } from '~/server/utils/supabase'
import { getClerkUser } from '~/server/utils/clerk'
import { logger } from '~/server/utils/logger'
import { ValidationError, ConflictError, NotFoundError, InternalServerError, handleApiError } from '~/server/utils/errors'
import { validateBody, createPlayerWithClerkSchema } from '~/server/utils/validation'
import { CATEGORY_SELECT_FULL, CITY_SELECT_FULL } from '~/server/utils/supabase-selects'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    
    // Validate request body with Zod
    const validatedBody = validateBody(createPlayerWithClerkSchema, body)
    
    const { clerk_id, name, phone_number, city_id, category_id } = validatedBody
    
    // Verify city exists
    const supabase = getSupabaseAdmin()
    const { data: city, error: cityError } = await supabase
      .from('cities')
      .select('id')
      .eq('id', city_id)
      .single()
    
    if (cityError || !city) {
      throw new ValidationError('Invalid city_id')
    }
    
    // Verify Clerk user exists
    let clerkUser
    try {
      clerkUser = await getClerkUser(clerk_id)
    } catch (clerkError: unknown) {
      logger.error('Clerk user verification error', clerkError, { clerk_id })
      throw new NotFoundError('Clerk user not found', { clerk_id })
    }
    
    // Verify category exists and get default_elo
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .select('id, default_elo')
      .eq('id', category_id)
      .single()
    
    if (categoryError || !category) {
      throw new ValidationError('Invalid category_id')
    }
    
    // Use category's default_elo or fallback to 1000
    const categoryRecord = asRecord(category)
    const initialElo =
      categoryRecord && typeof categoryRecord['default_elo'] === 'number'
        ? (categoryRecord['default_elo'] as number)
        : 1000
    
    // Check if player already exists
    const { data: existingPlayer } = await supabase
      .from('players')
      .select('id')
      .eq('clerk_id', clerk_id)
      .single()
    
    if (existingPlayer) {
      throw new ConflictError('Player profile already exists', { clerk_id })
    }
    
    // Calculate initial MMR from ELO
    const initialMmr = (initialElo - 2250) / 750
    
    // Create player profile with category's default ELO
    const { data: player, error: insertError } = await supabase
      .from('players')
      .insert({
        clerk_id,
        name,
        phone_number: phone_number || null,
        city_id,
        category_id,
        elo: initialElo,
        mmr: initialMmr,
        mmr_uncertainty: 2.0  // Initial uncertainty for new players
      })
      .select(`
        *,
        category:categories(${CATEGORY_SELECT_FULL}),
        city:cities(${CITY_SELECT_FULL})
      `)
      .single()
    
    if (insertError) {
      logger.error('Supabase insert error', insertError, { clerk_id, name })
      throw new InternalServerError('Failed to create player profile', { insertError })
    }
    
    logger.info('Player profile created successfully', { player_id: player.id, clerk_id, name })
    return player
  } catch (error: unknown) {
    handleApiError(error, 'POST /api/players/me')
  }
})

