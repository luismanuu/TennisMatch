<template>
  <PageLayout>
    <!-- Ranking (DESIGN.md §7, design/mock/court-Ranking.html) -->
    <PhotoPanel photo="aerial" variant="compact" eager>
      <template #decor><RankLadder /></template>
      <p>{{ total ? `${total.toLocaleString('es-EC')} jugadores clasificados` : 'Clasificación de Ecuador' }}</p>
      <h1>Ranking</h1>
      <button type="button" class="btn-photo ranking-info" @click.stop="showRankingInfo = true">
        Cómo funciona
        <Icon name="heroicons:information-circle" class="w-5 h-5" aria-hidden="true" />
      </button>
    </PhotoPanel>

    <RankingSystemInfo v-model="showRankingInfo" />

    <div v-if="initialLoading" class="panel loading-state" aria-busy="true">
      <Icon name="heroicons:arrow-path" class="loading-spinner animate-spin" aria-hidden="true" />
      <p class="loading-text">Cargando clasificación…</p>
    </div>

    <template v-else>
      <section class="panel filters" aria-label="Filtros">
        <div class="filters__grid">
          <div class="filters__search">
            <label for="lb-search" class="sr-only">Buscar jugador</label>
            <input id="lb-search" v-model="searchQuery" type="search" class="form-input" placeholder="Buscar jugador por nombre" autocomplete="off" @input="onSearchInput">
          </div>
          <div>
            <label for="lb-tier" class="sr-only">Tier</label>
            <select id="lb-tier" v-model="selectedTier" class="form-select" @change="onTierChange">
              <option :value="undefined">Todos los tiers</option>
              <option v-for="t in TIERS" :key="t.tier" :value="t.tier">{{ t.name }}</option>
            </select>
          </div>
          <div>
            <label for="lb-city" class="sr-only">Ciudad</label>
            <select id="lb-city" v-model="selectedCity" class="form-select" @change="onCityChange">
              <option :value="undefined">Todas las ciudades</option>
              <option v-for="city in cities" :key="city.id" :value="city.id">{{ city.name }}</option>
            </select>
          </div>
        </div>
        <button v-if="hasActiveFilters" type="button" class="text-link" @click="clearAllFilters">
          <Icon name="heroicons:x-mark" class="w-4 h-4" aria-hidden="true" />
          Limpiar filtros
        </button>
      </section>

      <div class="section-heading">
        <h2>{{ isAuthenticated && player && showAroundMe ? (selectedTier ? `Tu posición en ${getTierNameInSpanish(selectedTier)}` : 'Tu posición') : 'Clasificación nacional' }}</h2>
        <div class="quick-actions ranking-actions">
          <NuxtLink v-if="isAuthenticated && player" to="/my-ranking" class="text-link">
            Mi ranking
            <Icon name="heroicons:arrow-right" class="w-4 h-4" aria-hidden="true" />
          </NuxtLink>
          <button v-if="isAuthenticated && player" type="button" class="btn-secondary !min-h-[44px] !py-2" @click="toggleView">
            <Icon :name="showAroundMe ? 'heroicons:globe-alt' : 'heroicons:user'" class="w-4 h-4" aria-hidden="true" />
            {{ showAroundMe ? 'Ver todos' : 'Ver cerca de mí' }}
          </button>
        </div>
      </div>
      <p class="meta">{{ isAuthenticated && player && showAroundMe ? 'Puestos destacados y jugadores cerca de tu posición.' : `${total} jugadores clasificados` }}</p>

      <div class="ranking-grid">
        <section v-if="topPlayers.length >= 3" class="list-surface" aria-label="Primeros tres puestos">
          <LeaderboardPlayerCard v-for="p in topPlayers.slice(0, 3)" :key="`top-${p.id}`" :player="p" />
        </section>

        <section class="list-surface ranking-list" :aria-label="showAroundMe ? 'Cerca de tu posición' : 'Clasificación'">
          <div v-if="loading && rankings.length === 0" class="loading-state" aria-busy="true">
            <Icon name="heroicons:arrow-path" class="loading-spinner animate-spin" aria-hidden="true" />
            <p class="loading-text">Cargando rankings…</p>
          </div>
          <div v-else-if="rankings.length > 0" ref="scrollContainer" class="ranking-scroll" @scroll="onScroll">
            <div v-if="hasMoreAbove && isLoadingMore" class="ranking-more" aria-live="polite">
              <Icon name="heroicons:arrow-path" class="w-5 h-5 text-accent animate-spin" aria-hidden="true" />
              <span class="sr-only">Cargando más</span>
            </div>
            <LeaderboardPlayerCard v-for="p in rankings" :key="`${p.id}-${p.rank}`" :player="p" />
            <div v-if="hasMoreBelow && isLoadingMore" class="ranking-more" aria-live="polite">
              <Icon name="heroicons:arrow-path" class="w-5 h-5 text-accent animate-spin" aria-hidden="true" />
              <span class="sr-only">Cargando más</span>
            </div>
          </div>
          <div v-else class="empty-state">
            <Icon name="heroicons:user-group" class="empty-state-icon" aria-hidden="true" />
            <h3 class="empty-state-title">No se encontraron jugadores</h3>
            <p class="empty-state-description">{{ hasActiveFilters ? 'Prueba con otros filtros.' : 'Aún no hay jugadores clasificados.' }}</p>
            <button v-if="hasActiveFilters" type="button" class="btn-primary" @click="clearAllFilters">Limpiar filtros</button>
          </div>
        </section>
      </div>
    </template>
  </PageLayout>
