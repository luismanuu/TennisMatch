import { getSupabaseAdmin } from '~/server/utils/supabase'
import { getClerkUser } from '~/server/utils/clerk'
import type { CreateMatchPayload } from '~/types'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<CreateMatchPayload & { clerk_id: string }>(event)
    const { clerk_id, player1_id, player2_id, pending_player2_id, scheduled_at, location } = body
    
    if (!clerk_id || !player1_id || !scheduled_at) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: clerk_id, player1_id, scheduled_at'
      })
    }
    
    // Validate scheduled_at is not in the past
    const scheduledDate = new Date(scheduled_at)
    const now = new Date()
    
    if (scheduledDate < now) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Cannot schedule a match in the past'
      })
    }
    
    // Validate that either player2_id or pending_player2_id is provided, but not both
    if (!player2_id && !pending_player2_id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Either player2_id or pending_player2_id must be provided'
      })
    }
    
    if (player2_id && pending_player2_id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Cannot provide both player2_id and pending_player2_id'
      })
    }
    
    // Verify Clerk user exists
    await getClerkUser(clerk_id)
    
    const supabase = getSupabaseAdmin()
    
    // Verify player1 exists and belongs to the authenticated user
    const { data: player1, error: player1Error } = await supabase
      .from('players')
      .select('id, clerk_id')
      .eq('id', player1_id)
      .eq('clerk_id', clerk_id)
      .single()
    
    if (player1Error || !player1) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Unauthorized: player1_id does not match authenticated user'
      })
    }
    
    // If player2_id is provided, verify it exists
    if (player2_id) {
      const { data: player2, error: player2Error } = await supabase
        .from('players')
        .select('id')
        .eq('id', player2_id)
        .single()
      
      if (player2Error || !player2) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid player2_id'
        })
      }
    }
    
    // If pending_player2_id is provided, verify it exists
    if (pending_player2_id) {
      const { data: pendingPlayer, error: pendingPlayerError } = await supabase
        .from('pending_players')
        .select('id, invited_by_player_id, status')
        .eq('id', pending_player2_id)
        .single()
      
      if (pendingPlayerError || !pendingPlayer) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid pending_player2_id'
        })
      }
      
      // Verify the pending player was invited by the current user
      if (pendingPlayer.invited_by_player_id !== player1_id) {
        throw createError({
          statusCode: 403,
          statusMessage: 'Unauthorized: pending player was not invited by you'
        })
      }
    }
    
    // Create the match with status 'scheduled'
    const matchData: any = {
      player1_id,
      scheduled_at: new Date(scheduled_at).toISOString(),
      status: 'scheduled',
      location: location || null
    }
    
    if (player2_id) {
      matchData.player2_id = player2_id
    } else {
      matchData.pending_player2_id = pending_player2_id
    }
    
    const { data: match, error: createError } = await supabase
      .from('matches')
      .insert(matchData)
      .select(`
        *,
        player1:players!matches_player1_id_fkey(
          id,
          name,
          category:categories(id, name, description, order)
        ),
        player2:players!matches_player2_id_fkey(
          id,
          name,
          category:categories(id, name, description, order)
        ),
        pending_player2:pending_players(
          id,
          name,
          email,
          category:categories(id, name, description, order),
          status
        ),
        score_proposed_by_player:players!matches_score_proposed_by_fkey(
          id,
          name
        ),
        score_approved_by_player:players!matches_score_approved_by_fkey(
          id,
          name
        ),
        winner:players!matches_winner_id_fkey(
          id,
          name
        )
      `)
      .single()
    
    if (createError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to create match',
        data: createError
      })
    }
    
    return match
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

