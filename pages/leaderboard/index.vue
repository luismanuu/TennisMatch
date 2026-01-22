<template>
  <PageLayout container-size="wide">
    <!-- Page Header -->
    <div class="text-center mb-10 animate-fade-up">
      <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-subtle/30 border border-accent/30 backdrop-blur-sm mb-6">
        <Icon name="heroicons:trophy" class="w-4 h-4 text-accent" />
        <span class="text-size-4 font-semibold text-accent">Clasificación Global</span>
      </div>
      <h1 class="text-size-1 font-semibold text-foreground mb-3">
        Leaderboard
      </h1>
      <p class="text-size-3 font-regular text-foreground-muted max-w-lg mx-auto mb-4">
        Descubre los mejores jugadores, sube de ranking y compite por el top
      </p>
      <!-- Info Button -->
      <button
        class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface border border-border hover:bg-surface-elevated transition-colors text-size-4 text-foreground-muted hover:text-foreground"
        @click.stop="showRankingInfo = true"
      >
        <Icon name="heroicons:information-circle" class="w-5 h-5" />
        <span>¿Cómo funciona el ranking?</span>
      </button>
    </div>

    <!-- Ranking System Info Modal -->
    <RankingSystemInfo v-model="showRankingInfo" />

    <!-- Loading State -->
    <div v-if="initialLoading" class="loading-state">
      <Icon name="heroicons:arrow-path" class="loading-spinner" />
      <p class="loading-text">Cargando clasificación...</p>
    </div>

    <template v-else>
      <!-- Top 3 Players Podium -->
      <div v-if="topPlayers.length >= 3" class="mb-8 md:mb-10 animate-fade-up animate-delay-1">
        <div v-if="isAuthenticated && player && showAroundMe" class="text-center mb-4">
          <p class="text-size-4 text-foreground-muted">
            Top 3 de tu ranking actual
          </p>
        </div>
        <div class="flex flex-col sm:flex-row items-center sm:items-end justify-center gap-3 sm:gap-4 md:gap-6">
          <!-- 2nd Place -->
          <div class="w-full sm:flex-1 sm:max-w-[200px] order-2 sm:order-1">
            <div class="glass-card p-3 sm:p-4 text-center hover-lift transition-all">
              <div class="w-12 h-12 sm:w-16 sm:h-16 mx-auto rounded-2xl bg-gradient-to-br from-gray-300/30 to-gray-400/10 border-2 border-gray-400/40 flex items-center justify-center mb-2 sm:mb-3">
                <Icon name="heroicons:trophy" class="w-6 h-6 sm:w-8 sm:h-8 text-gray-300" />
              </div>
              <div class="text-2xl sm:text-3xl font-bold text-gray-300 mb-1">#2</div>
              <NuxtLink :to="`/players/${topPlayers[1]?.id}`" class="text-size-4 sm:text-size-3 font-semibold text-foreground hover:text-accent transition-colors block truncate px-2">
                {{ topPlayers[1]?.name }}
              </NuxtLink>
              <div class="text-size-3 sm:text-size-2 font-bold text-gradient-static mt-1">{{ topPlayers[1]?.elo }} ELO</div>
            </div>
          </div>
          
          <!-- 1st Place (Center, Taller) -->
          <div class="w-full sm:flex-1 sm:max-w-[220px] order-1 sm:order-2">
            <div class="glass-card-elevated p-4 sm:p-5 text-center hover-lift transition-all relative overflow-hidden">
              <!-- Crown Glow Effect -->
              <div class="absolute -top-10 left-1/2 -translate-x-1/2 w-24 h-24 sm:w-32 sm:h-32 bg-yellow-400/20 rounded-full blur-3xl"></div>
              
              <div class="relative">
                <div class="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-2xl bg-gradient-to-br from-yellow-400/30 to-yellow-600/10 border-2 border-yellow-500/50 flex items-center justify-center mb-2 sm:mb-3 animate-pulse-slow">
                  <Icon name="heroicons:trophy" class="w-8 h-8 sm:w-10 sm:h-10 text-yellow-400" />
                </div>
                <div class="text-3xl sm:text-4xl font-bold text-yellow-400 mb-1">#1</div>
                <NuxtLink :to="`/players/${topPlayers[0]?.id}`" class="text-size-3 sm:text-size-2 font-semibold text-foreground hover:text-accent transition-colors block truncate px-2">
                  {{ topPlayers[0]?.name }}
                </NuxtLink>
                <div class="text-size-2 sm:text-size-1 font-bold text-gradient-static mt-1">{{ topPlayers[0]?.elo }} ELO</div>
              </div>
            </div>
          </div>
          
          <!-- 3rd Place -->
          <div class="w-full sm:flex-1 sm:max-w-[200px] order-3">
            <div class="glass-card p-3 sm:p-4 text-center hover-lift transition-all">
              <div class="w-12 h-12 sm:w-16 sm:h-16 mx-auto rounded-2xl bg-gradient-to-br from-amber-600/30 to-amber-700/10 border-2 border-amber-600/40 flex items-center justify-center mb-2 sm:mb-3">
                <Icon name="heroicons:trophy" class="w-6 h-6 sm:w-8 sm:h-8 text-amber-600" />
              </div>
              <div class="text-2xl sm:text-3xl font-bold text-amber-600 mb-1">#3</div>
              <NuxtLink :to="`/players/${topPlayers[2]?.id}`" class="text-size-4 sm:text-size-3 font-semibold text-foreground hover:text-accent transition-colors block truncate px-2">
                {{ topPlayers[2]?.name }}
              </NuxtLink>
              <div class="text-size-3 sm:text-size-2 font-bold text-gradient-static mt-1">{{ topPlayers[2]?.elo }} ELO</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Your Position Section (for authenticated users) -->
      <div 
        v-if="isAuthenticated && player && nearbyPlayers.current" 
        class="glass-card-elevated p-4 sm:p-6 mb-6 md:mb-8 animate-fade-up animate-delay-2"
      >
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-lg bg-accent-subtle flex items-center justify-center">
            <Icon name="heroicons:user" class="w-5 h-5 text-accent" />
          </div>
          <div>
            <h2 class="text-size-3 font-semibold text-foreground">Tu Posición</h2>
            <p class="text-size-4 text-foreground-muted">Jugadores cercanos a tu ranking</p>
          </div>
        </div>
        
        <!-- Nearby Players List -->
        <div class="space-y-2">
          <!-- Players Above -->
          <LeaderboardPlayerCard 
            v-for="p in nearbyPlayers.above" 
            :key="p.id" 
            :player="p"
          />
          
          <!-- Current User (Highlighted) -->
          <LeaderboardPlayerCard 
            v-if="nearbyPlayers.current"
            :player="nearbyPlayers.current"
          />
          
          <!-- Players Below -->
          <LeaderboardPlayerCard 
            v-for="p in nearbyPlayers.below" 
            :key="p.id" 
            :player="p"
          />
        </div>
        
        <!-- Quick Stats -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mt-4 md:mt-6 pt-4 md:pt-6 border-t border-border-subtle">
          <div class="text-center">
            <p class="text-size-1 font-bold text-gradient-static">{{ nearbyPlayers.current?.rank }}</p>
            <p class="text-size-4 text-foreground-muted">Tu Posición</p>
          </div>
          <div class="text-center">
            <p class="text-size-1 font-bold text-foreground">{{ nearbyPlayers.current?.elo }}</p>
            <p class="text-size-4 text-foreground-muted">ELO Actual</p>
          </div>
          <div class="text-center">
            <p class="text-size-1 font-bold text-foreground">{{ nearbyPlayers.current?.total_matches_played }}</p>
            <p class="text-size-4 text-foreground-muted">Partidos</p>
          </div>
          <div class="text-center">
            <p class="text-size-1 font-bold text-foreground">
              {{ nearbyPlayers.above[0] ? nearbyPlayers.above[0].elo - (nearbyPlayers.current?.elo || 0) : 0 }}
            </p>
            <p class="text-size-4 text-foreground-muted">ELO para subir</p>
          </div>
        </div>
      </div>

      <!-- Filters Section -->
      <div class="glass-card p-4 mb-6 animate-fade-up animate-delay-3">
        <div class="flex flex-col md:flex-row gap-4">
          <!-- Search -->
          <div class="flex-1">
            <input 
              v-model="searchQuery"
              type="text"
              class="form-input"
              placeholder="Buscar jugador por nombre..."
              @input="onSearchInput"
            />
          </div>
          
          <!-- Tier Filter -->
          <div class="w-full md:w-48">
            <select v-model="selectedTier" class="form-select" @change="onTierChange">
              <option :value="undefined">Todos los tiers</option>
              <option value="Bronze">🥉 Bronce</option>
              <option value="Silver">🥈 Plata</option>
              <option value="Gold">🥇 Oro</option>
              <option value="Platinum">💎 Platino</option>
              <option value="Diamond">💠 Diamante</option>
              <option value="Master">👑 Maestro</option>
              <option value="Grandmaster">🏆 Gran Maestro</option>
            </select>
          </div>
          
          <!-- City Filter -->
          <div class="w-full md:w-48">
            <select v-model="selectedCity" class="form-select" @change="onCityChange">
              <option :value="undefined">Todas las ciudades</option>
              <option v-for="city in cities" :key="city.id" :value="city.id">
                {{ city.name }}
              </option>
            </select>
          </div>
          
          <!-- Clear Filters -->
          <button 
            v-if="hasActiveFilters"
            class="btn-secondary md:w-auto"
            @click="clearAllFilters"
          >
            <Icon name="heroicons:x-mark" class="w-4 h-4" />
            Limpiar
          </button>
        </div>
      </div>

      <!-- Leaderboard List -->
      <div class="glass-card-elevated p-4 sm:p-6 animate-fade-up animate-delay-4">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-accent-subtle flex items-center justify-center">
              <Icon name="heroicons:chart-bar" class="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 class="text-size-3 font-semibold text-foreground">Clasificación General</h2>
              <p class="text-size-4 text-foreground-muted">
                {{ isAuthenticated && player && showAroundMe 
                  ? `Jugadores ${selectedTier ? `en ${getTierNameInSpanish(selectedTier)}` : 'alrededor de tu posición'}` 
                  : `${total} jugadores clasificados` 
                }}
              </p>
            </div>
          </div>
          
          <!-- Toggle View Button (if authenticated) -->
          <div v-if="isAuthenticated && player" class="flex items-center gap-3">
            <button 
              class="btn-secondary !px-3 !py-2 text-size-4"
              @click="toggleView"
            >
              <Icon :name="showAroundMe ? 'heroicons:globe-alt' : 'heroicons:user'" class="w-4 h-4 mr-2" />
              {{ showAroundMe ? 'Ver Todos' : 'Ver Alrededor Mío' }}
            </button>
          </div>
        </div>
        
        <!-- Loading State for List -->
        <div v-if="loading && rankings.length === 0" class="py-12 text-center">
          <Icon name="heroicons:arrow-path" class="w-8 h-8 text-accent animate-spin mx-auto mb-4" />
          <p class="text-size-4 text-foreground-muted">Cargando rankings...</p>
        </div>
        
        <!-- Scrollable Rankings List -->
        <div 
          v-else-if="rankings.length > 0"
          ref="scrollContainer"
          class="relative max-h-[400px] sm:max-h-[500px] md:max-h-[600px] overflow-y-auto scroll-smooth"
          @scroll="onScroll"
        >
          <!-- Load More Above Indicator -->
          <div 
            v-if="hasMoreAbove && isLoadingMore"
            class="sticky top-0 z-10 py-2 text-center bg-background/80 backdrop-blur-sm border-b border-border-subtle"
          >
            <Icon name="heroicons:arrow-path" class="w-5 h-5 text-accent animate-spin mx-auto" />
          </div>
          
          <!-- Rankings List -->
          <div class="space-y-2">
            <LeaderboardPlayerCard 
              v-for="p in rankings" 
              :key="`${p.id}-${p.rank}`" 
              :player="p"
            />
          </div>
          
          <!-- Load More Below Indicator -->
          <div 
            v-if="hasMoreBelow && isLoadingMore"
            class="sticky bottom-0 z-10 py-2 text-center bg-background/80 backdrop-blur-sm border-t border-border-subtle"
          >
            <Icon name="heroicons:arrow-path" class="w-5 h-5 text-accent animate-spin mx-auto" />
          </div>
        </div>
        
        <!-- Empty State -->
        <div v-else class="empty-state py-12">
          <Icon name="heroicons:user-group" class="empty-state-icon" />
          <h3 class="empty-state-title">No se encontraron jugadores</h3>
          <p class="empty-state-description">
            {{ hasActiveFilters 
              ? 'Intenta ajustar los filtros de búsqueda' 
              : 'Aún no hay jugadores clasificados en el sistema' 
            }}
          </p>
          <button v-if="hasActiveFilters" class="btn-primary" @click="clearAllFilters">
            Limpiar filtros
          </button>
        </div>
      </div>

    </template>
  </PageLayout>
