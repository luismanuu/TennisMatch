<template>
  <PageLayout>
    <button v-if="canGoBack" type="button" class="text-link back-link" @click="goBack">
      <Icon name="heroicons:arrow-left" class="w-5 h-5" aria-hidden="true" />
      Volver
    </button>

    <div v-if="publicLoading || publicPendingLoading" class="panel loading-state" aria-busy="true">
      <Icon name="heroicons:arrow-path" class="loading-spinner animate-spin" aria-hidden="true" />
      <p class="loading-text">Cargando perfil…</p>
    </div>

    <div v-else-if="(publicError && !publicPendingPlayer) || (publicPendingError && !publicPlayer)" class="panel empty-state" role="alert">
      <Icon name="heroicons:exclamation-triangle" class="empty-state-icon text-danger" aria-hidden="true" />
      <h1 class="empty-state-title">No pudimos cargar este perfil</h1>
      <p class="empty-state-description">{{ (publicError || publicPendingError)?.message || 'Error al cargar el perfil' }}</p>
      <button type="button" class="btn-primary" @click="loadProfile">
        <Icon name="heroicons:arrow-path" class="w-5 h-5" aria-hidden="true" />
        Reintentar
      </button>
    </div>

    <div v-else-if="!publicPlayer && !publicPendingPlayer" class="panel empty-state">
      <Icon name="heroicons:user" class="empty-state-icon" aria-hidden="true" />
      <h1 class="empty-state-title">Jugador no encontrado</h1>
      <p class="empty-state-description">El perfil que buscas no existe o fue eliminado.</p>
      <NuxtLink to="/matches" class="btn-primary">
        Volver a partidos
        <Icon name="heroicons:arrow-right" class="w-5 h-5" aria-hidden="true" />
      </NuxtLink>
    </div>

    <!-- Registered player: Perfil system applied to someone else's profile -->
    <div v-else-if="publicPlayer" class="split-grid even">
      <div class="flow-stack">
        <PhotoPanel photo="hero" variant="profile" eager>
          <div class="identity">
            <span class="avatar avatar-lg" aria-hidden="true">{{ initials(publicPlayer.name) }}</span>
            <h1>{{ publicPlayer.name }}</h1>
            <p>Miembro desde {{ formatDate(publicPlayer.created_at) }}</p>
            <p v-if="publicPlayer.category?.name">
              {{ publicPlayer.category.name }}<template v-if="publicPlayer.category.description"> · {{ publicPlayer.category.description }}</template>
            </p>
            <p v-if="publicPlayer.city" class="location">
              <Icon name="heroicons:map-pin" class="w-5 h-5" aria-hidden="true" />
              {{ publicPlayer.city.name }}, Ecuador
            </p>
            <a
              v-if="publicPlayer.phone_number"
              :href="getWhatsAppLink(publicPlayer.phone_number, `Hola ${publicPlayer.name}, te contacto desde la plataforma de Tenis Ecuador`)"
              target="_blank"
              rel="noopener noreferrer"
              class="btn-photo"
            >
              Escribir por WhatsApp
              <Icon name="heroicons:chat-bubble-left-right" class="w-5 h-5" aria-hidden="true" />
            </a>
          </div>
        </PhotoPanel>

        <section class="panel" aria-label="Resumen">
          <div class="stats three">
            <div>
              <strong class="stat-value">{{ (publicPlayer.total_matches_played || 0) > 0 ? tierName(getTop100TierForPlayer() || getPlayerTier(publicPlayer.elo || 0)) : '—' }}</strong>
              <span class="meta">Nivel actual</span>
            </div>
            <div>
              <strong class="stat-value">{{ rankingPosition?.position?.global_rank && rankingPosition.position.total_players > 0 ? `#${rankingPosition.position.global_rank}` : '—' }}</strong>
              <span class="meta">En Ecuador</span>
            </div>
            <div>
              <strong class="stat-value">{{ publicPlayer.win_streak || 0 }}</strong>
              <span class="meta">Victorias seguidas</span>
            </div>
          </div>
          <details class="more-stats">
            <summary>Ver estadísticas</summary>
            <div class="stats three">
              <div><strong class="stat-value">{{ (publicPlayer.elo ?? 0).toLocaleString('es-EC') }}</strong><span class="meta">SR actual</span></div>
              <div><strong class="stat-value">{{ publicPlayer.total_matches_played || 0 }}</strong><span class="meta">Partidos jugados</span></div>
              <div v-if="(publicPlayer.placement_matches_completed || 0) < 3">
                <strong class="stat-value">{{ publicPlayer.placement_matches_completed || 0 }}/3</strong><span class="meta">Colocación</span>
              </div>
              <div v-else><strong class="stat-value">{{ playerStats?.peak_elo ?? '—' }}</strong><span class="meta">SR máximo</span></div>
            </div>
          </details>
        </section>
      </div>

      <div class="flow-stack">
        <section class="panel rating" aria-label="Nivel de juego">
          <div class="rating__copy">
            <p class="meta">Nivel de juego</p>
            <p class="rating-number">{{ (publicPlayer.elo ?? 0).toLocaleString('es-EC') }} <span>SR</span></p>
            <RatingTierBadge
              :elo="publicPlayer.elo"
              :total-matches-played="publicPlayer.total_matches_played || 0"
              :placement-matches-completed="publicPlayer.placement_matches_completed || 0"
            />
          </div>
          <img
            v-if="(publicPlayer.total_matches_played || 0) > 0"
            :src="useRankIconAsset(getTop100TierForPlayer() || getPlayerTier(publicPlayer.elo || 0)) || ''"
            width="72" height="72" alt="" class="rating__tier"
          >
        </section>

        <div class="segmented" role="tablist" aria-label="Detalle del jugador">
          <button id="tab-ranking" type="button" role="tab" :aria-selected="activeTab === 'ranking'" aria-controls="panel-ranking" @click="activeTab = 'ranking'">Ranking</button>
          <button id="tab-matches" type="button" role="tab" :aria-selected="activeTab === 'matches'" aria-controls="panel-matches" @click="activeTab = 'matches'">Historial de partidos</button>
        </div>

        <section v-if="activeTab === 'ranking'" id="panel-ranking" role="tabpanel" aria-labelledby="tab-ranking">
          <div v-if="rankingLoading" class="list-surface loading-state" aria-busy="true"><p class="loading-text">Cargando ranking…</p></div>
          <template v-else-if="rankingPosition && rankingPosition.success && !rankingPosition.is_unrated && rankingPosition.position">
            <div v-if="rankingPosition.position.global_rank || rankingPosition.position.tier_rank || rankingPosition.position.segment_rank" class="list-surface">
              <div v-if="rankingPosition.position.global_rank && rankingPosition.position.total_players > 0" class="list-row">
                <span class="row-copy">
                  <strong>Ecuador</strong>
                  <span class="meta">
                    <template v-if="rankingPosition.position.percentile >= 0">Top {{ rankingPosition.position.percentile }}%</template>
                    <template v-if="rankingPosition.position.players_below >= 0"> · {{ rankingPosition.position.players_below }} jugadores por debajo</template>
                  </span>
                </span>
                <span class="rank-score">#{{ rankingPosition.position.global_rank }}<small>de {{ rankingPosition.position.total_players }}</small></span>
              </div>
              <div v-if="rankingPosition.position.tier_rank && rankingPosition.position.tier_total > 0 && rankingPosition.tier" class="list-row">
                <span class="row-copy"><strong>{{ tierName(rankingPosition.tier) }}</strong><span class="meta">Dentro de su tier</span></span>
                <span class="rank-score">#{{ rankingPosition.position.tier_rank }}<small>de {{ rankingPosition.position.tier_total }}</small></span>
              </div>
              <div v-if="rankingPosition.position.segment_rank && rankingPosition.position.segment_total > 0" class="list-row">
                <span class="row-copy"><strong>{{ rankingPosition.position.segment_name || 'Su región' }}</strong><span class="meta">Ranking regional</span></span>
                <span class="rank-score">#{{ rankingPosition.position.segment_rank }}<small>de {{ rankingPosition.position.segment_total }}</small></span>
              </div>
            </div>
            <p v-else class="panel meta">Aún no hay suficientes jugadores para calcular el ranking. Se necesitan al menos {{ rankingPosition.min_players_required || 2 }}; ahora hay {{ rankingPosition.current_players || 0 }}.</p>
          </template>
          <p v-else-if="rankingPosition && rankingPosition.is_unrated" class="panel meta">Este jugador aún no ha completado partidos de colocación.</p>
          <p v-else-if="rankingPosition && rankingPosition.success && !rankingPosition.position && rankingPosition.current_players === 0" class="panel meta">Aún no hay suficientes jugadores para calcular el ranking. Se necesitan al menos {{ rankingPosition.min_players_required || 2 }}; ahora hay {{ rankingPosition.current_players || 0 }}.</p>
          <p v-else-if="rankingPosition && !rankingPosition.success" class="panel meta">No se pudo cargar la información de ranking.</p>
          <p v-else class="panel meta">No hay información de ranking disponible.</p>
        </section>

        <section v-if="activeTab === 'matches'" id="panel-matches" role="tabpanel" aria-labelledby="tab-matches" class="flow-stack">
          <details class="panel filters" :open="hasActiveFilters">
            <summary>Filtrar partidos<span v-if="hasActiveFilters" class="badge badge-accent ml-2">Activos</span><Icon name="heroicons:chevron-down" class="filters__chevron w-5 h-5" aria-hidden="true" /></summary>
            <div class="filters__grid">
              <div>
                <label for="f-status" class="form-label">Estado</label>
                <select id="f-status" v-model="matchHistoryStatusFilter" class="form-select" @change="applyFilters">
                  <option value="">Todos los estados</option>
                  <option value="scheduled">Programado</option>
                  <option value="active">En curso</option>
                  <option value="completed">Completado</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>
              <div>
                <label for="f-start" class="form-label">Desde</label>
                <input id="f-start" v-model="matchHistoryStartDate" type="date" class="form-input" @change="applyFilters">
              </div>
              <div>
                <label for="f-end" class="form-label">Hasta</label>
                <input id="f-end" v-model="matchHistoryEndDate" type="date" class="form-input" @change="applyFilters">
              </div>
            </div>
            <button type="button" class="text-link" :disabled="!hasActiveFilters" @click="clearFilters">Limpiar filtros</button>
          </details>

          <div v-if="matchHistoryLoading" class="list-surface loading-state" aria-busy="true"><p class="loading-text">Cargando partidos…</p></div>
          <div v-else-if="matchHistory.length > 0" class="list-surface">
            <NuxtLink v-for="match in matchHistory" :key="match.id" :to="`/matches/${match.id}`" class="list-row history-row">
              <span class="avatar" aria-hidden="true">{{ getOpponentInitials(match) }}</span>
              <span class="row-copy">
                <strong>{{ getOpponentName(match) }}</strong>
                <span v-if="match.played_at" class="meta">{{ formatMatchDate(match.played_at) }}</span>
                <span class="history-tags">
                  <span class="status-badge" :class="getMatchStatusClass(match.status)">{{ getMatchStatusLabel(match.status) }}</span>
                  <span class="badge">{{ match.is_competitive !== false ? 'Competitivo' : 'Amistoso' }}</span>
                  <span v-if="match.tournament" class="badge">{{ match.tournament.name }}</span>
                </span>
              </span>
              <span v-if="match.status === 'completed' && match.score" class="row-end history-result">
                <strong class="numeric">{{ formatScore(match.score) }}</strong>
                <span v-if="match.winner" class="meta">Ganó {{ match.winner.name }}</span>
                <span
                  v-if="match.is_competitive && match.elo_change !== undefined && match.elo_change !== null"
                  class="numeric sr-change"
                  :class="match.elo_change > 0 ? 'text-success' : match.elo_change < 0 ? 'text-danger' : 'text-foreground-muted'"
                >{{ match.elo_change > 0 ? '+' : '' }}{{ match.elo_change }} SR</span>
              </span>
            </NuxtLink>
          </div>
          <div v-else class="panel empty-state">
            <p class="empty-state-description">{{ hasActiveFilters ? 'No hay partidos con esos filtros.' : 'Todavía no hay partidos registrados.' }}</p>
            <button v-if="hasActiveFilters" type="button" class="btn-secondary" @click="clearFilters">Limpiar filtros</button>
          </div>

          <nav v-if="matchHistoryTotalPages > 1" class="pager" aria-label="Paginación del historial">
            <button type="button" class="btn-secondary" :disabled="matchHistoryPage === 1 || matchHistoryLoading" @click="handleMatchHistoryPageChange(matchHistoryPage - 1)">
              <Icon name="heroicons:chevron-left" class="w-4 h-4" aria-hidden="true" />
              Anterior
            </button>
            <span class="meta numeric">Página {{ matchHistoryPage }} de {{ matchHistoryTotalPages }} · {{ matchHistoryTotal }} partidos</span>
            <button type="button" class="btn-secondary" :disabled="matchHistoryPage >= matchHistoryTotalPages || matchHistoryLoading" @click="handleMatchHistoryPageChange(matchHistoryPage + 1)">
              Siguiente
              <Icon name="heroicons:chevron-right" class="w-4 h-4" aria-hidden="true" />
            </button>
          </nav>
        </section>
      </div>
    </div>

    <!-- Invited, not yet registered -->
    <div v-else-if="publicPendingPlayer" class="pending-player flow-stack">
      <PageHeader :title="publicPendingPlayer.name" :subtitle="`Invitado el ${formatDate(publicPendingPlayer.created_at)}`" />
      <section class="panel flow-stack">
        <span class="status-pill pending-pill">
          <Icon name="heroicons:clock" class="w-4 h-4" aria-hidden="true" />
          Pendiente de registro
        </span>
        <div class="list-surface">
          <div class="list-row"><span class="row-copy"><strong>Categoría</strong><span class="meta">{{ publicPendingPlayer.category?.name || 'No seleccionada' }}<template v-if="publicPendingPlayer.category?.description"> · {{ publicPendingPlayer.category.description }}</template></span></span></div>
          <div class="list-row"><span class="row-copy"><strong>Estado</strong><span class="meta">{{ getStatusLabel(publicPendingPlayer.status) }}</span></span></div>
        </div>
        <p class="meta">Este jugador fue invitado a un partido pero aún no completa su registro. Cuando lo haga, verás su perfil con estadísticas y puntuación SR.</p>
      </section>
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
import { formatScore } from '~/utils/pendingAction'
import { useRankIconAsset } from '~/composables/useRankIcon'
import { tierName } from '~/utils/tiers'

