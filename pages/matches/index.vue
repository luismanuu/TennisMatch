<template>
  <PageLayout>
    <PageHeader title="Tus partidos" subtitle="Programados, en curso y completados.">
      <template v-if="isAuthenticated" #actions>
        <NuxtLink to="/matches/new" class="btn-primary">
          Programar partido
          <Icon name="heroicons:plus" class="w-5 h-5" aria-hidden="true" />
        </NuxtLink>
        <NuxtLink to="/matchmaking" class="text-link">
          Buscar rival
          <Icon name="heroicons:magnifying-glass" class="w-5 h-5" aria-hidden="true" />
        </NuxtLink>
      </template>
    </PageHeader>

    <div v-if="loading" class="panel loading-state" aria-busy="true">
      <Icon name="heroicons:arrow-path" class="loading-spinner animate-spin" aria-hidden="true" />
      <p class="loading-text">Cargando partidos…</p>
    </div>

    <div v-else-if="error" class="panel empty-state" role="alert">
      <Icon name="heroicons:exclamation-triangle" class="empty-state-icon text-danger" aria-hidden="true" />
      <h2 class="empty-state-title">No pudimos cargar tus partidos</h2>
      <p class="empty-state-description">{{ error.message }}</p>
      <button type="button" class="btn-primary" @click="loadMatches">
        <Icon name="heroicons:arrow-path" class="w-5 h-5" aria-hidden="true" />
        Reintentar
      </button>
    </div>

    <template v-else>
      <!-- Status + view -->
      <div class="toolbar">
        <div class="chips" role="group" aria-label="Filtrar por estado">
          <button
            v-for="f in statusFilters"
            :key="f.label"
            type="button"
            class="chip"
            :aria-pressed="statusFilter === f.value"
            @click="statusFilter = f.value"
          >
            <Icon :name="f.icon" class="w-4 h-4" aria-hidden="true" />
            {{ f.label }}
          </button>
        </div>
        <div class="segmented segmented--two" role="group" aria-label="Vista">
          <button type="button" :aria-pressed="viewMode === 'list'" @click="viewMode = 'list'">
            <Icon name="heroicons:list-bullet" class="w-4 h-4" aria-hidden="true" />
            Lista
          </button>
          <button type="button" :aria-pressed="viewMode === 'calendar'" @click="viewMode = 'calendar'">
            <Icon name="heroicons:calendar-days" class="w-4 h-4" aria-hidden="true" />
            Calendario
          </button>
        </div>
      </div>

      <!-- Date + opponent filters -->
      <details class="panel filters" :open="!!(dateFilterStart || dateFilterEnd || opponentFilter)">
        <summary>
          Filtrar por fecha o rival
          <span v-if="appliedDateFilterStart || appliedDateFilterEnd || opponentFilter" class="badge badge-accent ml-2">Activos</span>
          <Icon name="heroicons:chevron-down" class="filters__chevron w-5 h-5" aria-hidden="true" />
        </summary>
        <div class="filters__grid">
          <div>
            <label for="m-from" class="form-label">Desde</label>
            <input id="m-from" v-model="dateFilterStart" type="date" class="form-input" @change="handleDateInputChange" @keyup.enter="applyDateFilter">
          </div>
          <div>
            <label for="m-to" class="form-label">Hasta</label>
            <input id="m-to" v-model="dateFilterEnd" type="date" class="form-input" @change="handleDateInputChange" @keyup.enter="applyDateFilter">
          </div>
          <div class="filters__opponent">
            <label for="m-opp" class="form-label">Rival</label>
            <input
              id="m-opp"
              v-model="opponentSearchQuery"
              type="search"
              class="form-input"
              placeholder="Buscar por nombre"
              autocomplete="off"
              @input="handleOpponentSearch"
              @focus="showOpponentSearchResults = true"
              @blur="handleInputBlur"
            >
            <div v-if="showOpponentSearchResults && opponentSearchResults.length > 0" class="list-surface filters__results" @mousedown.prevent>
              <button
                v-for="result in opponentSearchResults"
                :key="result.id"
                type="button"
                class="list-row w-full text-left"
                @click.stop="selectOpponent(result)"
                @mousedown.stop
              >
                <span class="row-copy"><strong>{{ result.name }}</strong></span>
                <span v-if="getPlayerTier(result)" class="badge">
                  <img v-if="getPlayerRankIcon(result)" :src="getPlayerRankIcon(result)" alt="" class="w-4 h-4 object-contain">
                  {{ getTierNameInSpanish(getPlayerTier(result)) }}
                </span>
              </button>
            </div>
          </div>
        </div>
        <div class="quick-actions filters__actions">
          <button
            v-if="(dateFilterStart || dateFilterEnd) && (dateFilterStart !== appliedDateFilterStart || dateFilterEnd !== appliedDateFilterEnd)"
            type="button"
            class="btn-primary"
            @click="applyDateFilter"
          >
            <Icon name="heroicons:check" class="w-4 h-4" aria-hidden="true" />
            Aplicar fechas
          </button>
          <button v-if="dateFilterStart || dateFilterEnd" type="button" class="text-link" @click="clearDateFilter">Limpiar fechas</button>
          <span v-if="opponentFilter" class="badge">
            Rival: {{ selectedOpponentName }}
            <button type="button" class="chip-x" aria-label="Quitar filtro de rival" @click="clearOpponentFilter">
              <Icon name="heroicons:x-mark" class="w-4 h-4" aria-hidden="true" />
            </button>
          </span>
        </div>
      </details>

      <p v-if="isShowingDefault24HourFilter && viewMode === 'list'" class="meta hint">
        <Icon name="heroicons:information-circle" class="w-4 h-4 text-accent flex-shrink-0" aria-hidden="true" />
        Mostrando partidos de las últimas 24 horas por defecto. Usa las fechas para ver más.
      </p>

      <div v-if="viewMode === 'calendar'" class="panel">
        <MatchesCalendar :matches="filteredMatchesForCalendar" :loading="loading" @navigate="handleMatchNavigate" />
      </div>

      <!-- Historial -->
      <div v-if="viewMode === 'list' && paginatedFilteredMatches.length > 0" class="list-surface">
        <div
          v-for="match in paginatedFilteredMatches"
          :key="match.id"
          class="list-row match-row"
          role="link"
          tabindex="0"
          @click="navigateTo(`/matches/${match.id}`)"
          @keydown.enter="navigateTo(`/matches/${match.id}`)"
        >
          <span
            class="avatar result-mark"
            :class="match.status === 'completed' && match.winner_id && player ? (didUserWin(match) === true ? 'is-win' : didUserWin(match) === false ? 'is-loss' : '') : ''"
            :aria-label="match.status === 'completed' && match.winner_id && player ? (didUserWin(match) ? 'Victoria' : 'Derrota') : undefined"
          >
            <Icon v-if="match.status === 'completed' && match.winner_id && player && didUserWin(match) !== null" :name="didUserWin(match) ? 'heroicons:check' : 'heroicons:x-mark'" class="w-5 h-5" aria-hidden="true" />
            <Icon v-else :name="getStatusIcon(match.status)" class="w-5 h-5" aria-hidden="true" />
          </span>
          <span class="row-copy">
            <strong class="match-row__names">
              <NuxtLink v-if="match.player1" :to="`/players/${match.player1.id}`" @click.stop>{{ match.player1.name }}</NuxtLink>
              <template v-else>Jugador 1</template>
              <span class="meta inline"> vs </span>
              <NuxtLink v-if="match.player2" :to="`/players/${match.player2.id}`" @click.stop>{{ match.player2.name }}</NuxtLink>
              <NuxtLink v-else-if="match.pending_player2" :to="`/players/${match.pending_player2.id}`" @click.stop>{{ match.pending_player2.name }}</NuxtLink>
              <template v-else>Jugador 2</template>
            </strong>
            <span class="meta">
              <template v-if="(match.status === 'completed' && match.played_at) || (match.status !== 'completed' && match.scheduled_at)">{{ formatDate(match.status === 'completed' && match.played_at ? match.played_at : match.scheduled_at) }}</template>
              <template v-if="match.location">{{ ((match.status === 'completed' && match.played_at) || (match.status !== 'completed' && match.scheduled_at)) ? ' · ' : '' }}{{ match.location }}</template>
            </span>
            <span class="match-row__tags">
              <span class="status-badge" :class="getStatusBadgeClass(match.status, match.scheduled_at)">{{ getStatusLabel(match.status, match.scheduled_at) }}</span>
              <span class="badge">{{ match.is_competitive !== false ? 'Competitivo' : 'Amistoso' }}</span>
              <MatchTournamentBadge :match="match" />
              <span v-if="match.pending_player2" class="status-badge status-badge-pending">Rival pendiente de registro</span>
              <span v-if="match.player1?.status === 'deleted' || match.player2?.status === 'deleted'" class="status-badge status-badge-danger">Jugador eliminado</span>
            </span>
          </span>
          <span v-if="match.score && (match.status === 'completed' || match.score_approved_by)" class="row-end match-row__result">
            <strong class="numeric">{{ formatScore(match.score) }}</strong>
            <span v-if="match.winner" class="meta">Ganó <NuxtLink :to="`/players/${match.winner.id}`" @click.stop>{{ match.winner.name }}</NuxtLink></span>
          </span>
          <span v-else-if="match.status === 'active' && match.score_proposed_by && !match.score_approved_by" class="row-end match-row__result">
            <strong class="numeric text-warning">{{ formatScore(match.score) }}</strong>
            <span class="meta">Marcador propuesto</span>
          </span>
          <Icon v-else name="heroicons:chevron-right" class="w-5 h-5 text-foreground-muted" aria-hidden="true" />
        </div>
      </div>

      <nav
        v-if="viewMode === 'list' && (totalFilteredPages > 1 || (matches.value && matches.value.length >= pageSize && (pagination.value?.hasMore || pagination.value?.totalPages > 1)))"
        class="pager"
        aria-label="Paginación"
      >
        <button type="button" class="btn-secondary" :disabled="currentPage === 1" @click="handlePreviousPage">
          <Icon name="heroicons:chevron-left" class="w-4 h-4" aria-hidden="true" />
          Anterior
        </button>
        <span class="meta numeric">Página {{ currentPage }} de {{ totalFilteredPages }}</span>
        <button type="button" class="btn-secondary" :disabled="currentPage >= totalFilteredPages" @click="handleNextPage">
          Siguiente
          <Icon name="heroicons:chevron-right" class="w-4 h-4" aria-hidden="true" />
        </button>
      </nav>

      <div v-if="viewMode === 'list' && paginatedFilteredMatches.length === 0" class="panel empty-state">
        <Icon name="heroicons:calendar" class="empty-state-icon" aria-hidden="true" />
        <h2 class="empty-state-title">
          {{ statusFilter === 'pending' ? 'No hay acciones pendientes' : statusFilter ? `No hay partidos ${getStatusLabel(statusFilter).toLowerCase()}` : 'No hay partidos' }}
        </h2>
        <p class="empty-state-description">
          {{ statusFilter === 'pending' ? 'No tienes partidos que requieran tu atención en este momento.' : statusFilter ? 'Prueba con otro filtro para ver más partidos.' : 'Programa tu primer partido y empieza a sumar SR.' }}
        </p>
        <NuxtLink v-if="isAuthenticated && !statusFilter" to="/matches/new" class="btn-primary">
          Programar partido
          <Icon name="heroicons:plus" class="w-5 h-5" aria-hidden="true" />
        </NuxtLink>
      </div>
    </template>
  </PageLayout>
