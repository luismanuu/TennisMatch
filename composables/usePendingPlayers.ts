import type { PendingPlayer, CreatePendingPlayerPayload } from '~/types'

export const usePendingPlayers = () => {
  const loading = ref(false)
  const error = ref<Error | null>(null)
  
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
  
  return {
    loading: readonly(loading),
    error: readonly(error),
    createPendingPlayer,
    getInvitation,
    acceptInvitation
  }
}