</template>

<script setup lang="ts">
import type { RatingTier, City } from '~/types'
import { TIERS } from '~/utils/tiers'

// Page meta
definePageMeta({
  layout: 'default'
})

// Composables
const { isAuthenticated, userId } = useAuthState()
const { player, fetchPlayer } = usePlayer()
const { cities, fetchCities } = useCities()
const {
  rankings,
  loading,
  total,
  topPlayers,
  nearbyPlayers,
  currentUserPosition,
  currentPage,
  totalPages,
  hasNextPage,
  hasPreviousPage,
  fetchLeaderboard,
  fetchTopPlayers,
  fetchNearbyPlayers,
  nextPage,
  previousPage,
  goToPage: navigateToPage,
  searchPlayers,
  filterByTier,
  filterByCity,
  clearFilters
} = useLeaderboard()

// Local state
const initialLoading = ref(true)
const searchQuery = ref('')
const selectedTier = ref<RatingTier | undefined>(undefined)
const selectedCity = ref<string | undefined>(undefined)
const showAroundMe = ref(true) // Default to showing around user if authenticated
const isLoadingMore = ref(false)
const hasMoreAbove = ref(false)
const hasMoreBelow = ref(false)
const scrollContainer = ref<HTMLElement | null>(null)
const userPlayerRef = ref<HTMLElement | null>(null)
const showRankingInfo = ref(false)

// Computed
const hasActiveFilters = computed(() => {
  return !!searchQuery.value || !!selectedTier.value || !!selectedCity.value
})

const visiblePageNumbers = computed(() => {
  const current = currentPage.value
  const total = totalPages.value
  const maxVisible = 5
  
  if (total <= maxVisible) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  
  const half = Math.floor(maxVisible / 2)
  let start = Math.max(1, current - half)
  let end = Math.min(total, start + maxVisible - 1)
  
  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1)
  }
  
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
})

// Methods
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null
const onSearchInput = () => {
  // Clear existing timer
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
  }
  
  // Set new timer
  searchDebounceTimer = setTimeout(async () => {
    if (showAroundMe.value && player.value?.id) {
      // If in "around me" mode, reload with search
      await loadPlayersAroundUser()
      // Update top players from current ranking
      if (rankings.value.length >= 3) {
        topPlayers.value = rankings.value.slice(0, 3)
      }
    } else {
      // Normal search mode
      if (searchQuery.value.trim()) {
        await fetchLeaderboard({
          search: searchQuery.value.trim(),
          limit: 50,
          offset: 0
        })
        // Update top players from current ranking
        if (rankings.value.length >= 3) {
          topPlayers.value = rankings.value.slice(0, 3)
        } else {
          await fetchTopPlayers(10)
        }
      } else {
        // If search is cleared, reload leaderboard
        await clearFilters()
        await fetchTopPlayers(10)
      }
    }
  }, 300) // 300ms debounce
}