</template>

<script setup lang="ts">
import { formatScore } from '~/utils/pendingAction'
import { useRankIconAsset } from '~/composables/useRankIcon'
import { getRatingTier } from '~/server/utils/rating-system'
import { usePlayerSearch } from '~/composables/usePlayerSearch'

definePageMeta({
  middleware: []
})

// Use shared auth state composable for consistent behavior
const { isAuthenticated, isLoaded, userId } = useAuthState()
const { player, fetchPlayer } = usePlayer()

const { matches, pagination, loading, error, fetchMatches } = useMatches()
const { searchPlayers: searchOpponents, results: opponentSearchResultsData, clearResults: clearOpponentResults } = usePlayerSearch()

const route = useRoute()
const statusFilter = ref<string | null>(null)
const dateFilterStart = ref<string>('')
const dateFilterEnd = ref<string>('')
const currentPage = ref(1)
const pageSize = 10
const opponentFilter = ref<string | null>(null)
const opponentSearchQuery = ref('')
const showOpponentSearchResults = ref(false)
const opponentSearchResults = ref<any[]>([])
const viewMode = ref<'list' | 'calendar'>('list')

// Opponent filter functions
const selectedOpponentName = ref<string>('')

const loadOpponentName = async (opponentId: string) => {
  try {
    console.log('[Matches] Loading opponent name for ID:', opponentId)
    const player = await $fetch(`/api/players/${opponentId}`)
    if (player && player.name) {
      console.log('[Matches] Opponent loaded:', player.name)
      selectedOpponentName.value = player.name || 'Oponente'
      opponentSearchQuery.value = player.name || ''
    } else {
      console.warn('[Matches] No data returned for opponent:', opponentId, player)
    }
  } catch (err) {
    console.error('[Matches] Error loading opponent name:', err)
    // Set a fallback name if the player can't be loaded
    selectedOpponentName.value = 'Oponente'
    opponentSearchQuery.value = ''
  }
}

