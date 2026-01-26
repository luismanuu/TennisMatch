/**
 * Utility function to update previous_rank for all players
 * This should be called periodically (e.g., daily) to track rank changes
 * 
 * @param supabase - Supabase admin client
 * @returns Number of players updated
 */
export async function updatePreviousRanks(supabase: any): Promise<number> {
  try {
    // Get all active players ordered by ELO (current ranking)
    const { data: players, error: fetchError } = await supabase
      .from('players')
      .select('id, elo')
      .eq('status', 'active')
      .order('elo', { ascending: false })
    
    if (fetchError) {
      console.error('Error fetching players for rank update:', fetchError)
      throw fetchError
    }
    
    if (!players || players.length === 0) {
      console.log('No players found to update ranks')
      return 0
    }
    
    // Calculate current rank for each player
    // Players are already sorted by ELO descending, so rank = index + 1
    const updates = players.map((player: any, index: number) => ({
      id: player.id,
      previous_rank: index + 1
    }))
    
    // Update all players in batches to avoid overwhelming the database
    const batchSize = 100
    let updatedCount = 0
    
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize)
      
      // Use Promise.all to update batch in parallel
      const updatePromises = batch.map(async (update: any) => {
        const { error } = await supabase
          .from('players')
          .update({ previous_rank: update.previous_rank })
          .eq('id', update.id)
        
        if (error) {
          console.error(`Error updating previous_rank for player ${update.id}:`, error)
          return false
        }
        return true
      })
      
      const results = await Promise.all(updatePromises)
      updatedCount += results.filter(r => r === true).length
    }
    
    console.log(`Updated previous_rank for ${updatedCount} players`)
    return updatedCount
  } catch (error: any) {
    console.error('Error updating previous ranks:', error)
    throw error
  }
}
