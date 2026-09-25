<template>
  <PageLayout world="tablero">
    <!-- Ranking (DESIGN.md "Ranking"): the club's ladder board -->
    <header ref="rankBoard" class="rank-head">
      <div class="rank-head__title">
        <h1 class="t-display-xl">Ranking</h1>
        <p v-if="total" class="rank-head__count">
          <TableroPlates :value="total" :label="`${total.toLocaleString('es-EC')} jugadores clasificados`" />
          <span class="t-paint" aria-hidden="true">jugadores clasificados</span>
        </p>
        <p v-else class="t-muted">Clasificación de Ecuador</p>
      </div>
      <div class="rank-head__side">
        <div v-if="ownRow" class="rank-head__own">
          <span class="t-paint">Tu posición</span>
          <span class="rank-head__own-plates">
            <TableroPlate :value="ownRow.rank" tone="lamp" word />
            <span class="rank-head__own-sr num">{{ ownRow.elo.toLocaleString('es-EC') }} <span class="t-paint">SR</span></span>
          </span>
          <span class="sr-only">Puesto {{ ownRow.rank }}, {{ ownRow.elo }} puntos SR</span>
        </div>
        <button type="button" class="t-btn t-btn--line" @click.stop="showRankingInfo = true">
          Cómo funciona
          <Icon name="heroicons:information-circle" class="w-5 h-5" aria-hidden="true" />
        </button>
      </div>
    </header>

    <TableroScoreStrip v-if="ownRow" :target="rankBoard">
      <span class="strip-label">Tú</span>
      <TableroPlate :value="ownRow.rank" tone="lamp" word />
      <span class="strip-sr num">{{ ownRow.elo.toLocaleString('es-EC') }}</span>
      <span class="t-paint">SR</span>
    </TableroScoreStrip>

    <RankingSystemInfo v-model="showRankingInfo" />

    <div v-if="initialLoading" class="rank-loading" aria-busy="true">
      <span v-for="n in 5" :key="n" class="t-slot rank-loading__bar" aria-hidden="true" />
      <p class="t-muted">Cargando clasificación…</p>
    </div>

    <template v-else>
      <section class="filters" aria-label="Filtros">
        <div class="filters__grid">
          <div class="filters__search">
            <label for="lb-search" class="sr-only">Buscar jugador</label>
            <input id="lb-search" v-model="searchQuery" type="search" class="t-field" placeholder="Buscar jugador por nombre" autocomplete="off" @input="onSearchInput">
          </div>
          <div>
            <label for="lb-tier" class="sr-only">Tier</label>
            <select id="lb-tier" v-model="selectedTier" class="t-field" @change="onTierChange">
              <option :value="undefined">Todos los tiers</option>
              <option v-for="t in TIERS" :key="t.tier" :value="t.tier">{{ t.name }}</option>
            </select>
          </div>
          <div>
            <label for="lb-city" class="sr-only">Ciudad</label>
            <select id="lb-city" v-model="selectedCity" class="t-field" @change="onCityChange">
              <option :value="undefined">Todas las ciudades</option>
              <option v-for="city in cities" :key="city.id" :value="city.id">{{ city.name }}</option>
            </select>
          </div>
        </div>
        <button v-if="hasActiveFilters" type="button" class="t-link" @click="clearAllFilters">
          <Icon name="heroicons:x-mark" class="w-4 h-4" aria-hidden="true" />
          Limpiar filtros
        </button>
      </section>

      <div class="rank-section-head">
        <div>
          <h2 class="t-display-m">{{ isAuthenticated && player && showAroundMe ? (selectedTier ? `Tu posición en ${getTierNameInSpanish(selectedTier)}` : 'Tu posición') : 'Clasificación nacional' }}</h2>
          <p class="t-muted">{{ isAuthenticated && player && showAroundMe ? 'Puestos destacados y jugadores cerca de tu posición.' : `${total} jugadores clasificados` }}</p>
        </div>
        <div class="rank-actions">
          <NuxtLink v-if="isAuthenticated && player" to="/my-ranking" class="t-link">
            Mi ranking
            <Icon name="heroicons:arrow-right" class="w-4 h-4" aria-hidden="true" />
          </NuxtLink>
          <button v-if="isAuthenticated && player" type="button" class="t-btn t-btn--line" @click="toggleView">
            <Icon :name="showAroundMe ? 'heroicons:globe-alt' : 'heroicons:user'" class="w-4 h-4" aria-hidden="true" />
            {{ showAroundMe ? 'Ver todos' : 'Ver cerca de mí' }}
          </button>
        </div>
      </div>

      <div class="ranking-grid">
        <section v-if="topPlayers.length >= 3" class="rank-top" aria-labelledby="rank-top-title">
          <h3 id="rank-top-title" class="t-paint rank-top__title">Primeros tres puestos</h3>
          <div class="rank-list">
            <LeaderboardPlayerCard v-for="(p, i) in topPlayers.slice(0, 3)" :key="`top-${p.id}`" :player="p" :billing="(i + 1) as 1 | 2 | 3" />
          </div>
        </section>

        <section class="rank-list ranking-list" :aria-label="showAroundMe ? 'Cerca de tu posición' : 'Clasificación'">
          <div v-if="loading && rankings.length === 0" class="rank-loading" aria-busy="true">
            <span v-for="n in 4" :key="n" class="t-slot rank-loading__bar" aria-hidden="true" />
            <p class="t-muted">Cargando rankings…</p>
          </div>
          <div v-else-if="rankings.length > 0" ref="scrollContainer" class="ranking-scroll" @scroll="onScroll">
            <div v-if="hasMoreAbove && isLoadingMore" class="ranking-more" aria-live="polite">
              <Icon name="heroicons:arrow-path" class="w-5 h-5 animate-spin" aria-hidden="true" />
              <span class="sr-only">Cargando más</span>
            </div>
            <LeaderboardPlayerCard v-for="p in rankings" :key="`${p.id}-${p.rank}`" :player="p" />
            <div v-if="hasMoreBelow && isLoadingMore" class="ranking-more" aria-live="polite">
              <Icon name="heroicons:arrow-path" class="w-5 h-5 animate-spin" aria-hidden="true" />
              <span class="sr-only">Cargando más</span>
            </div>
          </div>
          <div v-else class="rank-empty">
            <h3 class="t-display-s">No se encontraron jugadores</h3>
            <p class="t-muted">{{ hasActiveFilters ? 'Prueba con otros filtros.' : 'Aún no hay jugadores clasificados.' }}</p>
            <button v-if="hasActiveFilters" type="button" class="t-btn t-btn--plate" @click="clearAllFilters">Limpiar filtros</button>
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
// The header board the compact rail tracks, and the viewer's own row when the API returned it
const rankBoard = ref<HTMLElement | null>(null)
const ownRow = computed(() => rankings.value.find(p => p.is_current_user) || currentUserPosition.value || null)

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
.rank-head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 24px 40px; padding-bottom: 28px; margin-bottom: 32px; border-bottom: 1px solid var(--t-chalk-strong); }
.rank-head__title { display: grid; gap: 16px; }
.rank-head__count { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; font-size: 2rem; }
.rank-head__side { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 16px 28px; }
.rank-head__own { display: grid; gap: 8px; }
.rank-head__own-plates { display: flex; align-items: center; gap: 14px; font-size: 2.1rem; }
.rank-head__own-sr { font-size: 18px; font-weight: 650; }
.strip-label { font-family: var(--t-display); font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em; }
.strip-sr { font-size: 17px; font-weight: 650; }