// Watch for opponent search results
watch(() => opponentSearchResultsData.value, (newResults) => {
  opponentSearchResults.value = [...newResults]
})

// Watch for route query changes to handle opponent_id from URL
watch(() => route.query.opponent_id, async (opponentId, oldOpponentId) => {
  console.log('[Matches] Route opponent_id changed:', { opponentId, oldOpponentId, isLoaded: isLoaded.value, userId: userId.value })
  if (opponentId && typeof opponentId === 'string') {
    console.log('[Matches] Setting opponent filter:', opponentId)
    opponentFilter.value = opponentId
    await loadOpponentName(opponentId)
    // Reload matches if auth is already loaded
    if (isLoaded.value && userId.value) {
      console.log('[Matches] Reloading matches with opponent filter')
      currentPage.value = 1
      await loadMatches(1)
    } else {
      console.log('[Matches] Auth not loaded yet, will load matches when auth is ready')
    }
  } else if (opponentId === null || opponentId === undefined) {
    // Clear filter if opponent_id is removed from URL
    if (opponentFilter.value) {
      console.log('[Matches] Clearing opponent filter')
      opponentFilter.value = null
      selectedOpponentName.value = ''
      opponentSearchQuery.value = ''
      if (isLoaded.value && userId.value) {
        currentPage.value = 1
        await loadMatches(1)
      }
    }
  }
}, { immediate: true })

// Watch for opponent filter changes to reload matches
watch(opponentFilter, async (newFilter, oldFilter) => {
  console.log('[Matches] opponentFilter changed:', { newFilter, oldFilter, isLoaded: isLoaded.value, userId: userId.value })
  // Only reload if auth is loaded and filter actually changed
  // Skip if this is the initial set from URL (handled by route watch)
  if (isLoaded.value && userId.value && newFilter !== oldFilter && oldFilter !== undefined) {
    console.log('[Matches] Reloading matches due to opponent filter change')
    currentPage.value = 1
    await loadMatches(1)
  }
})