definePageMeta({
  middleware: []
})

const route = useRoute()
const router = useRouter()
const playerId = route.params.id as string

const { publicPlayer, publicLoading, publicError, fetchPublicPlayer } = usePlayer()
const { publicPendingPlayer, publicPendingLoading, publicPendingError, fetchPublicPendingPlayer } = usePendingPlayers()
const { getWhatsAppLink } = useWhatsApp()

// Ranking and match history data
const rankingPosition = ref<any>(null)
const rankingLoading = ref(false)
const matchHistory = ref<any[]>([])
const matchHistoryLoading = ref(false)
const activeTab = ref<'ranking' | 'matches'>('ranking')
const matchHistoryPage = ref(1)
const matchHistoryPageSize = ref(10)
const matchHistoryTotal = ref(0)
const matchHistoryTotalPages = ref(0)

// Player stats (peak ELO, etc.)
const playerStats = ref<{ peak_elo: number } | null>(null)
const playerStatsLoading = ref(false)

// Match history filters
const matchHistoryStatusFilter = ref<string>('')
const matchHistoryStartDate = ref<string>('')
const matchHistoryEndDate = ref<string>('')

// Check if any filters are active
const hasActiveFilters = computed(() => {
  return !!matchHistoryStatusFilter.value || !!matchHistoryStartDate.value || !!matchHistoryEndDate.value
})

