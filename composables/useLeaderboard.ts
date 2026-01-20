import type { RatingTier } from '~/types'
import type { LeaderboardPlayer, LeaderboardResponse, NearbyPlayersResponse, LeaderboardFilters } from '~/types/leaderboard'

export const useLeaderboard = () => {
  // State
  const rankings = ref<LeaderboardPlayer[]>([])
  const loading = ref(false)
  const error = ref<Error | null>(null)
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(50)
  const currentUserPosition = ref<LeaderboardPlayer | null>(null)
  
  // Filters state
  const filters = ref<LeaderboardFilters>({
    tier: undefined,
    city_id: undefined,
    search: undefined,
    limit: 50,
    offset: 0
  })
  
  // Nearby players state
  const nearbyPlayers = ref<{
    current: LeaderboardPlayer | null
    above: LeaderboardPlayer[]
    below: LeaderboardPlayer[]
  }>({
    current: null,
    above: [],
    below: []
  })
  const nearbyLoading = ref(false)
  const nearbyError = ref<Error | null>(null)
  
  // Top players state
  const topPlayers = ref<LeaderboardPlayer[]>([])
  const topLoading = ref(false)
  const topError = ref<Error | null>(null)
  
  // Fetch leaderboard with filters
  const fetchLeaderboard = async (
    options: {
      tier?: RatingTier
      city_id?: string
      search?: string
      limit?: number
      offset?: number
      current_player_id?: string
      center_around_player?: boolean
    } = {}
  ) => {
    loading.value = true
    error.value = null
    
    try {
      // Update filters
      filters.value = {
        tier: options.tier,
        city_id: options.city_id,
        search: options.search,
        limit: options.limit || 50,
        offset: options.offset || 0
      }
      
      const queryParams = new URLSearchParams()
      if (options.tier) queryParams.append('tier', options.tier)
      if (options.city_id) queryParams.append('city_id', options.city_id)
      if (options.search) queryParams.append('search', options.search)
      if (options.limit) queryParams.append('limit', options.limit.toString())
      if (options.offset) queryParams.append('offset', options.offset.toString())
      if (options.current_player_id) queryParams.append('current_player_id', options.current_player_id)
      if (options.center_around_player) queryParams.append('center_around_player', 'true')
      
      const response = await $fetch<LeaderboardResponse>(`/api/leaderboard?${queryParams.toString()}`)
      
      if (response.success) {
        rankings.value = response.rankings
        total.value = response.total
        page.value = response.page
        pageSize.value = response.page_size
        currentUserPosition.value = response.current_user_position || null
      }
      
      return response
    } catch (err: any) {
      error.value = err
      console.error('Error fetching leaderboard:', err)
      throw err
    } finally {
      loading.value = false
    }
  }
  
  // Fetch nearby players (players around the current user)
  const fetchNearbyPlayers = async (playerId: string, range: number = 5) => {
    nearbyLoading.value = true
    nearbyError.value = null
    
    try {
      const response = await $fetch<NearbyPlayersResponse>(
        `/api/leaderboard/nearby?player_id=${playerId}&range=${range}`
      )
      
      if (response.success) {
        nearbyPlayers.value = {
          current: response.current_player,
          above: response.players_above,
          below: response.players_below
        }
      }
      
      return response
    } catch (err: any) {
      nearbyError.value = err
      console.error('Error fetching nearby players:', err)
      throw err
    } finally {
      nearbyLoading.value = false
    }
  }
  
  // Fetch top players
  const fetchTopPlayers = async (limit: number = 10) => {
    topLoading.value = true
    topError.value = null
    
    try {
      const response = await $fetch<{ success: boolean; top_players: LeaderboardPlayer[] }>(
        `/api/leaderboard/top?limit=${limit}`
      )
      
      if (response.success) {
        topPlayers.value = response.top_players
      }
      
      return response
    } catch (err: any) {
      topError.value = err
      console.error('Error fetching top players:', err)
      throw err
    } finally {
      topLoading.value = false
    }
  }
  
  // Pagination helpers
  const nextPage = async () => {
    const newOffset = (filters.value.offset || 0) + (filters.value.limit || 50)
    if (newOffset < total.value) {
      await fetchLeaderboard({
        ...filters.value,
        offset: newOffset
      })
    }
  }
  
  const previousPage = async () => {
    const newOffset = Math.max(0, (filters.value.offset || 0) - (filters.value.limit || 50))
    await fetchLeaderboard({
      ...filters.value,
      offset: newOffset
    })
  }
  
  const goToPage = async (pageNumber: number) => {
    const newOffset = (pageNumber - 1) * (filters.value.limit || 50)
    await fetchLeaderboard({
      ...filters.value,
      offset: newOffset
    })
  }
  
  // Search with debounce
  let searchTimeout: ReturnType<typeof setTimeout> | null = null
  const searchPlayers = (searchTerm: string, debounceMs: number = 300) => {
    if (searchTimeout) clearTimeout(searchTimeout)
    
    searchTimeout = setTimeout(() => {
      fetchLeaderboard({
        ...filters.value,
        search: searchTerm || undefined,
        offset: 0 // Reset to first page on new search
      })
    }, debounceMs)
  }
  
  // Filter by tier
  const filterByTier = async (tier: RatingTier | undefined) => {
    await fetchLeaderboard({
      ...filters.value,
      tier,
      offset: 0 // Reset to first page on filter change
    })
  }
  
  // Filter by city
  const filterByCity = async (cityId: string | undefined) => {
    await fetchLeaderboard({
      ...filters.value,
      city_id: cityId,
      offset: 0 // Reset to first page on filter change
    })
  }
  
  // Clear all filters
  const clearFilters = async () => {
    await fetchLeaderboard({
      limit: filters.value.limit,
      offset: 0
    })
  }
  
  // Computed helpers
  const hasNextPage = computed(() => {
    const currentOffset = filters.value.offset || 0
    const currentLimit = filters.value.limit || 50
    return currentOffset + currentLimit < total.value
  })
  
  const hasPreviousPage = computed(() => {
    return (filters.value.offset || 0) > 0
  })
  
  const totalPages = computed(() => {
    return Math.ceil(total.value / (filters.value.limit || 50))
  })
  
  const currentPage = computed(() => {
    return Math.floor((filters.value.offset || 0) / (filters.value.limit || 50)) + 1
  })
  
  return {
    // State
    rankings: readonly(rankings),
    loading: readonly(loading),
    error: readonly(error),
    total: readonly(total),
    page: readonly(page),
    pageSize: readonly(pageSize),
    currentUserPosition: readonly(currentUserPosition),
    filters: readonly(filters),
    
    // Nearby players
    nearbyPlayers: readonly(nearbyPlayers),
    nearbyLoading: readonly(nearbyLoading),
    nearbyError: readonly(nearbyError),
    
    // Top players
    topPlayers: readonly(topPlayers),
    topLoading: readonly(topLoading),
    topError: readonly(topError),
    
    // Methods
    fetchLeaderboard,
    fetchNearbyPlayers,
    fetchTopPlayers,
    nextPage,
    previousPage,
    goToPage,
    searchPlayers,
    filterByTier,
    filterByCity,
    clearFilters,
    
    // Computed
    hasNextPage,
    hasPreviousPage,
    totalPages,
    currentPage
  }
}
