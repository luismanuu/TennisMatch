import type { Player, CreatePlayerPayload, UpdatePlayerPayload } from '~/types'

export const usePlayer = () => {
  const player = ref<Player | null>(null)
  const loading = ref(false)
  const error = ref<Error | null>(null)
  const publicPlayer = ref<Player | null>(null)
  const publicLoading = ref(false)
  const publicError = ref<Error | null>(null)
  
  const fetchPlayer = async (accountId: string) => {
    if (!accountId) {
      player.value = null
      return null
    }
    
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<Player | null>('/api/players/me', {
        query: {}
      }).catch((err: any) => {
        // Handle 404/401 gracefully - profile doesn't exist yet
        if (err.statusCode === 404 || err.statusCode === 401) {
          return null
        }
        // Re-throw other errors
        throw err
      })
      
      player.value = data
      return data
    } catch (err: any) {
      // Only set error for unexpected errors, not for missing profiles
      if (err.statusCode && err.statusCode !== 404 && err.statusCode !== 401) {
        error.value = err
        console.error('Error fetching player:', err)
      }
      player.value = null
      return null
    } finally {
      loading.value = false
    }
  }
  
  const createPlayer = async (accountId: string, payload: CreatePlayerPayload) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<Player>('/api/players/me', {
        method: 'POST',
        body: {
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
  
  const updatePlayer = async (playerId: string, accountId: string, payload: UpdatePlayerPayload) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<Player>(`/api/players/${playerId}`, {
        method: 'PUT',
        body: {
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
      }).catch((err: any) => {
        // Handle 404 gracefully - player doesn't exist
        if (err.statusCode === 404) {
          return null
        }
        // Re-throw other errors
        throw err
      })
      
      publicPlayer.value = data
      return data
    } catch (err: any) {
      // Only set error for unexpected errors, not for missing players
      if (err.statusCode && err.statusCode !== 404) {
        publicError.value = err
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