const onTierChange = async () => {
  // If "Todos los tiers" is selected (undefined), automatically switch to "Ver Todos"
  if (selectedTier.value === undefined) {
    showAroundMe.value = false
  }
  
  if (showAroundMe.value && player.value?.id) {
    // If in "around me" mode, reload around user with new tier
    await loadPlayersAroundUser()
    // Update top players from current ranking
    if (rankings.value.length >= 3) {
      topPlayers.value = rankings.value.slice(0, 3)
    }
  } else {
    // Normal filter (global view)
    await filterByTier(selectedTier.value)
    // Update top players from current ranking
    if (rankings.value.length >= 3) {
      topPlayers.value = rankings.value.slice(0, 3)
    } else {
      await fetchTopPlayers(10)
    }
  }
}

const onCityChange = async () => {
  if (showAroundMe.value && player.value?.id) {
    // If in "around me" mode, reload around user with new city filter
    await loadPlayersAroundUser()
    // Update top players from current ranking
    if (rankings.value.length >= 3) {
      topPlayers.value = rankings.value.slice(0, 3)
    }
  } else {
    await filterByCity(selectedCity.value)
    // Update top players from current ranking
    if (rankings.value.length >= 3) {
      topPlayers.value = rankings.value.slice(0, 3)
    } else {
      await fetchTopPlayers(10)
    }
  }
}

const clearAllFilters = async () => {
  searchQuery.value = ''
  selectedCity.value = undefined
  
  if (showAroundMe.value && player.value?.id) {
    // Reset tier to user's tier
    if (player.value.total_matches_played > 0 && (player.value.placement_matches_completed || 0) >= 3) {
      selectedTier.value = getUserTier(player.value.elo, player.value.total_matches_played)
    } else {
      selectedTier.value = undefined
    }
    await loadPlayersAroundUser()
    // Update top players from current ranking
    if (rankings.value.length >= 3) {
      topPlayers.value = rankings.value.slice(0, 3)
    }
  } else {
    // Reset to user's tier if authenticated, otherwise Bronze
    if (player.value?.id) {
      // All players now have tiers based on ELO
      selectedTier.value = getUserTier(player.value.elo, player.value.total_matches_played)
      await fetchLeaderboard({ tier: selectedTier.value, limit: 50, offset: 0 })
    } else {
      selectedTier.value = 'Bronze'
      await fetchLeaderboard({ tier: 'Bronze', limit: 50, offset: 0 })
    }
    // Update top players from current ranking
    if (rankings.value.length >= 3) {
      topPlayers.value = rankings.value.slice(0, 3)
    } else {
      await fetchTopPlayers(10)
    }
  }
}

const goToPreviousPage = () => previousPage()
const goToNextPage = () => nextPage()
const goToPage = (page: number) => navigateToPage(page)

const toggleView = async () => {
  showAroundMe.value = !showAroundMe.value
  if (showAroundMe.value && player.value?.id) {
    // Reset to show around user with their tier
    await initializeAroundUser()
    // Update top players from current ranking
    if (rankings.value.length >= 3) {
      topPlayers.value = rankings.value.slice(0, 3)
    }
  } else {
    // Fetch from beginning (global view) - but still filter by user's tier if authenticated
    rankings.value = []
    if (player.value?.id) {
      // All players now have tiers based on ELO
      const userTier = getUserTier(player.value.elo, player.value.total_matches_played)
      selectedTier.value = userTier
      await fetchLeaderboard({ 
        tier: userTier,
        limit: 50,
        offset: 0
      })
    } else {
      // Not authenticated, use Bronze as default
      selectedTier.value = 'Bronze'
      await fetchLeaderboard({ 
        tier: 'Bronze',
        limit: 50,
        offset: 0
      })
    }
    // Update top players from current ranking
    if (rankings.value.length >= 3) {
      topPlayers.value = rankings.value.slice(0, 3)
    } else {
      await fetchTopPlayers(10)
    }
  }
}

