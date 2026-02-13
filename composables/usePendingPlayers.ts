import type { PendingPlayer, Player, CreatePendingPlayerPayload } from '~/types'

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(typeof err === 'string' ? err : 'Unknown error')
}

function hasStatusCode(err: unknown, code: number): boolean {
  return typeof err === 'object' && err !== null && 'statusCode' in err && (err as { statusCode: number }).statusCode === code
}

export const usePendingPlayers = () => {
  const loading = ref(false)
  const error = ref<Error | null>(null)
  const publicPendingPlayer = ref<PendingPlayer | null>(null)
  const publicPendingLoading = ref(false)
  const publicPendingError = ref<Error | null>(null)
  
  const createPendingPlayer = async (clerkId: string, payload: CreatePendingPlayerPayload) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<PendingPlayer>('/api/pending-players', {
        method: 'POST',
        body: {
          clerk_id: clerkId,
          ...payload
        }
      })
      return data
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }
  
  const getInvitation = async (token: string) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<PendingPlayer>(`/api/pending-players/invitation/${token}`)
      return data
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }
  
  const acceptInvitation = async (pendingPlayerId: string, clerkId: string) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<{ success: boolean; player?: Player; player_id?: string; message: string }>(`/api/pending-players/${pendingPlayerId}`, {
        method: 'PUT',
        body: {
          clerk_id: clerkId
        }
      })
      return data
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }
  
  const fetchPublicPendingPlayer = async (pendingPlayerId: string) => {
    if (!pendingPlayerId) {
      publicPendingPlayer.value = null
      return null
    }
    
    publicPendingLoading.value = true
    publicPendingError.value = null
    
    try {
      const data = await $fetch<PendingPlayer | null>(`/api/pending-players/${pendingPlayerId}`, {
        method: 'GET'
      }).catch((err: unknown) => {
        // Handle 404 gracefully - pending player doesn't exist
        if (hasStatusCode(err, 404)) {
          return null
        }
        // Re-throw other errors
        throw err
      })
      
      publicPendingPlayer.value = data
      return data
    } catch (err: unknown) {
      // Only set error for unexpected errors, not for missing pending players
      if (err !== null && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode !== 404) {
        publicPendingError.value = toError(err)
        console.error('Error fetching public pending player:', err)
      }
      publicPendingPlayer.value = null
      return null
    } finally {
      publicPendingLoading.value = false
    }
  }
  
  return {
    loading: readonly(loading),
    error: readonly(error),
    publicPendingPlayer: readonly(publicPendingPlayer),
    publicPendingLoading: readonly(publicPendingLoading),
    publicPendingError: readonly(publicPendingError),
    createPendingPlayer,
    getInvitation,
    acceptInvitation,
    fetchPublicPendingPlayer
  }
}