</template>

<script setup lang="ts">
import type { RatingTier, City } from '~/types'

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
  if (showAroundMe.value && player.value?.id) {
    // If in "around me" mode, reload around user with new tier
    await loadPlayersAroundUser()
    // Update top players from current ranking
    if (rankings.value.length >= 3) {
      topPlayers.value = rankings.value.slice(0, 3)
    }
  } else {
    // Normal filter
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
  
  // Scroll to user after a short delay to ensure DOM is ready
  await nextTick()
  setTimeout(() => {
    scrollToUser()
  }, 100)
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

// Scroll to user's position
const scrollToUser = () => {
  nextTick(() => {
    if (scrollContainer.value) {
      // Find the user's card element
      const userCard = scrollContainer.value.querySelector('[data-user-card="true"]') as HTMLElement
      if (userCard) {
        // Scroll to top of container, then adjust to show user at top
        scrollContainer.value.scrollTop = userCard.offsetTop - scrollContainer.value.offsetTop
      }
    }
  })
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

// Initialize on mount
onMounted(() => {
  initialize()
})
</script>

<style scoped>
.text-gradient-static {
  background: linear-gradient(135deg, var(--accent), var(--accent-secondary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

@keyframes pulse-slow {
  0%, 100% {
    box-shadow: 0 0 20px oklch(0.80 0.20 60 / 0.3);
  }
  50% {
    box-shadow: 0 0 30px oklch(0.80 0.20 60 / 0.5);
  }
}

.animate-pulse-slow {
  animation: pulse-slow 3s ease-in-out infinite;
}
</style>