// Get the previous page from query parameter or use browser history
const previousPage = computed(() => {
  // Check if there's a 'from' query parameter
  if (route.query.from && typeof route.query.from === 'string') {
    return route.query.from
  }
  return null
})

const canGoBack = computed(() => {
  // Can go back if we have a previous page or browser history
  if (previousPage.value) return true
  return typeof window !== 'undefined' && window.history.length > 1
})

// Function to handle back navigation
const goBack = () => {
  if (previousPage.value) {
    // Navigate to the previous page from query parameter
    router.push(previousPage.value)
  } else if (typeof window !== 'undefined' && window.history.length > 1) {
    // Use browser history to go back
    router.back()
  } else {
    // Fallback to matches page
    router.push('/matches')
  }
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  // Use Ecuador timezone for display
  return date.toLocaleDateString('es-ES', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    pending: 'Pendiente',
    accepted: 'Aceptado',
    expired: 'Expirado'
  }
  return labels[status] || status
}

const loadProfile = async () => {
  if (playerId) {
    // Try to fetch as regular player first
    const player = await fetchPublicPlayer(playerId)
    
    // If not found, try as pending player
    if (!player) {
      await fetchPublicPendingPlayer(playerId)
    } else {
      // Load ranking and match history for regular players
      await loadRankingAndMatches()
    }
  }
}