.filters { display: grid; gap: 8px; margin-bottom: 36px; }
.filters__grid { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
.filters .t-link { justify-self: start; }

.rank-section-head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 12px 24px; margin-bottom: 20px; }
.rank-section-head > div:first-child { display: grid; gap: 8px; }
.rank-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 20px; }

.ranking-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr); gap: 40px; align-items: start; }
.ranking-grid > .ranking-list:only-child { grid-column: 1 / -1; }
.rank-top__title { margin-bottom: 8px; font-size: 0.78rem; }
.rank-list { border-bottom: 1px solid var(--t-chalk); }
/* Scroll container kept: the page loads more rows above/below and centers the viewer's row inside it */
.ranking-scroll { position: relative; max-height: min(70vh, 640px); overflow-y: auto; overscroll-behavior: contain; }
.ranking-more { display: flex; justify-content: center; padding: 10px; color: var(--t-ink-muted); }
.rank-loading { display: grid; gap: 10px; padding: 12px 0; }
.rank-loading__bar { display: block; height: 52px; width: 100%; padding: 0; }
.rank-empty { display: grid; justify-items: start; gap: 12px; padding: 32px 0; }

@media (min-width: 768px) and (max-width: 1099px) { .ranking-grid { grid-template-columns: 1fr; } }
@media (max-width: 767px) {
  .rank-head { padding-bottom: 20px; margin-bottom: 24px; }
  .rank-head__count { font-size: 1.6rem; }
  .rank-head__side { width: 100%; justify-content: space-between; }
  .filters__grid { grid-template-columns: 1fr 1fr; }
  .filters__search { grid-column: 1 / -1; }
  .ranking-grid { grid-template-columns: 1fr; gap: 32px; }
  .ranking-scroll { max-height: 60vh; }
}
</style>
