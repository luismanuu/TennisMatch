import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Notification types for match-related events
 */
export type NotificationType = 
  | 'match_proposal'      // Match proposed, needs acceptance
  | 'match_created'       // Match confirmed/created (e.g., tournament)
  | 'score_proposal'      // Score proposed, needs approval
  | 'schedule_proposal'   // Schedule proposed, needs approval
  | 'reschedule_proposal' // Reschedule requested
  | 'acceptance_change'   // Acceptance with schedule change

/**
 * Create a notification for a player about a match event
 * Non-critical operation - logs errors but doesn't throw
 * Uses upsert to handle duplicate notifications gracefully
 */
export async function createMatchNotification(
  supabase: SupabaseClient,
  playerId: string,
  matchId: string,
  type: NotificationType,
  metadata?: Record<string, any>
) {
  try {
    // First, check if notification already exists and is not dismissed
    const { data: existing } = await supabase
      .from('notifications')
      .select('id, is_dismissed')
      .eq('player_id', playerId)
      .eq('match_id', matchId)
      .eq('type', type)
      .eq('is_dismissed', false)
      .maybeSingle()
    
    // If notification exists and is not dismissed, return it (no need to create)
    if (existing) {
      console.log(`[Notifications] Notification ${type} already exists for player ${playerId}, match ${matchId}`)
      return existing
    }
    
    // Create new notification (or re-create if it was dismissed)
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        player_id: playerId,
        type,
        match_id: matchId,
        metadata: metadata || {}
      })
      .select()
      .single()
    
    if (error) {
      // Check if it's a duplicate key error (23505) - this is expected in race conditions
      if (error.code === '23505') {
        // Duplicate notification detected (race condition) - fetch the existing one
        const { data: existingNotification } = await supabase
          .from('notifications')
          .select()
          .eq('player_id', playerId)
          .eq('match_id', matchId)
          .eq('type', type)
          .eq('is_dismissed', false)
          .single()
        
        if (existingNotification) {
          // Successfully handled duplicate - not an error, just a race condition
          console.log(`[Notifications] Notification ${type} already exists (race condition handled), returning existing for player ${playerId}`)
          return existingNotification
        }
        
        // If we can't find it, log as warning (shouldn't happen)
        console.warn(`[Notifications] Duplicate key error but couldn't find existing notification for player ${playerId}, match ${matchId}, type ${type}`)
        return null
      }
      
      // Other errors are actual problems
      console.error(`[Notifications] Failed to create ${type} notification:`, error)
      return null
    }
    
    console.log(`[Notifications] Created ${type} notification for player ${playerId}`)
    return data
  } catch (err) {
    console.error('[Notifications] Exception creating notification:', err)
    return null
  }
}

/**
 * Auto-dismiss related notifications when player takes action
 * For example, when match is accepted, dismiss the proposal notification
 */
export async function dismissExistingNotifications(
  supabase: SupabaseClient,
  playerId: string,
  matchId: string,
  types: NotificationType[]
) {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ 
        is_dismissed: true, 
        dismissed_at: new Date().toISOString() 
      })
      .eq('player_id', playerId)
      .eq('match_id', matchId)
      .in('type', types)
      .eq('is_dismissed', false) // Only dismiss non-dismissed notifications
    
    if (error) {
      console.error(`[Notifications] Failed to dismiss notifications:`, error)
      return false
    }
    
    console.log(`[Notifications] Dismissed ${types.join(', ')} notifications for player ${playerId}`)
    return true
  } catch (err) {
    console.error('[Notifications] Exception dismissing notifications:', err)
    return false
  }
}

/**
 * Dismiss all notifications of specific types for a match (both players)
 * Useful when match is cancelled or completed
 */
export async function dismissMatchNotifications(
  supabase: SupabaseClient,
  matchId: string,
  types: NotificationType[]
) {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ 
        is_dismissed: true, 
        dismissed_at: new Date().toISOString() 
      })
      .eq('match_id', matchId)
      .in('type', types)
      .eq('is_dismissed', false)
    
    if (error) {
      console.error(`[Notifications] Failed to dismiss match notifications:`, error)
      return false
    }
    
    console.log(`[Notifications] Dismissed all ${types.join(', ')} notifications for match ${matchId}`)
    return true
  } catch (err) {
    console.error('[Notifications] Exception dismissing match notifications:', err)
    return false
  }
}