// Watch for when auth loads after opponent_id is already in URL
watch(isLoaded, async (loaded) => {
  console.log('[Matches] isLoaded changed:', { loaded, userId: userId.value, opponentId: route.query.opponent_id, opponentFilter: opponentFilter.value })
  if (loaded && userId.value) {
    const opponentId = route.query.opponent_id
    if (opponentId && typeof opponentId === 'string') {
      // If opponent_id is in URL but filter not set yet, set it
      if (!opponentFilter.value || opponentFilter.value !== opponentId) {
        console.log('[Matches] Setting opponent filter from isLoaded watch:', opponentId)
        opponentFilter.value = opponentId
        await loadOpponentName(opponentId)
      }
      // Load matches with opponent filter
      console.log('[Matches] Loading matches with opponent filter from isLoaded watch')
      currentPage.value = 1
      await loadMatches(1)
    } else if (!opponentId && matches.value.length === 0) {
      // Only load matches if no opponent_id and no matches loaded yet
      console.log('[Matches] Loading matches without opponent filter')
      await loadMatches(1)
    }
  }
})

// Check for query parameter to set initial filter
onMounted(() => {
  if (route.query.filter === 'pending') {
    statusFilter.value = 'pending'
  }
})

const filteredMatches = computed(() => {
  // Start with a copy to avoid mutating the original array
  // Handle case when matches.value is undefined
  if (!matches.value || !Array.isArray(matches.value)) {
    return []
  }
  let filtered = [...matches.value]
  
  // Apply status filter
  if (statusFilter.value === 'pending') {
    // Show matches where CURRENT USER has a pending action to take
    // This requires complex client-side filtering
    filtered = filtered.filter(m => {
      if (!player.value) return false
      
      // Exclude cancelled matches
      if (m.status === 'cancelled') return false
      
      const isPlayer1 = m.player1_id === player.value.id
      const isPlayer2 = m.player2_id === player.value.id
      
      // User must be involved in the match
      if (!isPlayer1 && !isPlayer2) return false
      
      // 1. Match proposal pending acceptance (only for player2, not player1 who proposed)
      if (m.match_proposed_by && !m.match_accepted_by && !m.match_rejected_by) {
        // Only show if current user is player2 (the one who needs to accept)
        if (isPlayer2 && m.match_proposed_by !== player.value.id) {
          return true
        }
      }
      
      // 2. Score proposal pending approval (only for the opponent, not the proposer)
      if (m.score_proposed_by && !m.score_approved_by) {
        // Only show if current user is NOT the one who proposed the score
        if (m.score_proposed_by !== player.value.id) {
          return true
        }
      }
      
      // 3. Schedule proposal pending approval (only for the opponent, not the proposer)
      if (m.schedule_proposed_by && !m.schedule_approved_by && !m.schedule_rejected_by) {
        // Only show if current user is NOT the one who proposed the schedule
        if (m.schedule_proposed_by !== player.value.id) {
          return true
        }
      }
      
      // 4. Reschedule proposal pending approval (only for the opponent, not the proposer)
      if (m.reschedule_proposed_by && !m.reschedule_approved_by && !m.reschedule_rejected_by) {
        // Only show if current user is NOT the one who proposed the reschedule
        if (m.reschedule_proposed_by !== player.value.id) {
          return true
        }
      }
      
      // 5. Acceptance change pending approval (only for player1 who originally proposed, not player2)
      if (m.acceptance_proposed_scheduled_at && !m.acceptance_change_approved_by && !m.acceptance_change_rejected_by) {
        // Only show if current user is player1 (the one who originally proposed the match)
        if (isPlayer1 && m.match_proposed_by === player.value.id) {
          return true
        }
      }
      
      return false
    })
  } else {
    // For non-pending filters, backend already filters by status
    // But we still apply client-side filtering for consistency and to handle edge cases
    // (e.g., if backend filtering isn't perfect, or for cancelled filter)
    if (statusFilter.value === 'cancelled') {
      filtered = filtered.filter(m => m.status === 'cancelled')
    } else if (!statusFilter.value) {
      filtered = filtered.filter(m => m.status !== 'cancelled')
    } else {
      filtered = filtered.filter(m => m.status === statusFilter.value)
    }
  }
  
  // Always re-sort to maintain order
  // This ensures consistent ordering regardless of filter
  // Sort BEFORE pagination to ensure correct order
  // For completed matches, use played_at if available, otherwise scheduled_at
  // For other matches, use scheduled_at
  // Use toSorted() to avoid mutating the array
  filtered = filtered.toSorted((a, b) => {
    // Get the appropriate date for sorting
    const getSortDate = (match: any) => {
      // For completed matches, prefer played_at if available, otherwise scheduled_at
      if (match.status === 'completed' && match.played_at) {
        return match.played_at
      }
      return match.scheduled_at
    }
    
    const dateAStr = getSortDate(a)
    const dateBStr = getSortDate(b)
    
    // Only compare if both have dates
    if (!dateAStr && !dateBStr) {
      // Both have no date, use created_at as tiebreaker
      const createdA = a.created_at ? new Date(a.created_at).getTime() : 0
      const createdB = b.created_at ? new Date(b.created_at).getTime() : 0
      return createdB - createdA
    }
    if (!dateAStr) return 1 // Put matches without date at the end
    if (!dateBStr) return -1 // Put matches without date at the end
    
    const dateA = new Date(dateAStr).getTime()
    const dateB = new Date(dateBStr).getTime()
    
    // Handle invalid dates
    if (isNaN(dateA) && isNaN(dateB)) {
      // Both have invalid dates, use created_at as tiebreaker
      const createdA = a.created_at ? new Date(a.created_at).getTime() : 0
      const createdB = b.created_at ? new Date(b.created_at).getTime() : 0
      return createdB - createdA
    }
    if (isNaN(dateA)) return 1
    if (isNaN(dateB)) return -1
    
    // Descending order (newest first) - most recent date first
    const diff = dateB - dateA
    if (diff !== 0) return diff
    
    // If dates are equal, use created_at as tiebreaker (newest first)
    const createdA = a.created_at ? new Date(a.created_at).getTime() : 0
    const createdB = b.created_at ? new Date(b.created_at).getTime() : 0
    return createdB - createdA
  })
  
  // Return all filtered and sorted matches (pagination is handled by paginatedFilteredMatches)
  return filtered
})

