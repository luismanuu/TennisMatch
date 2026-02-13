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

  const toError = (err: unknown): Error => {
    if (err instanceof Error) return err
    return new Error(typeof err === 'string' ? err : 'Unknown error')
  }
  
  const fetchMatches = async (clerkId?: string, page: number = 1, limit: number = 10, filters?: MatchFilters) => {
    loading.value = true
    error.value = null
    
    try {
      // Get clerkId from auth state if not provided
      if (!clerkId) {
        const { userId } = useAuthState()
        if (!userId.value) {
          throw new Error('User not authenticated')
        }
        clerkId = userId.value
      }
      
      const queryParams: Record<string, string | number> = { clerk_id: clerkId, page, limit }
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
    } catch (err: unknown) {
      error.value = toError(err)
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
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }
  
  const getMatch = async (id: string, clerkId?: string) => {
    loading.value = true
    error.value = null
    
    try {
      // Get clerkId from auth state if not provided
      if (!clerkId) {
        const { userId } = useAuthState()
        if (!userId.value) {
          throw new Error('User not authenticated')
        }
        clerkId = userId.value
      }
      
      const data = await $fetch<Match>(`/api/matches/${id}`, {
        query: { clerk_id: clerkId }
      })
      // Update match in cache if it exists
      const index = matches.value.findIndex(m => m.id === id)
      if (index !== -1) {
        matches.value[index] = data
      }
      return data
    } catch (err: unknown) {
      error.value = toError(err)
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
    } catch (err: unknown) {
      error.value = toError(err)
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
    } catch (err: unknown) {
      error.value = toError(err)
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
    } catch (err: unknown) {
      error.value = toError(err)
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
    } catch (err: unknown) {
      error.value = toError(err)
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
    } catch (err: unknown) {
      error.value = toError(err)
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
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }
  
  const proposeSchedule = async (clerkId: string, matchId: string, payload: { scheduled_at: string }) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<Match>(`/api/matches/${matchId}`, {
        method: 'PUT',
        body: {
          clerk_id: clerkId,
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
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }
  
  const approveSchedule = async (clerkId: string, matchId: string) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<Match>(`/api/matches/${matchId}`, {
        method: 'PUT',
        body: {
          clerk_id: clerkId,
          action: 'approve_schedule'
        }
      })
      // Update match in cache
      const index = matches.value.findIndex(m => m.id === matchId)
      if (index !== -1) {
        matches.value[index] = data
      }
      return data
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }
  
  const rejectSchedule = async (clerkId: string, matchId: string) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<Match>(`/api/matches/${matchId}`, {
        method: 'PUT',
        body: {
          clerk_id: clerkId,
          action: 'reject_schedule'
        }
      })
      // Update match in cache
      const index = matches.value.findIndex(m => m.id === matchId)
      if (index !== -1) {
        matches.value[index] = data
      }
      return data
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }
  
  const proposeReschedule = async (clerkId: string, matchId: string, payload: ProposeReschedulePayload) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<Match>(`/api/matches/${matchId}`, {
        method: 'PUT',
        body: {
          clerk_id: clerkId,
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
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }
  
  const approveReschedule = async (clerkId: string, matchId: string) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<Match>(`/api/matches/${matchId}`, {
        method: 'PUT',
        body: {
          clerk_id: clerkId,
          action: 'approve_reschedule'
        }
      })
      // Update match in cache
      const index = matches.value.findIndex(m => m.id === matchId)
      if (index !== -1) {
        matches.value[index] = data
      }
      return data
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }
  
  const rejectReschedule = async (clerkId: string, matchId: string) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<Match>(`/api/matches/${matchId}`, {
        method: 'PUT',
        body: {
          clerk_id: clerkId,
          action: 'reject_reschedule'
        }
      })
      // Update match in cache
      const index = matches.value.findIndex(m => m.id === matchId)
      if (index !== -1) {
        matches.value[index] = data
      }
      return data
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }
  
  const organizerSetResult = async (clerkId: string, matchId: string, payload: { score?: string, winner_id: string, is_wo?: boolean }) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<Match>(`/api/matches/${matchId}`, {
        method: 'PUT',
        body: {
          clerk_id: clerkId,
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
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }
  
  const acceptMatch = async (clerkId: string, matchId: string, payload?: { scheduled_at?: string, location?: string }) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<Match>(`/api/matches/${matchId}`, {
        method: 'PUT',
        body: {
          clerk_id: clerkId,
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
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }
  
  const rejectMatch = async (clerkId: string, matchId: string) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<Match>(`/api/matches/${matchId}`, {
        method: 'PUT',
        body: {
          clerk_id: clerkId,
          action: 'reject_match'
        }
      })
      // Update match in cache
      const index = matches.value.findIndex(m => m.id === matchId)
      if (index !== -1) {
        matches.value[index] = data
      }
      return data
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }
  
  const approveAcceptanceChange = async (clerkId: string, matchId: string) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<Match>(`/api/matches/${matchId}`, {
        method: 'PUT',
        body: {
          clerk_id: clerkId,
          action: 'approve_acceptance_change'
        }
      })
      // Update match in cache
      const index = matches.value.findIndex(m => m.id === matchId)
      if (index !== -1) {
        matches.value[index] = data
      }
      return data
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }
  
  const rejectAcceptanceChange = async (clerkId: string, matchId: string) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<Match>(`/api/matches/${matchId}`, {
        method: 'PUT',
        body: {
          clerk_id: clerkId,
          action: 'reject_acceptance_change'
        }
      })
      // Update match in cache
      const index = matches.value.findIndex(m => m.id === matchId)
      if (index !== -1) {
        matches.value[index] = data
      }
      return data
    } catch (err: unknown) {
      error.value = toError(err)
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

