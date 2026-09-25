import type { Match, CreateMatchPayload, ProposeScorePayload, UpdateMatchStatusPayload, ProposeReschedulePayload } from '~/types'

export const useMatches = () => {
  const matches = ref<Match[]>([])
  const loading = ref(false)
  const error = ref<Error | null>(null)
  const pagination = ref<{
    page: number
    limit: number
    total: number
    totalPages: number
    hasMore: boolean
  } | null>(null)
  
  interface MatchFilters {
    status?: string
    start_date?: string
    end_date?: string
    skip_24h_filter?: boolean
    opponent_id?: string
  }
  
  const fetchMatches = async (accountId?: string, page: number = 1, limit: number = 10, filters?: MatchFilters) => {
    loading.value = true
    error.value = null
    
    try {
      // Get the account id from auth state if not provided
      if (!accountId) {
        const { userId } = useAuthState()
        if (!userId.value) {
          throw new Error('User not authenticated')
        }
        accountId = userId.value
      }
      
      const queryParams: any = { page, limit }
      if (filters?.status) queryParams.status = filters.status
      if (filters?.start_date) queryParams.start_date = filters.start_date
      if (filters?.end_date) queryParams.end_date = filters.end_date
      if (filters?.skip_24h_filter) queryParams.skip_24h_filter = 'true'
      if (filters?.opponent_id) queryParams.opponent_id = filters.opponent_id
      
      const response = await $fetch<{
        matches: Match[]
        pagination: {
          page: number
          limit: number
          total: number
          totalPages: number
          hasMore: boolean
        }
      }>('/api/matches', {
        query: queryParams
      })
      
      matches.value = response.matches
      pagination.value = response.pagination
      
      return response.matches
    } catch (err: any) {
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }
  
  const createMatch = async (accountId: string, payload: CreateMatchPayload) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<Match>('/api/matches', {
        method: 'POST',
        body: {
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
  
  const getMatch = async (id: string, accountId?: string) => {
    loading.value = true
    error.value = null
    
    try {
      // Get the account id from auth state if not provided
      if (!accountId) {
        const { userId } = useAuthState()
        if (!userId.value) {
          throw new Error('User not authenticated')
        }
        accountId = userId.value
      }
      
      const data = await $fetch<Match>(`/api/matches/${id}`, {
        query: {}
      })
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
  
  const updateMatchStatus = async (accountId: string, matchId: string, status: UpdateMatchStatusPayload['status']) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<Match>(`/api/matches/${matchId}`, {
        method: 'PUT',
        body: {
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
  
  const proposeScore = async (accountId: string, matchId: string, payload: ProposeScorePayload) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<Match>(`/api/matches/${matchId}`, {
        method: 'PUT',
        body: {
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
  
  const approveScore = async (accountId: string, matchId: string) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<Match>(`/api/matches/${matchId}`, {
        method: 'PUT',
        body: {
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
  
  const rejectScore = async (accountId: string, matchId: string) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<Match>(`/api/matches/${matchId}`, {
        method: 'PUT',
        body: {
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
  
  const cancelMatch = async (accountId: string, matchId: string) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<Match>(`/api/matches/${matchId}`, {
        method: 'PUT',
        body: {
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
  
  const fetchScheduledMatches = async (accountId: string) => {
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
  
  const proposeSchedule = async (accountId: string, matchId: string, payload: { scheduled_at: string }) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<Match>(`/api/matches/${matchId}`, {
        method: 'PUT',
        body: {
          action: 'propose_schedule',
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
  
  const approveSchedule = async (accountId: string, matchId: string) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<Match>(`/api/matches/${matchId}`, {
        method: 'PUT',
        body: {
          action: 'approve_schedule'
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
  
  const rejectSchedule = async (accountId: string, matchId: string) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<Match>(`/api/matches/${matchId}`, {
        method: 'PUT',
        body: {
          action: 'reject_schedule'
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
  
  const proposeReschedule = async (accountId: string, matchId: string, payload: ProposeReschedulePayload) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<Match>(`/api/matches/${matchId}`, {
        method: 'PUT',
        body: {
          action: 'propose_reschedule',
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
  
  const approveReschedule = async (accountId: string, matchId: string) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<Match>(`/api/matches/${matchId}`, {
        method: 'PUT',
        body: {
          action: 'approve_reschedule'
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
  
  const rejectReschedule = async (accountId: string, matchId: string) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<Match>(`/api/matches/${matchId}`, {
        method: 'PUT',
        body: {
          action: 'reject_reschedule'
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
  
  const organizerSetResult = async (accountId: string, matchId: string, payload: { score?: string, winner_id: string, is_wo?: boolean }) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<Match>(`/api/matches/${matchId}`, {
        method: 'PUT',
        body: {
          action: 'organizer_set_result',
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
  
  const acceptMatch = async (accountId: string, matchId: string, payload?: { scheduled_at?: string, location?: string }) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<Match>(`/api/matches/${matchId}`, {
        method: 'PUT',
        body: {
          action: 'accept_match',
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
  
  const rejectMatch = async (accountId: string, matchId: string) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<Match>(`/api/matches/${matchId}`, {
        method: 'PUT',
        body: {
          action: 'reject_match'
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
  
  const approveAcceptanceChange = async (accountId: string, matchId: string) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<Match>(`/api/matches/${matchId}`, {
        method: 'PUT',
        body: {
          action: 'approve_acceptance_change'
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
  
  const rejectAcceptanceChange = async (accountId: string, matchId: string) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<Match>(`/api/matches/${matchId}`, {
        method: 'PUT',
        body: {
          action: 'reject_acceptance_change'
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
  
  return {
    matches: readonly(matches),
    pagination: readonly(pagination),
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
    proposeSchedule,
    approveSchedule,
    rejectSchedule,
    fetchScheduledMatches,
    proposeReschedule,
    approveReschedule,
    rejectReschedule,
    organizerSetResult,
    acceptMatch,
    rejectMatch,
    approveAcceptanceChange,
    rejectAcceptanceChange
  }
}