// Get user's tier from their ELO using the rating system
// All players now have tiers based on ELO, regardless of placement status
const getUserTier = (elo: number, totalMatches: number): RatingTier => {
  if (elo >= 4000) return 'Grandmaster'
  if (elo >= 3500) return 'Master'
  if (elo >= 3000) return 'Diamond'
  if (elo >= 2500) return 'Platinum'
  if (elo >= 2000) return 'Gold'
  if (elo >= 1500) return 'Silver'
  if (elo >= 1) return 'Bronze'
  return 'Bronze' // Default to Bronze for very low ELO
}

// Get tier name in Spanish
const getTierNameInSpanish = (tier: RatingTier | undefined): string => {
  if (!tier) return ''
  const tierNames: Record<RatingTier, string> = {
    'Bronze': 'Bronce',
    'Silver': 'Plata',
    'Gold': 'Oro',
    'Platinum': 'Platino',
    'Diamond': 'Diamante',
    'Master': 'Maestro',
    'Grandmaster': 'Gran Maestro',
    'Unrated': 'Sin clasificar'
  }
  return tierNames[tier] || tier
}

// Initialize leaderboard around user with their tier filter
const initializeAroundUser = async () => {
  if (!player.value?.id) return
  
  rankings.value = []
  hasMoreAbove.value = false
  hasMoreBelow.value = false
  
  // Get user's tier based on ELO (all players now have tiers based on ELO)
  const userTier = getUserTier(player.value.elo, player.value.total_matches_played)
  selectedTier.value = userTier
  
  // Fetch players around user (by tier if rated, by ELO range if in placement)
  await loadPlayersAroundUser()
  
  // Scroll to user after DOM is ready
  await nextTick()
  setTimeout(() => {
    scrollToUser()
  }, 300)
}

// Load players around user
const loadPlayersAroundUser = async () => {
  if (!player.value?.id) return
  
  isLoadingMore.value = true
  
  try {
    // Only set default tier if user hasn't manually selected one
    // This allows users to change the tier filter without it being reset
    // All players now have tiers based on ELO, regardless of placement status
    if (!selectedTier.value) {
      selectedTier.value = getUserTier(player.value.elo, player.value.total_matches_played)
    }
    
    // Send tier filter (respects user's selection)
    const response = await fetchLeaderboard({ 
      current_player_id: player.value.id,
      center_around_player: true,
      tier: selectedTier.value, // Use selected tier (user's choice or default)
      search: searchQuery.value.trim() || undefined, // Include search query
      city_id: selectedCity.value, // Include city filter
      limit: 50 
    })
    
    // Check if there are more players above/below within the tier
    const userInRankings = rankings.value.find(p => p.is_current_user)
    if (userInRankings) {
      hasMoreAbove.value = userInRankings.rank > 1
      hasMoreBelow.value = userInRankings.rank < total.value
    } else if (currentUserPosition.value) {
      hasMoreAbove.value = currentUserPosition.value.rank > 1
      hasMoreBelow.value = currentUserPosition.value.rank < total.value
    } else if (rankings.value.length > 0) {
      // Fallback: check if we have more based on displayed ranks
      const minRank = Math.min(...rankings.value.map(p => p.rank))
      const maxRank = Math.max(...rankings.value.map(p => p.rank))
      hasMoreAbove.value = minRank > 1
      hasMoreBelow.value = maxRank < total.value
    } else {
      hasMoreAbove.value = false
      hasMoreBelow.value = false
    }
  } finally {
    isLoadingMore.value = false
  }
}

