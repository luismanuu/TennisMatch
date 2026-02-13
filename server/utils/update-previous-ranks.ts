import { logger } from './logger'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Utility function to update previous_rank for all players
 * This should be called periodically (e.g., daily) to track rank changes
 * 
 * @param supabase - Supabase admin client
 * @returns Number of players updated
 */
export async function updatePreviousRanks(supabase: SupabaseClient): Promise<number> {
  try {
    // Get all active players ordered by ELO (current ranking)
    const { data: players, error: fetchError } = await supabase
      .from('players')
      .select('id, elo')
      .eq('status', 'active')
      .order('elo', { ascending: false })
    
    if (fetchError) {
      logger.error('Error fetching players for rank update', fetchError)
      throw fetchError
    }
    
    if (!players || players.length === 0) {
      logger.info('No players found to update ranks')
      return 0
    }
    
    // Calculate current rank for each player
    // Players are already sorted by ELO descending, so rank = index + 1
    const typedPlayers = players as unknown as Array<{ id: string; elo: number | null }>
    const updates = typedPlayers.map((player, index: number) => ({
      id: player.id,
      previous_rank: index + 1
    }))
    
    // Update all players in batches to avoid overwhelming the database
    const batchSize = 100
    let updatedCount = 0
    
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize)
      
      // Use Promise.all to update batch in parallel
      const updatePromises = batch.map(async (update) => {
        const { error } = await supabase
          .from('players')
          .update({ previous_rank: update.previous_rank })
          .eq('id', update.id)
        
        if (error) {
          logger.error('Error updating previous_rank for player', error, { playerId: update.id })
          return false
        }
        return true
      })
      
      const results = await Promise.all(updatePromises)
      updatedCount += results.filter(r => r === true).length
    }
    
    logger.info('Updated previous_rank for players', { updatedCount })
    return updatedCount
  } catch (error: unknown) {
    logger.error('Error updating previous ranks', error)
    throw error
  }
}