const loadRankingAndMatches = async () => {
  if (!playerId) return

  // Load ranking position
  rankingLoading.value = true
  try {
    const rankingData = await $fetch(`/api/players/${playerId}/ranking-position`).catch(() => null)
    rankingPosition.value = rankingData
  } catch (err) {
    console.error('Error loading ranking:', err)
  } finally {
    rankingLoading.value = false
  }

  // Load player stats (peak ELO) if player has completed placement matches
  if (publicPlayer.value && (publicPlayer.value.placement_matches_completed || 0) >= 3) {
    playerStatsLoading.value = true
    try {
      const historyResponse = await $fetch<{
        success: boolean
        stats: { peak_elo: number }
      }>(`/api/players/${playerId}/rating-history`, {
        query: { limit: 1, period: 'all' } // Just need stats, not full history
      }).catch(() => null)
      
      if (historyResponse?.success && historyResponse.stats) {
        playerStats.value = { peak_elo: historyResponse.stats.peak_elo || publicPlayer.value.elo }
      }
    } catch (err) {
      console.error('Error loading player stats:', err)
    } finally {
      playerStatsLoading.value = false
    }
  }

  // Load match history with pagination
  await loadMatchHistory(1)
}

const loadMatchHistory = async (page: number = 1) => {
  if (!playerId) return
  
  matchHistoryLoading.value = true
  matchHistoryPage.value = page
  const offset = (page - 1) * matchHistoryPageSize.value
  
  try {
    // Build query parameters with filters
    const queryParams: Record<string, string> = {
      limit: matchHistoryPageSize.value.toString(),
      offset: offset.toString()
    }
    
    if (matchHistoryStatusFilter.value) {
      queryParams.status = matchHistoryStatusFilter.value
    }
    
    if (matchHistoryStartDate.value) {
      queryParams.start_date = matchHistoryStartDate.value
    }
    
    if (matchHistoryEndDate.value) {
      queryParams.end_date = matchHistoryEndDate.value
    }
    
    const response = await $fetch<{
      success: boolean
      matches: any[]
      pagination?: {
        total: number
        limit: number
        offset: number
        total_pages: number
        current_page: number
        has_next: boolean
        has_previous: boolean
      }
    }>(`/api/players/${playerId}/matches`, {
      query: queryParams
    }).catch(() => ({ success: false, matches: [], pagination: undefined }))
    
    if (response.success) {
      matchHistory.value = response.matches
      if (response.pagination) {
        matchHistoryTotal.value = response.pagination.total
        matchHistoryTotalPages.value = response.pagination.total_pages
      }
    }
  } catch (err) {
    console.error('Error loading match history:', err)
  } finally {
    matchHistoryLoading.value = false
  }
}

