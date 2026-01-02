import type { Match, CreateMatchPayload, ProposeScorePayload, UpdateMatchStatusPayload } from '~/types'

export const useMatches = () => {
  const matches = ref<Match[]>([])
  const loading = ref(false)
  const error = ref<Error | null>(null)
  
  const fetchMatches = async () => {
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<Match[]>('/api/matches')
      matches.value = data
      return data
    } catch (err: any) {
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }
  
  const createMatch = async (clerkId: string, payload: CreateMatchPayload) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<Match>('/api/matches', {
        method: 'POST',
        body: {
          clerk_id: clerkId,
          ...payload
        }
      })
      // Add the new match to the beginning of the list
      matches.value = [data, ...matches.value]
      return data
    } catch (err: any) {
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }
  
  const getMatch = async (id: string) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<Match>(`/api/matches/${id}`)
      // Update match in cache if it exists
      const index = matches.value.findIndex(m => m.id === id)
      if (index !== -1) {
        matches.value[index] = data
      }
      return data
    } catch (err: any) {
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }
  
  const updateMatchStatus = async (clerkId: string, matchId: string, status: UpdateMatchStatusPayload['status']) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<Match>(`/api/matches/${matchId}`, {
        method: 'PUT',
        body: {
          clerk_id: clerkId,
          action: 'update_status',
          data: { status }
        }
      })
      // Update match in cache
      const index = matches.value.findIndex(m => m.id === matchId)
      if (index !== -1) {
        matches.value[index] = data
      }
      return data
    } catch (err: any) {
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }
  
  const proposeScore = async (clerkId: string, matchId: string, payload: ProposeScorePayload) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<Match>(`/api/matches/${matchId}`, {
        method: 'PUT',
        body: {
          clerk_id: clerkId,
          action: 'propose_score',
          data: payload
        }
      })
      // Update match in cache
      const index = matches.value.findIndex(m => m.id === matchId)
      if (index !== -1) {
        matches.value[index] = data
      }
      return data
    } catch (err: any) {
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }
  
  const approveScore = async (clerkId: string, matchId: string) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<Match>(`/api/matches/${matchId}`, {
        method: 'PUT',
        body: {
          clerk_id: clerkId,
          action: 'approve_score'
        }
      })
      // Update match in cache
      const index = matches.value.findIndex(m => m.id === matchId)
      if (index !== -1) {
        matches.value[index] = data
      }
      return data
    } catch (err: any) {
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }
  
  const rejectScore = async (clerkId: string, matchId: string) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<Match>(`/api/matches/${matchId}`, {
        method: 'PUT',
        body: {
          clerk_id: clerkId,
          action: 'reject_score'
        }
      })
      // Update match in cache
      const index = matches.value.findIndex(m => m.id === matchId)
      if (index !== -1) {
        matches.value[index] = data
      }
      return data
    } catch (err: any) {
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }
  
  const cancelMatch = async (clerkId: string, matchId: string) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<Match>(`/api/matches/${matchId}`, {
        method: 'PUT',
        body: {
          clerk_id: clerkId,
          action: 'cancel'
        }
      })
      // Update match in cache
      const index = matches.value.findIndex(m => m.id === matchId)
      if (index !== -1) {
        matches.value[index] = data
      }
      return data
    } catch (err: any) {
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }
  
  const fetchScheduledMatches = async (clerkId: string) => {
    loading.value = true
    error.value = null
    
    try {
      const allMatches = await fetchMatches()
      // Filter for scheduled matches
      return allMatches.filter(m => m.status === 'scheduled')
    } catch (err: any) {
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }
  
  return {
    matches: readonly(matches),
    loading: readonly(loading),
    error: readonly(error),
    fetchMatches,
    createMatch,
    getMatch,
    updateMatchStatus,
    proposeScore,
    approveScore,
    rejectScore,
    cancelMatch,
    fetchScheduledMatches
  }
}