const paginatedFilteredMatches = computed(() => {
  // For 'pending' filter, apply client-side pagination
  if (statusFilter.value === 'pending') {
    const start = (currentPage.value - 1) * pageSize
    const end = start + pageSize
    return filteredMatches.value.slice(start, end)
  }
  // For all other filters, backend already returns paginated results
  // Just return the filtered matches (which are already paginated by backend)
  return filteredMatches.value
})

const totalFilteredPages = computed(() => {
  // For 'pending' filter, use client-side pagination
  if (statusFilter.value === 'pending') {
    const pages = Math.ceil(filteredMatches.value.length / pageSize)
    return pages > 0 ? pages : 1
  }
  // For all other filters, use backend pagination
  // First, try to use totalPages from backend
  if (pagination.value?.totalPages !== undefined && pagination.value.totalPages > 0) {
    console.log('[Matches] totalFilteredPages: Using backend totalPages:', pagination.value.totalPages)
    return pagination.value.totalPages
  }
  // Fallback: calculate from total if available
  if (pagination.value?.total !== undefined && pagination.value.total > 0) {
    const calculated = Math.ceil(pagination.value.total / pageSize)
    console.log('[Matches] totalFilteredPages: Calculated from total:', calculated, 'total:', pagination.value.total)
    return calculated
  }
  // If we have exactly pageSize matches, check hasMore
  if (matches.value && matches.value.length === pageSize) {
    // If hasMore is explicitly false, we know this is the last page
    if (pagination.value?.hasMore === false) {
      console.log('[Matches] totalFilteredPages: hasMore is false, returning 1')
      return 1
    }
    // If hasMore is true or undefined, assume there might be more pages
    const estimated = Math.max(2, currentPage.value + 1)
    console.log('[Matches] totalFilteredPages: Estimated pages from hasMore:', estimated, 'hasMore:', pagination.value?.hasMore)
    return estimated
  }
  // Default: only one page
  console.log('[Matches] totalFilteredPages: Default to 1, matches.length:', matches.value?.length || 0)
  return 1
})

// Determine if we're showing the default 24-hour filter
const isShowingDefault24HourFilter = computed(() => {
  // Show message when:
  // 1. No status filter is applied (showing "Todos")
  // 2. No date filters are applied
  // 3. No opponent filter is applied
  return (
    statusFilter.value === null &&
    !appliedDateFilterStart.value &&
    !appliedDateFilterEnd.value &&
    !opponentFilter.value
  )
})

// Filtered matches for calendar view (all matches, not paginated)
const filteredMatchesForCalendar = computed(() => {
  // Use the same filtering logic as filteredMatches but return all matches
  if (!matches.value || !Array.isArray(matches.value)) {
    return []
  }
  let filtered = [...matches.value]
  
  // Apply status filter
  if (statusFilter.value === 'pending') {
    if (!player.value) return []
    
    filtered = filtered.filter(m => {
      if (m.status === 'cancelled') return false
      
      const isPlayer1 = m.player1_id === player.value.id
      const isPlayer2 = m.player2_id === player.value.id
      
      if (!isPlayer1 && !isPlayer2) return false
      
      if (m.match_proposed_by && !m.match_accepted_by && !m.match_rejected_by) {
        if (isPlayer2 && m.match_proposed_by !== player.value.id) {
          return true
        }
      }
      
      if (m.score_proposed_by && !m.score_approved_by) {
        if (m.score_proposed_by !== player.value.id) {
          return true
        }
      }
      
      if (m.schedule_proposed_by && !m.schedule_approved_by && !m.schedule_rejected_by) {
        if (m.schedule_proposed_by !== player.value.id) {
          return true
        }
      }
      
      if (m.reschedule_proposed_by && !m.reschedule_approved_by && !m.reschedule_rejected_by) {
        if (m.reschedule_proposed_by !== player.value.id) {
          return true
        }
      }
      
      if (m.acceptance_proposed_scheduled_at && !m.acceptance_change_approved_by && !m.acceptance_change_rejected_by) {
        if (isPlayer1 && m.match_proposed_by === player.value.id) {
          return true
        }
      }
      
      return false
    })
  } else {
    if (statusFilter.value === 'cancelled') {
      filtered = filtered.filter(m => m.status === 'cancelled')
    } else if (!statusFilter.value) {
      filtered = filtered.filter(m => m.status !== 'cancelled')
    } else {
      filtered = filtered.filter(m => m.status === statusFilter.value)
    }
  }
  
  // Apply opponent filter
  if (opponentFilter.value) {
    filtered = filtered.filter(m => 
      m.player1_id === opponentFilter.value || 
      m.player2_id === opponentFilter.value ||
      m.pending_player2_id === opponentFilter.value
    )
  }
  
  // Sort by date (same as filteredMatches)
  filtered = filtered.toSorted((a, b) => {
    const getSortDate = (match: any) => {
      if (match.status === 'completed' && match.played_at) {
        return match.played_at
      }
      return match.scheduled_at
    }
    
    const dateAStr = getSortDate(a)
    const dateBStr = getSortDate(b)
    
    if (!dateAStr && !dateBStr) {
      const createdA = a.created_at ? new Date(a.created_at).getTime() : 0
      const createdB = b.created_at ? new Date(b.created_at).getTime() : 0
      return createdB - createdA
    }
    if (!dateAStr) return 1
    if (!dateBStr) return -1
    
    const dateA = new Date(dateAStr).getTime()
    const dateB = new Date(dateBStr).getTime()
    
    if (isNaN(dateA) && isNaN(dateB)) {
      const createdA = a.created_at ? new Date(a.created_at).getTime() : 0
      const createdB = b.created_at ? new Date(b.created_at).getTime() : 0
      return createdB - createdA
    }
    if (isNaN(dateA)) return 1
    if (isNaN(dateB)) return -1
    
    const diff = dateB - dateA
    if (diff !== 0) return diff
    
    const createdA = a.created_at ? new Date(a.created_at).getTime() : 0
    const createdB = b.created_at ? new Date(b.created_at).getTime() : 0
    return createdB - createdA
  })
  
  return filtered
})

