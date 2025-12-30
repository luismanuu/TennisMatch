import type { Player, CreatePlayerPayload, UpdatePlayerPayload } from '~/types'

export const usePlayer = () => {
  const player = ref<Player | null>(null)
  const loading = ref(false)
  const error = ref<Error | null>(null)
  
  const fetchPlayer = async (clerkId: string) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<Player | null>('/api/players/me', {
        query: { clerk_id: clerkId }
      })
      player.value = data
      return data
    } catch (err: any) {
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
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
    } catch (err: any) {
      error.value = err
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
    } catch (err: any) {
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }
  
  return {
    player: readonly(player),
    loading: readonly(loading),
    error: readonly(error),
    fetchPlayer,
    createPlayer,
    updatePlayer
  }
}