const handleMatchHistoryPageChange = (page: number) => {
  loadMatchHistory(page)
}

const applyFilters = () => {
  // Reset to first page when filters change
  loadMatchHistory(1)
}

const clearFilters = () => {
  matchHistoryStatusFilter.value = ''
  matchHistoryStartDate.value = ''
  matchHistoryEndDate.value = ''
  // Reload with cleared filters
  loadMatchHistory(1)
}

const getOpponentName = (match: any) => {
  if (match.player1_id === playerId) {
    return match.player2?.name || match.pending_player2?.name || 'Jugador 2'
  }
  return match.player1?.name || 'Jugador 1'
}

const getOpponentInitials = (match: any) => {
  const name = getOpponentName(match)
  if (!name) return '?'
  const parts = name.trim().split(' ')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

const formatMatchDate = (dateString: string) => {
  const date = new Date(dateString)
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

const getMatchStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    scheduled: 'Programado',
    active: 'En Curso',
    completed: 'Completado',
    cancelled: 'Cancelado'
  }
  return labels[status] || status
}

const getMatchStatusClass = (status: string) => {
  const classes: Record<string, string> = {
    scheduled: 'status-badge-upcoming',
    active: 'status-badge-pending',
    completed: 'status-badge-active',
    cancelled: 'status-badge-danger'
  }
  return classes[status] || 'status-badge-completed'
}

const initials = (name: string) => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1]?.[0] || '' : '')).toUpperCase()
}