// Handle match navigation from calendar
const handleMatchNavigate = (matchId: string) => {
  navigateTo(`/matches/${matchId}`)
}

const handleOpponentSearch = async () => {
  if (opponentSearchQuery.value.trim().length >= 2) {
    await searchOpponents(opponentSearchQuery.value, player.value?.id)
    showOpponentSearchResults.value = true
  } else {
    clearOpponentResults()
    showOpponentSearchResults.value = false
  }
}

const handleInputBlur = () => {
  // Delay closing to allow click on results to register
  setTimeout(() => {
    showOpponentSearchResults.value = false
  }, 200)
}

const selectOpponent = (opponent: any) => {
  opponentFilter.value = opponent.id
  selectedOpponentName.value = opponent.name
  opponentSearchQuery.value = opponent.name
  showOpponentSearchResults.value = false
  currentPage.value = 1
  loadMatches(1)
}

const clearOpponentFilter = () => {
  opponentFilter.value = null
  selectedOpponentName.value = ''
  opponentSearchQuery.value = ''
  showOpponentSearchResults.value = false
  clearOpponentResults()
  currentPage.value = 1
  loadMatches(1)
}

const loadMatches = async (page: number = 1) => {
  if (isLoaded.value && userId.value) {
    // Use backend filtering with pagination for all filters
    // Default: show matches from last 24 hours ONLY when statusFilter is null (Todos)
    // Status filter is handled by backend when statusFilter is set
    const filters: { status?: string; start_date?: string; end_date?: string; skip_24h_filter?: boolean; opponent_id?: string } = {}
    
    // For calendar view, load all matches for the visible period (no pagination)
    if (viewMode.value === 'calendar') {
      filters.skip_24h_filter = true
      
      // Calculate date range for calendar (current month or current week)
      // For now, load matches from 3 months ago to 3 months ahead
      const now = new Date()
      const startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1)
      const endDate = new Date(now.getFullYear(), now.getMonth() + 4, 0) // Last day of month 3 months ahead
      endDate.setHours(23, 59, 59, 999)
      
      filters.start_date = startDate.toISOString()
      filters.end_date = endDate.toISOString()
      
      // Apply status filter if set
      if (statusFilter.value && statusFilter.value !== 'pending') {
        filters.status = statusFilter.value
      }
      
      // Apply opponent filter if set
      if (opponentFilter.value) {
        filters.opponent_id = opponentFilter.value
      }
      
      // Override with user date filters if applied
      if (appliedDateFilterStart.value) {
        filters.start_date = new Date(appliedDateFilterStart.value).toISOString()
      }
      if (appliedDateFilterEnd.value) {
        const endDate = new Date(appliedDateFilterEnd.value)
        endDate.setHours(23, 59, 59, 999)
        filters.end_date = endDate.toISOString()
      }
      
      // Load all matches (large limit for calendar view)
      const limit = 1000
      console.log('[Matches] loadMatches: Loading matches for calendar view, filters:', filters)
      await fetchMatches(userId.value, 1, limit, filters)
      currentPage.value = 1
      return
    }
    
    // For 'pending' filter, we need to load all matches and filter client-side
    // because it requires complex logic based on match state
    if (statusFilter.value === 'pending') {
      filters.skip_24h_filter = true
      // Load a large number to ensure we catch all pending actions, then paginate client-side
      const limit = 1000
      console.log('[Matches] loadMatches: Loading all matches for pending filter, limit:', limit)
      await fetchMatches(userId.value, 1, limit, filters)
      currentPage.value = page
      return
    }
    
    // For all other filters, use backend pagination with page size 10
    if (statusFilter.value) {
      filters.status = statusFilter.value
    }
    
    // Apply date filters if set by user (use applied values, not input values)
    if (appliedDateFilterStart.value) {
      filters.start_date = new Date(appliedDateFilterStart.value).toISOString()
    }
    if (appliedDateFilterEnd.value) {
      // Set end date to end of day
      const endDate = new Date(appliedDateFilterEnd.value)
      endDate.setHours(23, 59, 59, 999)
      filters.end_date = endDate.toISOString()
    }
    
    // Apply opponent filter if set
    if (opponentFilter.value) {
      filters.opponent_id = opponentFilter.value
      // When filtering by opponent, skip 24-hour filter to show all matches
      filters.skip_24h_filter = true
      console.log('[Matches] loadMatches: Applying opponent filter:', opponentFilter.value)
    } else {
      console.log('[Matches] loadMatches: No opponent filter')
    }
    
    // Use page size 10 for all filters (backend pagination)
    const limit = pageSize
    console.log('[Matches] loadMatches: Calling fetchMatches with filters:', filters, 'page:', page, 'limit:', limit)
    await fetchMatches(userId.value, page, limit, filters)
    console.log('[Matches] loadMatches: Matches loaded:', matches.value.length)
    currentPage.value = page
  }
}