// Load more players above current view
const loadMoreAbove = async () => {
  if (!player.value?.id || isLoadingMore.value || !hasMoreAbove.value) return
  
  isLoadingMore.value = true
  
  try {
    // Get the lowest rank currently displayed
    const lowestRank = Math.min(...rankings.value.map(p => p.rank))
    const range = 25 // Load 25 more above
    
    // Calculate offset to get players above
    const newOffset = Math.max(0, lowestRank - range - 1)
    
    const response = await $fetch('/api/leaderboard', {
      query: {
        tier: selectedTier.value,
        city_id: selectedCity.value,
        search: searchQuery.value || undefined,
        limit: range,
        offset: newOffset,
        current_player_id: player.value.id
      }
    })
    
    if (response.success && response.rankings.length > 0) {
      // Prepend new players to the list
      rankings.value = [...response.rankings, ...rankings.value]
      hasMoreAbove.value = newOffset > 0
    } else {
      hasMoreAbove.value = false
    }
  } catch (error) {
    console.error('Error loading more players above:', error)
  } finally {
    isLoadingMore.value = false
  }
}

// Load more players below current view
const loadMoreBelow = async () => {
  if (!player.value?.id || isLoadingMore.value || !hasMoreBelow.value) return
  
  isLoadingMore.value = true
  
  try {
    // Get the highest rank currently displayed
    const highestRank = Math.max(...rankings.value.map(p => p.rank))
    const range = 25 // Load 25 more below
    
    const response = await $fetch('/api/leaderboard', {
      query: {
        tier: selectedTier.value,
        city_id: selectedCity.value,
        search: searchQuery.value || undefined,
        limit: range,
        offset: highestRank,
        current_player_id: player.value.id
      }
    })
    
    if (response.success && response.rankings.length > 0) {
      // Append new players to the list
      rankings.value = [...rankings.value, ...response.rankings]
      hasMoreBelow.value = highestRank + response.rankings.length < total.value
    } else {
      hasMoreBelow.value = false
    }
  } catch (error) {
    console.error('Error loading more players below:', error)
  } finally {
    isLoadingMore.value = false
  }
}

// Scroll to user's position (only within the table container, not the whole page)
const scrollToUser = () => {
  // Use multiple attempts with delays to ensure DOM is ready
  const attemptScroll = (attempt: number = 0) => {
    if (attempt > 5) return // Max 5 attempts
    
    nextTick(() => {
      if (scrollContainer.value) {
        // Find the user's card element within the container
        const userCard = scrollContainer.value.querySelector('[data-user-card="true"]') as HTMLElement
        if (userCard) {
          // Calculate position relative to scroll container
          // Get the container's scroll position and the card's position within it
          const containerTop = scrollContainer.value.scrollTop
          const cardOffsetTop = userCard.offsetTop
          const containerHeight = scrollContainer.value.clientHeight
          const cardHeight = userCard.offsetHeight
          
          // Calculate scroll position to center the card in the container
          // Center the card vertically in the visible area
          const scrollPosition = cardOffsetTop - (containerHeight / 2) + (cardHeight / 2)
          
          // Scroll only the container, not the whole page
          scrollContainer.value.scrollTo({
            top: Math.max(0, scrollPosition), // Ensure we don't scroll to negative position
            behavior: 'smooth'
          })
        } else if (attempt < 5) {
          // Retry if element not found yet
          setTimeout(() => attemptScroll(attempt + 1), 100)
        }
      } else if (attempt < 5) {
        // Retry if container not ready yet
        setTimeout(() => attemptScroll(attempt + 1), 100)
      }
    })
  }
  
  attemptScroll()
}

// Handle scroll events for infinite scroll
const onScroll = (event: Event) => {
  const container = event.target as HTMLElement
  if (!container) return
  
  const scrollTop = container.scrollTop
  const scrollHeight = container.scrollHeight
  const clientHeight = container.clientHeight
  
  // Load more when scrolling near top (within 200px)
  if (scrollTop < 200 && hasMoreAbove.value && !isLoadingMore.value) {
    loadMoreAbove()
  }
  
  // Load more when scrolling near bottom (within 200px)
  if (scrollTop + clientHeight > scrollHeight - 200 && hasMoreBelow.value && !isLoadingMore.value) {
    loadMoreBelow()
  }
}

