import type { MatchmakingRecommendation, Player, RatingTier } from '~/types'

interface MatchmakingPagination {
  page: number
  limit: number
  total: number
  total_pages: number
  has_more: boolean
  top_recommendations_count: number
}

interface MatchmakingResponse {
  success: boolean
  recommendations: MatchmakingRecommendation[]
  top_recommendations?: MatchmakingRecommendation[]
  pagination?: MatchmakingPagination
  player_info?: {
    id: string
    name: string
    elo: number
    mmr: number
    rating_tier: RatingTier
    is_unrated: boolean
    city_id?: string
  }
  search_info?: {
    city_segments_count: number
    matchable_cities_count: number
    recommendations_count: number
  }
  message?: string
}

export function useMatchmaking() {
  const recommendations = ref<MatchmakingRecommendation[]>([])
  const topRecommendations = ref<MatchmakingRecommendation[]>([])
  const pagination = ref<MatchmakingPagination | null>(null)
  const playerInfo = ref<MatchmakingResponse['player_info'] | null>(null)
  const searchInfo = ref<MatchmakingResponse['search_info'] | null>(null)
  const loading = ref(false)
  const error = ref<Error | null>(null)
  const message = ref<string | null>(null)

  const fetchRecommendations = async (accountId: string, page: number = 1, limit: number = 20) => {
    try {
      loading.value = true
      error.value = null
      message.value = null
      
      const response = await $fetch<MatchmakingResponse>('/api/matchmaking/recommendations', {
        query: { page, limit }
      })
      
      recommendations.value = response.recommendations || []
      topRecommendations.value = response.top_recommendations || []
      pagination.value = response.pagination || null
      playerInfo.value = response.player_info || null
      searchInfo.value = response.search_info || null
      message.value = response.message || null
      
      return response
    } catch (err: any) {
      console.error('Error fetching matchmaking recommendations:', err)
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }

  const clearRecommendations = () => {
    recommendations.value = []
    topRecommendations.value = []
    pagination.value = null
    playerInfo.value = null
    searchInfo.value = null
    message.value = null
  }

  return {
    recommendations,
    topRecommendations,
    pagination,
    playerInfo,
    searchInfo,
    loading,
    error,
    message,
    fetchRecommendations,
    clearRecommendations,
  }
}