// Track applied date filters (separate from input values)
const appliedDateFilterStart = ref<string>('')
const appliedDateFilterEnd = ref<string>('')

// Handle date input changes (don't apply immediately)
const handleDateInputChange = () => {
  // Auto-apply only if both dates are selected
  if (dateFilterStart.value && dateFilterEnd.value) {
    applyDateFilter()
  }
  // Otherwise, just update the input values without applying
}

// Apply date filter explicitly
const applyDateFilter = () => {
  // Update applied filter values
  appliedDateFilterStart.value = dateFilterStart.value
  appliedDateFilterEnd.value = dateFilterEnd.value
  
  currentPage.value = 1
  if (isLoaded.value && userId.value) {
    loadMatches(1)
  }
}

const clearDateFilter = () => {
  dateFilterStart.value = ''
  dateFilterEnd.value = ''
  appliedDateFilterStart.value = ''
  appliedDateFilterEnd.value = ''
  currentPage.value = 1
  if (isLoaded.value && userId.value) {
    loadMatches(1)
  }
}

const handlePreviousPage = () => {
  currentPage.value = Math.max(1, currentPage.value - 1)
  // For 'pending' filter, pagination is client-side, no need to reload
  // For all other filters, reload from backend
  if (statusFilter.value !== 'pending') {
    loadMatches(currentPage.value)
  }
}

const handleNextPage = () => {
  currentPage.value = Math.min(totalFilteredPages.value, currentPage.value + 1)
  // For 'pending' filter, pagination is client-side, no need to reload
  // For all other filters, reload from backend
  if (statusFilter.value !== 'pending') {
    loadMatches(currentPage.value)
  }
}

// Determine if current user won the match
const didUserWin = (match: Match) => {
  if (!match.winner_id || !player.value) return null
  // Check if the winner is the current player
  return match.winner_id === player.value.id
}

// Get match card border color based on result

// Get player icon classes based on match result