// Initialize
const initialize = async () => {
  try {
    initialLoading.value = true
    
    // Fetch cities for filter dropdown
    await fetchCities()
    
    // If authenticated, fetch player profile first
    if (isAuthenticated.value && userId.value) {
      await fetchPlayer(userId.value)
      
      if (player.value?.id) {
        // Initialize around user with their tier filter
        await initializeAroundUser()
        
        // Fetch top players from current ranking (filtered by tier/ELO range)
        // We'll use the current rankings to show top 3
        if (rankings.value.length >= 3) {
          topPlayers.value = rankings.value.slice(0, 3)
        } else {
          // Fallback to global top if not enough in current ranking
          await fetchTopPlayers(10)
        }
        
        // Fetch nearby players (only if not in placement)
        if (player.value.total_matches_played > 0 && (player.value.placement_matches_completed || 0) >= 3) {
          await fetchNearbyPlayers(player.value.id, 3)
        }
      } else {
        // Player not found, set default tier to Bronze and fetch leaderboard
        selectedTier.value = 'Bronze'
        await fetchLeaderboard({ tier: 'Bronze', limit: 50 })
        await fetchTopPlayers(10)
        showAroundMe.value = false
      }
    } else {
      // Not authenticated, set default tier to Bronze (most common starting tier)
      selectedTier.value = 'Bronze'
      await fetchLeaderboard({ tier: 'Bronze', limit: 50 })
      await fetchTopPlayers(10)
    }
  } catch (error) {
    console.error('Error initializing leaderboard:', error)
  } finally {
    initialLoading.value = false
  }
}

// Watch for auth changes
watch([isAuthenticated, userId], async ([auth, uid]) => {
  if (auth && uid && !player.value) {
    await fetchPlayer(uid)
    if (player.value?.id && player.value.total_matches_played > 0) {
      await fetchNearbyPlayers(player.value.id, 3)
    }
  }
})

// Watch rankings to scroll to user when they appear in the list
// Only scroll if we're showing "around me" view and user is authenticated
let scrollTimeout: ReturnType<typeof setTimeout> | null = null
watch([rankings, showAroundMe], () => {
  if (showAroundMe.value && isAuthenticated.value && player.value?.id) {
    // Clear any pending scroll
    if (scrollTimeout) {
      clearTimeout(scrollTimeout)
    }
    // Wait a bit for DOM to update, then scroll
    scrollTimeout = setTimeout(() => {
      nextTick(() => {
        scrollToUser()
      })
    }, 300)
  }
}, { deep: true })

// Initialize on mount
onMounted(() => {
  initialize()
})
</script>

<style scoped>
.ranking-info { margin-top: 4px; }
.filters { display: grid; gap: 8px; margin-bottom: 28px; padding: 16px; }
.filters__grid { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
.filters .text-link { justify-self: start; }
.ranking-actions { gap: 8px 16px; }
.ranking-actions > .btn-secondary, .ranking-actions > .text-link { width: auto; margin: 0; flex-grow: 0; }
.ranking-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr); gap: 24px; margin-top: 20px; align-items: start; }
.ranking-grid > .ranking-list:only-child { grid-column: 1 / -1; }
/* Scroll container kept: the page loads more rows above/below and centers the viewer's row inside it */
.ranking-scroll { position: relative; max-height: min(70vh, 640px); overflow-y: auto; overscroll-behavior: contain; }
.ranking-more { display: flex; justify-content: center; padding: 10px; }
@media (min-width: 768px) and (max-width: 1099px) { .ranking-grid { grid-template-columns: 1fr; } }
@media (max-width: 767px) {
  .filters__grid { grid-template-columns: 1fr 1fr; }
  .filters__search { grid-column: 1 / -1; }
  .ranking-grid { grid-template-columns: 1fr; gap: 24px; }
  .ranking-scroll { max-height: 60vh; }
}
</style>
