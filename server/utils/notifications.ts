import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from './logger'

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
  metadata?: Record<string, unknown>
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
      logger.debug('Notification already exists', { type, playerId, matchId })
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
          logger.debug('Notification already exists (race condition handled)', { type, playerId, matchId })
          return existingNotification
        }
        
        // If we can't find it, log as warning (shouldn't happen)
        logger.warn('Duplicate key error but could not find existing notification', { type, playerId, matchId })
        return null
      }
      
      // Other errors are actual problems
      logger.error('Failed to create notification', error, { type, playerId, matchId })
      return null
    }
    
    logger.debug('Created notification', { type, playerId, matchId, notificationId: data.id })
    return data
  } catch (err) {
    logger.error('Exception creating notification', err, { type, playerId, matchId })
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
      logger.error('Failed to dismiss notifications', error, { playerId, matchId, types })
      return false
    }
    
    logger.debug('Dismissed notifications', { playerId, matchId, types })
    return true
  } catch (err) {
    logger.error('Exception dismissing notifications', err, { playerId, matchId, types })
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
      logger.error('Failed to dismiss match notifications', error, { matchId, types })
      return false
    }
    
    logger.debug('Dismissed all match notifications', { matchId, types })
    return true
  } catch (err) {
    logger.error('Exception dismissing match notifications', err, { matchId, types })
    return false
  }
}