const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return 'Sin agendar'
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return 'Fecha inválida'
  // Use Ecuador timezone for display
  return date.toLocaleDateString('es-ES', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getStatusLabel = (status: string, scheduledAt?: string | null) => {
  // Si está scheduled pero sin fecha, mostrar "Sin agendar"
  if (status === 'scheduled' && !scheduledAt) {
    return 'Sin agendar'
  }
  const labels: Record<string, string> = {
    scheduled: 'Programado',
    active: 'En Curso',
    completed: 'Completado',
    cancelled: 'Cancelado'
  }
  return labels[status] || status
}

const getStatusBadgeClass = (status: string, scheduledAt?: string | null) => {
  if (status === 'scheduled' && !scheduledAt) return 'status-badge-pending'
  const classes: Record<string, string> = {
    scheduled: 'status-badge-upcoming',
    active: 'status-badge-pending',
    completed: 'status-badge-active',
    cancelled: 'status-badge-danger'
  }
  return classes[status] || 'status-badge-completed'
}

const statusFilters = [
  { value: null, label: 'Todos', icon: 'heroicons:squares-2x2' },
  { value: 'pending', label: 'Pendientes', icon: 'heroicons:bell-alert' },
  { value: 'scheduled', label: 'Programados', icon: 'heroicons:calendar' },
  { value: 'active', label: 'En curso', icon: 'heroicons:play-circle' },
  { value: 'completed', label: 'Completados', icon: 'heroicons:check-circle' },
  { value: 'cancelled', label: 'Cancelados', icon: 'heroicons:x-circle' }
] as const

const getStatusIcon = (status: string) => {
  const icons: Record<string, string> = {
    scheduled: 'heroicons:calendar',
    active: 'heroicons:play-circle',
    completed: 'heroicons:check-circle',
    cancelled: 'heroicons:x-circle'
  }
  return icons[status] || 'heroicons:circle'
}

const getPlayerInitials = (name: string) => {
  if (!name) return '?'
  const parts = name.trim().split(' ')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

// Get player tier from ELO
const getPlayerTier = (player: any): string | null => {
  if (!player || player.elo === undefined || player.elo === null) return null
  const tierInfo = getRatingTier(player.elo)
  return tierInfo.tier
}

// Get player rank icon path
const getPlayerRankIcon = (player: any): string | null => {
  const tier = getPlayerTier(player)
  if (!tier) return null
  return useRankIconAsset(tier)
}

// Get tier name in Spanish
const getTierNameInSpanish = (tier: string | null): string => {
  if (!tier) return ''
  const tierNames: Record<string, string> = {
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

onMounted(async () => {
  console.log('[Matches] onMounted:', { isLoaded: isLoaded.value, userId: userId.value, opponentId: route.query.opponent_id })
  if (isLoaded.value && userId.value) {
    // Load player data to determine match results
    if (!player.value?.id) {
      await fetchPlayer(userId.value)
    }
    // Check if opponent_id is in URL
    const opponentId = route.query.opponent_id
    if (opponentId && typeof opponentId === 'string') {
      console.log('[Matches] onMounted: Setting opponent filter:', opponentId)
      // Set opponent filter and load name
      opponentFilter.value = opponentId
      await loadOpponentName(opponentId)
      // Load matches with opponent filter
      currentPage.value = 1
      await loadMatches(1)
    } else {
      // Load matches normally if no opponent_id
      console.log('[Matches] onMounted: Loading matches without opponent filter')
      await loadMatches(1)
    }
  } else {
    console.log('[Matches] onMounted: Auth not loaded yet, waiting for isLoaded watch')
  }
})

watch([isLoaded, userId], async ([loaded, currentUserId]) => {
  console.log('[Matches] [isLoaded, userId] changed:', { loaded, currentUserId, matchesCount: matches.value.length, loading: loading.value, opponentFilter: opponentFilter.value })
  if (loaded && currentUserId) {
    // Load player data if needed
    if (!player.value?.id) {
      await fetchPlayer(currentUserId)
    }
    // Only load matches if we haven't already loaded them with a filter
    // This prevents double loading when opponent_id is in URL
    if (matches.value.length === 0 && !loading.value && !opponentFilter.value) {
      console.log('[Matches] Loading matches from [isLoaded, userId] watch (no opponent filter)')
      await loadMatches(1)
    } else {
      console.log('[Matches] Skipping match load from [isLoaded, userId] watch:', { 
        matchesCount: matches.value.length, 
        loading: loading.value, 
        opponentFilter: opponentFilter.value 
      })
    }
  }
})

// Reload when status filter changes
watch(statusFilter, () => {
  // Reset to page 1 when filter changes
  currentPage.value = 1
  if (isLoaded.value && userId.value) {
    loadMatches(1)
  }
})

// Reload when view mode changes
watch(viewMode, () => {
  if (isLoaded.value && userId.value) {
    loadMatches(1)
  }
})

// Load saved view preference
onMounted(() => {
  const savedView = localStorage.getItem('matches-view-mode')
  if (savedView === 'list' || savedView === 'calendar') {
    viewMode.value = savedView
  }
})

// Save view preference
watch(viewMode, (newView) => {
  localStorage.setItem('matches-view-mode', newView)
})
</script>


<style scoped>
.toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 8px 14px; border-radius: 999px; border: 1px solid var(--edge); background: transparent; color: var(--foreground-muted); font-size: 14px; font-weight: 600; }
.chip[aria-pressed="true"] { background: var(--accent); border-color: transparent; color: var(--accent-foreground); }
@media (hover: hover) { .chip:not([aria-pressed="true"]):hover { background: var(--lens); color: var(--foreground); } }
.segmented { display: grid; grid-auto-flow: column; gap: 4px; padding: 4px; border-radius: 999px; background: var(--lens); border: 1px solid var(--edge); }
.segmented button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 40px; padding: 0 14px; border-radius: 999px; border: 0; background: transparent; color: var(--foreground-muted); font-weight: 600; font-size: 14px; }
.segmented button[aria-pressed="true"] { background: var(--surface); color: var(--foreground); }
.filters { margin-bottom: 16px; }
.filters > summary { cursor: pointer; min-height: 44px; display: flex; align-items: center; font-weight: 600; list-style: none; }
.filters > summary::-webkit-details-marker { display: none; }
.filters__chevron { margin-left: auto; color: var(--foreground-muted); }
.filters[open] .filters__chevron { transform: rotate(180deg); }
.filters__grid { display: grid; grid-template-columns: 1fr 1fr 2fr; gap: 16px; margin-top: 12px; }
.filters__opponent { position: relative; }
.filters__results { position: absolute; z-index: 20; left: 0; right: 0; margin-top: 8px; max-height: 240px; overflow-y: auto; box-shadow: var(--shadow-lg); }
.filters__actions { margin-top: 12px; }
.chip-x { display: inline-grid; place-items: center; width: 28px; height: 28px; margin-right: -6px; border: 0; border-radius: 50%; background: transparent; color: inherit; }
.hint { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
.match-row { cursor: pointer; align-items: flex-start; }
@media (hover: hover) { .match-row:hover { background: var(--lens); } }
.match-row__names a { color: inherit; }
@media (hover: hover) { .match-row__names a:hover, .match-row__result a:hover { text-decoration: underline; } }
.match-row__tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.match-row__result { display: grid; gap: 2px; justify-items: end; }
.match-row__result a { color: var(--accent); font-weight: 600; }
.meta.inline { display: inline; }
.result-mark.is-win { background: var(--success-subtle); color: var(--success); border-color: transparent; }
.result-mark.is-loss { background: var(--danger-subtle); color: var(--danger); border-color: transparent; }
.pager { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-top: 16px; }
@media (max-width: 767px) {
  .filters__grid { grid-template-columns: 1fr 1fr; }
  .filters__opponent { grid-column: 1 / -1; }
  .match-row__result { justify-items: start; }
}
</style>
