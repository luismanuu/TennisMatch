import type { PlayerSearchResult } from '~/types'

export const usePlayerSearch = () => {
  const results = ref<PlayerSearchResult[]>([])
  const loading = ref(false)
  const error = ref<Error | null>(null)
  
  // Debounce timer
  let debounceTimer: NodeJS.Timeout | null = null
  
  const searchPlayers = async (query: string, excludePlayerId?: string) => {
    // Clear previous debounce timer
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
    
    // If query is too short, clear results
    if (!query || query.trim().length < 2) {
      results.value = []
      return []
    }
    
    // Debounce the search
    return new Promise<PlayerSearchResult[]>((resolve, reject) => {
      debounceTimer = setTimeout(async () => {
        loading.value = true
        error.value = null
        
        try {
          const queryParams: any = { q: query.trim() }
          if (excludePlayerId) {
            queryParams.exclude_player_id = excludePlayerId
          }
          
          const data = await $fetch<PlayerSearchResult[]>('/api/players/search', {
            query: queryParams
          })
          results.value = data
          resolve(data)
        } catch (err: any) {
          error.value = err
          reject(err)
        } finally {
          loading.value = false
        }
      }, 300) // 300ms debounce
    })
  }
  
  const clearResults = () => {
    results.value = []
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
  }
  
  return {
    results: readonly(results),
    loading: readonly(loading),
    error: readonly(error),
    searchPlayers,
    clearResults
  }
}

