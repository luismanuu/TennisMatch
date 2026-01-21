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
 */
export async function createMatchNotification(
  supabase: SupabaseClient,
  playerId: string,
  matchId: string,
  type: NotificationType,
  metadata?: Record<string, any>
) {
  try {
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
