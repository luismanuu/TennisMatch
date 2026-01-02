import type { PendingPlayer, CreatePendingPlayerPayload } from '~/types'

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
    } catch (err: any) {
      error.value = err
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
    } catch (err: any) {
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }
  
  const acceptInvitation = async (pendingPlayerId: string, clerkId: string) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<{ success: boolean; player?: any; player_id?: string; message: string }>(`/api/pending-players/${pendingPlayerId}`, {
        method: 'PUT',
        body: {
          clerk_id: clerkId
        }
      })
      return data
    } catch (err: any) {
      error.value = err
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
      }).catch((err: any) => {
        // Handle 404 gracefully - pending player doesn't exist
        if (err.statusCode === 404) {
          return null
        }
        // Re-throw other errors
        throw err
      })
      
      publicPendingPlayer.value = data
      return data
    } catch (err: any) {
      // Only set error for unexpected errors, not for missing pending players
      if (err.statusCode && err.statusCode !== 404) {
        publicPendingError.value = err
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

