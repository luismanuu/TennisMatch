import { useAuthState } from './useAuthState'

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(typeof err === 'string' ? err : 'Unknown error')
}

export const useAdminRankings = () => {
  const { userId } = useAuthState()
  
  const loading = ref(false)
  const error = ref<Error | null>(null)
  
  // Ranking statistics (API response shape varies; consumers use specific fields)
  const rankingStats = ref<any>(null)
  
  // Ranking trends
  const rankingTrends = ref<any>(null)
  
  // Player ranking details
  const playerRankingDetails = ref<any>(null)
  
  // Ranking health
  const rankingHealth = ref<any>(null)
  
  // Leaderboards
  const leaderboards = ref<any[]>([])
  const leaderboardTotal = ref(0)
  const leaderboardPage = ref(1)
  const leaderboardPageSize = ref(100)
  
  // Placement matches
  const placementMatches = ref<any[]>([])
  const placementStats = ref<any>(null)
  const placementPage = ref(1)
  const placementPageSize = ref(50)
  const placementTotal = ref(0)
  
  // Decay status
  const decayStatus = ref<any[]>([])
  const decayStats = ref<any>(null)
  const decayPage = ref(1)
  const decayPageSize = ref(50)
  const decayTotal = ref(0)
  
  // Match impact
  const matchImpact = ref<any>(null)

  // Fetch ranking statistics
  const fetchRankingStats = async () => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }
    
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<any>(`/api/admin/rankings/stats?clerk_id=${userId.value}`)
      rankingStats.value = data
      return data
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  // Fetch ranking trends
  const fetchRankingTrends = async (options: {
    time_range?: string
    granularity?: string
  } = {}) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }
    
    loading.value = true
    error.value = null
    
    try {
      const params = new URLSearchParams()
      params.append('clerk_id', userId.value)
      if (options.time_range) params.append('time_range', options.time_range)
      if (options.granularity) params.append('granularity', options.granularity)
      
      const data = await $fetch<any>(`/api/admin/rankings/trends?${params.toString()}`)
      rankingTrends.value = data
      return data
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  // Fetch player ranking details
  const fetchPlayerRankingDetails = async (playerId: string) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }
    
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<any>(`/api/admin/rankings/players/${playerId}?clerk_id=${userId.value}`)
      playerRankingDetails.value = data
      return data
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  // Fetch ranking health
  const fetchRankingHealth = async () => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }
    
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<any>(`/api/admin/rankings/health?clerk_id=${userId.value}`)
      rankingHealth.value = data
      return data
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  // Fetch leaderboards
  const fetchLeaderboards = async (filters: {
    city_id?: string
    category_id?: string
    tier?: string
    search?: string
    limit?: number
    offset?: number
  } = {}) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }
    
    loading.value = true
    error.value = null
    
    try {
      const params = new URLSearchParams()
      params.append('clerk_id', userId.value)
      if (filters.city_id) params.append('city_id', filters.city_id)
      if (filters.category_id) params.append('category_id', filters.category_id)
      if (filters.tier) params.append('tier', filters.tier)
      if (filters.search) params.append('search', filters.search)
      // Default to 100 if no limit is provided
      params.append('limit', (filters.limit || 100).toString())
      params.append('offset', (filters.offset || 0).toString())
      
      const data = await $fetch<any>(`/api/admin/rankings/leaderboards?${params.toString()}`)
      
      if (data.success) {
        leaderboards.value = data.leaderboard
        leaderboardTotal.value = data.total
        leaderboardPage.value = data.page
        leaderboardPageSize.value = data.page_size
      }
      
      return data
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  // Fetch placement matches
  const fetchPlacementMatches = async (page?: number, pageSize?: number) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }
    
    if (page !== undefined) placementPage.value = page
    if (pageSize !== undefined) placementPageSize.value = pageSize
    
    loading.value = true
    error.value = null
    
    try {
      const offset = (placementPage.value - 1) * placementPageSize.value
      const data = await $fetch<any>(`/api/admin/rankings/placement?clerk_id=${userId.value}&limit=${placementPageSize.value}&offset=${offset}`)
      placementMatches.value = data.players || []
      placementStats.value = data.statistics || null
      placementTotal.value = data.total || 0
      return data
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  // Reset placement matches
  const resetPlacementMatches = async (playerId: string) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }
    
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<any>(`/api/admin/rankings/placement/${playerId}?clerk_id=${userId.value}`, {
        method: 'PUT',
        body: {
          action: 'reset'
        }
      })
      
      // Refresh placement matches
      await fetchPlacementMatches()
      
      return data
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  // Complete placement matches
  const completePlacementMatches = async (playerId: string) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }
    
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<any>(`/api/admin/rankings/placement/${playerId}?clerk_id=${userId.value}`, {
        method: 'PUT',
        body: {
          action: 'complete'
        }
      })
      
      // Refresh placement matches
      await fetchPlacementMatches()
      
      return data
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  // Fetch decay status
  const fetchDecayStatus = async (onlyAtRisk?: boolean, page?: number, pageSize?: number) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }
    
    if (page !== undefined) decayPage.value = page
    if (pageSize !== undefined) decayPageSize.value = pageSize
    
    loading.value = true
    error.value = null
    
    try {
      const offset = (decayPage.value - 1) * decayPageSize.value
      const params = new URLSearchParams()
      params.append('clerk_id', userId.value)
      params.append('limit', decayPageSize.value.toString())
      params.append('offset', offset.toString())
      if (onlyAtRisk) params.append('only_at_risk', 'true')
      
      const data = await $fetch<any>(`/api/admin/rankings/decay?${params.toString()}`)
      decayStatus.value = data.players || []
      decayStats.value = data.statistics || null
      decayTotal.value = data.total || 0
      return data
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  // Trigger decay
  const triggerDecay = async (playerId: string) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }
    
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<any>(`/api/admin/rankings/decay/${playerId}?clerk_id=${userId.value}`, {
        method: 'POST',
        body: {
          action: 'trigger'
        }
      })
      
      // Refresh decay status
      await fetchDecayStatus()
      
      return data
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  // Exempt from decay
  const exemptFromDecay = async (playerId: string) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }
    
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<any>(`/api/admin/rankings/decay/${playerId}?clerk_id=${userId.value}`, {
        method: 'POST',
        body: {
          action: 'exempt'
        }
      })
      
      // Refresh decay status
      await fetchDecayStatus()
      
      return data
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  // Fetch match impact
  const fetchMatchImpact = async (matchId: string) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }
    
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<any>(`/api/admin/rankings/matches/${matchId}/impact?clerk_id=${userId.value}`)
      matchImpact.value = data
      return data
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    loading: readonly(loading),
    error: readonly(error),
    rankingStats: readonly(rankingStats),
    rankingTrends: readonly(rankingTrends),
    playerRankingDetails: readonly(playerRankingDetails),
    rankingHealth: readonly(rankingHealth),
    leaderboards: readonly(leaderboards),
    leaderboardTotal: readonly(leaderboardTotal),
    leaderboardPage: readonly(leaderboardPage),
    leaderboardPageSize: readonly(leaderboardPageSize),
    placementMatches: readonly(placementMatches),
    placementStats: readonly(placementStats),
    placementPage: readonly(placementPage),
    placementPageSize: readonly(placementPageSize),
    placementTotal: readonly(placementTotal),
    decayStatus: readonly(decayStatus),
    decayStats: readonly(decayStats),
    decayPage: readonly(decayPage),
    decayPageSize: readonly(decayPageSize),
    decayTotal: readonly(decayTotal),
    matchImpact: readonly(matchImpact),
    fetchRankingStats,
    fetchRankingTrends,
    fetchPlayerRankingDetails,
    fetchRankingHealth,
    fetchLeaderboards,
    fetchPlacementMatches,
    resetPlacementMatches,
    completePlacementMatches,
    fetchDecayStatus,
    triggerDecay,
    exemptFromDecay,
    fetchMatchImpact
  }
}