// Get player tier from ELO (client-side calculation)
const RATING_TIERS = [
  { tier: 'Bronze', minElo: 1, maxElo: 1499, color: '#CD7F32' },
  { tier: 'Silver', minElo: 1500, maxElo: 1999, color: '#C0C0C0' },
  { tier: 'Gold', minElo: 2000, maxElo: 2499, color: '#FFD700' },
  { tier: 'Platinum', minElo: 2500, maxElo: 2999, color: '#E5E4E2' },
  { tier: 'Diamond', minElo: 3000, maxElo: 3499, color: '#B9F2FF' },
  { tier: 'Master', minElo: 3500, maxElo: 3999, color: '#9932CC' },
  { tier: 'Grandmaster', minElo: 4000, maxElo: Infinity, color: '#FF4500' },
]

const getPlayerTier = (elo: number): string => {
  for (const tier of RATING_TIERS) {
    if (elo >= tier.minElo && elo <= tier.maxElo) {
      return tier.tier
    }
  }
  return 'Bronze'
}

// Get Top 100 tier - only applies when there are 100+ Grandmaster players and player is in top 100
const getTop100TierForPlayer = () => {
  const playerTier = getPlayerTier(publicPlayer.value?.elo || 0)
  
  if (playerTier !== 'Grandmaster') {
    return undefined
  }
  
  // If we have tier ranking data
  if (rankingPosition.value?.position?.tier_rank && rankingPosition.value?.position?.tier_total) {
    const tierTotal = rankingPosition.value.position.tier_total
    const tierRank = rankingPosition.value.position.tier_rank
    
    // Top100 only applies when:
    // 1. There are 100 or more Grandmaster players (tierTotal >= 100)
    // 2. Player is in the top 100 by tier_rank (tierRank <= 100)
    if (tierTotal >= 100 && tierRank <= 100) {
      return 'Top100'
    }
  }
  
  // Fallback: if no tier data but player is Grandmaster and in top 100 globally
  // Only if there are likely 100+ players total
  if (rankingPosition.value?.position?.global_rank && rankingPosition.value.position.global_rank <= 100 && rankingPosition.value?.position?.total_players && rankingPosition.value.position.total_players >= 100) {
    return 'Top100'
  }
  
  return undefined
}

onMounted(async () => {
  await loadProfile()
})
</script>


<style scoped>
.back-link { margin-bottom: 12px; }
.identity { width: 100%; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 12px; margin-top: auto; }
.identity h1 { font-size: clamp(30px, 3vw, 38px); line-height: 1.12; letter-spacing: -0.035em; overflow-wrap: anywhere; }
.identity > p { max-width: 36ch; color: var(--on-photo-muted); overflow-wrap: anywhere; }
.location { display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 14px; }
.rating { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.rating__copy { display: grid; gap: 4px; justify-items: start; }
.rating-number { font-size: clamp(40px, 4vw, 56px); font-weight: 700; letter-spacing: -0.05em; line-height: 1.2; font-variant-numeric: tabular-nums; }
.rating-number span { font-size: 14px; font-weight: 500; letter-spacing: 0; color: var(--foreground-muted); }
.rating__tier { width: 64px; height: 64px; object-fit: contain; }
.segmented { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 4px; border-radius: 999px; background: var(--lens); border: 1px solid var(--edge); }
.segmented button { min-height: 44px; border-radius: 999px; border: 0; background: transparent; color: var(--foreground-muted); font-weight: 600; font-size: 15px; }
.segmented button[aria-selected="true"] { background: var(--surface); color: var(--foreground); }
.filters > summary { cursor: pointer; min-height: 44px; display: flex; align-items: center; font-weight: 600; list-style: none; }
.filters > summary::-webkit-details-marker { display: none; }
.filters__chevron { margin-left: auto; color: var(--foreground-muted); }
.filters[open] .filters__chevron { transform: rotate(180deg); }
.filters__grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin: 12px 0 4px; }
.history-row { align-items: flex-start; }
.history-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.history-result { display: grid; gap: 2px; justify-items: end; }
.sr-change { font-weight: 650; }
.pager { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; }
.pending-pill { background: var(--warning-subtle); color: var(--warning); align-self: flex-start; }
.pending-player { max-width: 720px; }
@media (max-width: 767px) { .filters__grid { grid-template-columns: 1fr; } .history-result { justify-items: start; } }
</style>
