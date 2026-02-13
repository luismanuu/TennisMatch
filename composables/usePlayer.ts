import type { Player, CreatePlayerPayload, UpdatePlayerPayload } from '~/types'

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(typeof err === 'string' ? err : 'Unknown error')
}

function hasStatusCode(err: unknown, code: number): boolean {
  return typeof err === 'object' && err !== null && 'statusCode' in err && (err as { statusCode: number }).statusCode === code
}

// Shared cache across all composable instances to prevent duplicate API calls
const ongoingFetches = new Map<string, Promise<Player | null>>()
const playerCache = new Map<string, { player: Player | null; timestamp: number }>()
const CACHE_TTL = 5000 // 5 seconds cache

export const usePlayer = () => {
  const player = ref<Player | null>(null)
  const loading = ref(false)
  const error = ref<Error | null>(null)
  const publicPlayer = ref<Player | null>(null)
  const publicLoading = ref(false)
  const publicError = ref<Error | null>(null)
  
  const fetchPlayer = async (clerkId: string) => {
    if (!clerkId) {
      player.value = null
      return null
    }
    
    // Check if there's an ongoing fetch for this clerkId (across all instances)
    const ongoingFetch = ongoingFetches.get(clerkId)
    if (ongoingFetch) {
      // Wait for the existing fetch and update local state
      const result = await ongoingFetch
      player.value = result
      return result
    }
    
    // Check cache (with TTL)
    const cached = playerCache.get(clerkId)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      player.value = cached.player
      return cached.player
    }
    
    // If already loading in this instance, return current value
    if (loading.value) {
      return player.value
    }
    
    loading.value = true
    error.value = null
    
    // Create and store the fetch promise globally to prevent duplicate calls across instances
    const fetchPromise = (async () => {
      try {
        const data = await $fetch<Player | null>('/api/players/me', {
          query: { clerk_id: clerkId }
        }).catch((err: unknown) => {
          // Handle 404/401 gracefully - profile doesn't exist yet
          if (hasStatusCode(err, 404) || hasStatusCode(err, 401)) {
            return null
          }
          // Re-throw other errors
          throw err
        })
        
        // Update cache
        playerCache.set(clerkId, { player: data, timestamp: Date.now() })
        
        // Update local state
        player.value = data
        return data
      } catch (err: unknown) {
        // Only set error for unexpected errors, not for missing profiles
        if (err !== null && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode !== 404 && (err as { statusCode: number }).statusCode !== 401) {
          error.value = toError(err)
          console.error('Error fetching player:', err)
        }
        player.value = null
        return null
      } finally {
        loading.value = false
        // Remove from ongoing fetches
        ongoingFetches.delete(clerkId)
      }
    })()
    
    // Store the promise globally
    ongoingFetches.set(clerkId, fetchPromise)
    
    return fetchPromise
  }
  
  const createPlayer = async (clerkId: string, payload: CreatePlayerPayload) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<Player>('/api/players/me', {
        method: 'POST',
        body: {
          clerk_id: clerkId,
          ...payload
        }
      })
      player.value = data
      return data
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }
  
  const updatePlayer = async (playerId: string, clerkId: string, payload: UpdatePlayerPayload) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<Player>(`/api/players/${playerId}`, {
        method: 'PUT',
        body: {
          clerk_id: clerkId,
          ...payload
        }
      })
      player.value = data
      return data
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }
  
  const fetchPublicPlayer = async (playerId: string) => {
    if (!playerId) {
      publicPlayer.value = null
      return null
    }
    
    publicLoading.value = true
    publicError.value = null
    
    try {
      const data = await $fetch<Player | null>(`/api/players/${playerId}`, {
        method: 'GET'
      }).catch((err: unknown) => {
        // Handle 404 gracefully - player doesn't exist
        if (hasStatusCode(err, 404)) {
          return null
        }
        // Re-throw other errors
        throw err
      })
      
      publicPlayer.value = data
      return data
    } catch (err: unknown) {
      // Only set error for unexpected errors, not for missing players
      if (err !== null && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode !== 404) {
        publicError.value = toError(err)
        console.error('Error fetching public player:', err)
      }
      publicPlayer.value = null
      return null
    } finally {
      publicLoading.value = false
    }
  }
  
  return {
    player: readonly(player),
    loading: readonly(loading),
    error: readonly(error),
    publicPlayer: readonly(publicPlayer),
    publicLoading: readonly(publicLoading),
    publicError: readonly(publicError),
    fetchPlayer,
    createPlayer,
    updatePlayer,
    fetchPublicPlayer
  }
}

