<template>
  <PageLayout>
    <PageHeader title="Mi ranking" subtitle="Tu nivel, tu progreso y lo que te falta para el siguiente tier.">
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

    <div v-if="loading || playerLoading" class="panel loading-state" aria-busy="true">
      <Icon name="heroicons:arrow-path" class="loading-spinner animate-spin" aria-hidden="true" />
      <p class="loading-text">Cargando tu ranking…</p>
    </div>

    <div v-else-if="error" class="panel empty-state" role="alert">
      <Icon name="heroicons:exclamation-triangle" class="empty-state-icon text-danger" aria-hidden="true" />
      <h2 class="empty-state-title">No pudimos cargar tus estadísticas</h2>
      <p class="empty-state-description">{{ error.message || 'Intenta de nuevo en unos segundos.' }}</p>
      <button type="button" class="btn-primary" @click="loadAllData">
        <Icon name="heroicons:arrow-path" class="w-5 h-5" aria-hidden="true" />
        Reintentar
      </button>
    </div>

    <div v-else-if="!loading && !player" class="panel empty-state">
      <Icon name="heroicons:user" class="empty-state-icon" aria-hidden="true" />
      <h2 class="empty-state-title">Completa tu perfil</h2>
      <p class="empty-state-description">Necesitas un perfil de jugador para ver tu ranking.</p>
      <NuxtLink to="/onboarding" class="btn-primary">
        Crear perfil
        <Icon name="heroicons:arrow-right" class="w-5 h-5" aria-hidden="true" />
      </NuxtLink>
    </div>

    <div v-else class="split-grid even">
      <div class="flow-stack">
        <!-- Current rating -->
        <section class="panel rating" aria-labelledby="rating-title">
          <div class="rating__copy">
            <h2 id="rating-title" class="meta rating__label">Tu nivel de juego</h2>
            <p class="rating-number">{{ player.elo.toLocaleString('es-EC') }} <span>SR</span></p>
            <RatingTierBadge
              :elo="player.elo"
              :total-matches-played="player.total_matches_played || 0"
              :placement-matches-completed="player.placement_matches_completed || 0"
            />
            <div v-if="position && !isInPlacement && position.total_players > 0 && position.percentile >= 0" class="rating__facts">
              <span><strong class="numeric">#{{ position.global_rank }}</strong> de {{ position.total_players }} en Ecuador</span>
              <span><strong class="numeric">Top {{ position.percentile }}%</strong></span>
            </div>
            <p v-if="isInPlacement" class="meta">SR aproximado: tu ranking final se establece después de 3 partidos.</p>
          </div>
          <img
            v-if="tierInfo && !isInPlacement && (player.total_matches_played || 0) > 0"
            :src="useRankIconAsset(getTop100Tier() || tierInfo.tier) || ''"
            width="96" height="96" :alt="`Nivel ${tierName(getTop100Tier() || tierInfo.tier)}`" class="rating__tier"
          >
        </section>

        <!-- Placement -->
        <section v-if="isInPlacement" class="panel progress-panel" aria-labelledby="placement-title">
          <div class="progress-panel__head">
            <h2 id="placement-title">Partidos de colocación</h2>
            <span class="numeric">{{ player.placement_matches_completed || 0 }} / 3</span>
          </div>
          <div class="meter" role="progressbar" :aria-valuenow="player.placement_matches_completed || 0" aria-valuemin="0" aria-valuemax="3">
            <span :style="{ width: `${((player.placement_matches_completed || 0) / 3) * 100}%` }"></span>
          </div>
          <p class="meta">{{ (player.placement_matches_completed || 0) >= 3 ? 'Ranking definitivo establecido. Ya compites en la clasificación.' : 'Completa 3 partidos para establecer tu ranking definitivo.' }}</p>
        </section>

        <!-- Next tier -->
        <section v-if="!isInPlacement && nextTierProgress && !nextTierProgress.isMaxTier" class="panel progress-panel" aria-labelledby="next-title">
          <div class="progress-panel__head">
            <div>
              <h2 id="next-title">Próximo tier: {{ tierName(nextTierProgress.nextTier?.tier) }}</h2>
              <p class="meta">Desde {{ nextTierProgress.nextTier?.minElo?.toLocaleString('es-EC') }} SR</p>
            </div>
            <span class="progress-panel__need"><strong class="numeric">{{ nextTierProgress.eloNeeded }}</strong> SR más</span>
          </div>
          <div class="meter" role="progressbar" :aria-valuenow="Math.round(nextTierProgress.progressPercent)" aria-valuemin="0" aria-valuemax="100" :aria-label="`Progreso hacia ${tierName(nextTierProgress.nextTier?.tier)}`">
            <span :style="{ width: `${nextTierProgress.progressPercent}%` }"></span>
          </div>
          <div class="meter__scale numeric">
            <span>{{ nextTierProgress.currentTier.minElo.toLocaleString('es-EC') }}</span>
            <strong>{{ player.elo.toLocaleString('es-EC') }}</strong>
            <span>{{ nextTierProgress.currentTier.maxElo.toLocaleString('es-EC') }}</span>
          </div>
        </section>
        <section v-else-if="nextTierProgress?.isMaxTier" class="panel">
          <h2 class="panel-title">Gran Maestro</h2>
          <p class="meta">Alcanzaste el tier más alto.</p>
        </section>

        <!-- SR history -->
        <section v-if="!isInPlacement" class="panel" aria-labelledby="history-title">
          <div class="section-heading">
            <h2 id="history-title">Historial de SR</h2>
            <span class="meta">Últimos {{ ratingHistory.length }} partidos</span>
          </div>
          <EloHistoryChart :history-data="ratingHistory" />
        </section>

        <!-- Advanced stats -->
        <template v-if="!isInPlacement">
          <div class="segmented" role="group" aria-label="Período de análisis">
            <button
              v-for="period in periods"
              :key="period.value"
              type="button"
              :aria-pressed="selectedPeriod === period.value"
              @click="selectedPeriod = period.value"
            >{{ period.label }}</button>
          </div>

          <section v-if="advancedStats?.has_sufficient_data?.streaks" class="panel" aria-labelledby="streaks-title">
            <h2 id="streaks-title" class="panel-title">Rachas</h2>
            <div class="stats three">
              <div><strong class="stat-value text-success">{{ advancedStats.current_win_streak }}</strong><span class="meta">Victorias seguidas ahora</span></div>
              <div><strong class="stat-value">{{ advancedStats.best_win_streak }}</strong><span class="meta">Mejor racha</span></div>
              <div v-if="advancedStats.current_losing_streak > 0"><strong class="stat-value text-danger">{{ advancedStats.current_losing_streak }}</strong><span class="meta">Derrotas seguidas</span></div>
            </div>
          </section>
          <InsufficientDataMessage v-else message="Juega al menos 1 partido para ver tus rachas" />

          <section v-if="advancedStats?.has_sufficient_data?.day_of_week" class="panel" aria-labelledby="dow-title">
            <h2 id="dow-title" class="panel-title">Rendimiento por día de la semana</h2>
            <DayOfWeekChart :data="advancedStats.win_rate_by_day_of_week" />
          </section>
          <InsufficientDataMessage v-else message="Necesitas partidos en al menos 3 días diferentes" />

          <section v-if="advancedStats?.has_sufficient_data?.time_of_day" class="panel" aria-labelledby="tod-title">
            <h2 id="tod-title" class="panel-title">Rendimiento por hora del día</h2>
            <TimeOfDayChart :data="advancedStats.win_rate_by_time_of_day" />
          </section>
          <InsufficientDataMessage v-else message="Necesitas partidos en diferentes horarios" />

          <div v-if="(advancedStats?.has_sufficient_data?.best_month && advancedStats.best_month) || advancedStats?.has_sufficient_data?.last_match" class="list-surface">
            <div v-if="advancedStats?.has_sufficient_data?.best_month && advancedStats.best_month" class="list-row">
              <span class="row-copy"><strong>Mejor mes: {{ advancedStats.best_month.month }}</strong><span class="meta">{{ advancedStats.best_month.matches }} partidos</span></span>
              <span class="rank-score">{{ Math.round(advancedStats.best_month.win_rate) }}%<small>victorias</small></span>
            </div>
            <div v-if="advancedStats?.has_sufficient_data?.last_match" class="list-row">
              <span class="row-copy"><strong>Última actividad</strong><span class="meta">desde tu último partido</span></span>
              <span class="rank-score">{{ formatTimeSince(advancedStats.days_since_last_match) }}</span>
            </div>
          </div>
          <InsufficientDataMessage v-if="!(advancedStats?.has_sufficient_data?.best_month && advancedStats?.best_month)" message="Necesitas partidos en al menos 2 meses diferentes" />
          <InsufficientDataMessage v-if="!advancedStats?.has_sufficient_data?.last_match" message="Juega al menos 1 partido para ver tu última actividad" />

          <!-- Head to head -->
          <section class="panel h2h" aria-labelledby="h2h-title">
            <h2 id="h2h-title" class="panel-title">Cara a cara</h2>
            <div class="h2h__search">
              <label for="h2h-search" class="form-label">Buscar rival</label>
              <input
                id="h2h-search"
                v-model="searchQuery"
                type="search"
                class="form-input"
                placeholder="Buscar por nombre"
                autocomplete="off"
                role="combobox"
                :aria-expanded="showSearchResults && searchResults.length > 0"
                aria-controls="h2h-results"
                @input="handleH2HSearch"
                @focus="showSearchResults = true"
              >
              <ul v-if="showSearchResults && searchResults.length > 0" id="h2h-results" class="list-surface h2h__results" role="listbox">
                <li v-for="result in searchResults" :key="result.id" role="option" :aria-selected="h2hOpponent?.id === result.id">
                  <button type="button" class="list-row w-full text-left" @click="selectH2HOpponent(result)">
                    <span class="row-copy"><strong>{{ result.name }}</strong></span>
                    <span v-if="getPlayerTier(result)" class="badge">
                      <img v-if="getPlayerRankIcon(result)" :src="getPlayerRankIcon(result)" alt="" class="w-4 h-4 object-contain">
                      {{ getTierNameInSpanish(getPlayerTier(result)) }}
                    </span>
                  </button>
                </li>
              </ul>
            </div>
            <p v-if="h2hOpponent" class="meta">Rival: <strong class="text-foreground">{{ h2hOpponent.name }}</strong></p>

            <div v-if="h2hOpponent" class="segmented" role="group" aria-label="Período del cara a cara">
              <button v-for="period in periods" :key="period.value" type="button" :aria-pressed="h2hPeriod === period.value" @click="h2hPeriod = period.value">{{ period.label }}</button>
            </div>

            <div v-if="h2hLoading" class="loading-state" aria-busy="true"><p class="loading-text">Cargando estadísticas…</p></div>
            <template v-else-if="h2hOpponent && h2hStats">
              <div class="stats">
                <div><strong class="stat-value numeric">{{ h2hStats.wins }}–{{ h2hStats.losses }}</strong><span class="meta">Victorias–derrotas</span></div>
                <div><strong class="stat-value">{{ Math.round(h2hStats.win_rate) }}%</strong><span class="meta">Porcentaje de victorias</span></div>
                <div><strong class="stat-value" :class="h2hStats.is_win_streak ? 'text-success' : 'text-danger'">{{ h2hStats.current_streak }}</strong><span class="meta">Racha actual</span></div>
                <div><strong class="stat-value">{{ trendLabel(h2hStats.trend) }}</strong><span class="meta">Tendencia</span></div>
                <div><strong class="stat-value text-success">+{{ Math.round(h2hStats.avg_elo_gain) }}</strong><span class="meta">SR ganado en promedio</span></div>
                <div><strong class="stat-value text-danger">−{{ Math.round(h2hStats.avg_elo_loss) }}</strong><span class="meta">SR perdido en promedio</span></div>
              </div>
              <div v-if="h2hStats.best_match || h2hStats.worst_match" class="list-surface">
                <div v-if="h2hStats.best_match" class="list-row">
                  <span class="row-copy"><strong>Mejor partido</strong><span class="meta">{{ h2hStats.best_match.match?.score ? formatScore(h2hStats.best_match.match.score) + ' · ' : '' }}{{ formatMatchDate(h2hStats.best_match.created_at) }}</span></span>
                  <span class="rank-score text-success">+{{ h2hStats.best_match.elo_change }}<small>SR</small></span>
                </div>
                <div v-if="h2hStats.worst_match" class="list-row">
                  <span class="row-copy"><strong>Peor partido</strong><span class="meta">{{ h2hStats.worst_match.match?.score ? formatScore(h2hStats.worst_match.match.score) + ' · ' : '' }}{{ formatMatchDate(h2hStats.worst_match.created_at) }}</span></span>
                  <span class="rank-score text-danger">{{ h2hStats.worst_match.elo_change }}<small>SR</small></span>
                </div>
              </div>
              <NuxtLink v-if="h2hStats.matches && h2hStats.matches.length > 0" :to="`/matches?opponent_id=${h2hOpponent?.id}`" class="btn-secondary">
                Ver todos los partidos ({{ h2hStats.total_matches }})
                <Icon name="heroicons:arrow-right" class="w-5 h-5" aria-hidden="true" />
              </NuxtLink>
            </template>
            <p v-else-if="h2hOpponent && !h2hLoading" class="meta">No jugaste contra este rival en el período elegido.</p>
            <p v-else class="meta">Elige un rival para ver tu historial contra él.</p>
          </section>
        </template>
      </div>

      <div class="flow-stack">
        <section v-if="!isInPlacement" class="panel" aria-label="Resumen">
          <div class="stats">
            <div><strong class="stat-value">{{ player.total_matches_played || 0 }}</strong><span class="meta">Partidos</span></div>
            <div><strong class="stat-value">{{ winRate }}%</strong><span class="meta">Porcentaje de victorias</span></div>
            <div><strong class="stat-value">{{ (historyStats?.peak_elo || player.elo).toLocaleString('es-EC') }}</strong><span class="meta">SR máximo</span></div>
            <div><strong class="stat-value">{{ historyStats?.wins || 0 }}</strong><span class="meta">Victorias</span></div>
          </div>
        </section>

        <section aria-labelledby="recent-title">
          <div class="section-heading">
            <h2 id="recent-title">{{ isInPlacement ? 'Historial de partidos' : 'Últimos partidos competitivos' }}</h2>
          </div>
          <div v-if="recentMatches.length > 0" class="list-surface">
            <NuxtLink v-for="match in recentMatches" :key="match.id" :to="`/matches/${match.match_id || match.id}`" class="list-row">
              <span class="avatar result-mark" :class="match.was_winner ? 'is-win' : 'is-loss'" :aria-label="match.was_winner ? 'Victoria' : 'Derrota'">
                <Icon :name="match.was_winner ? 'heroicons:check' : 'heroicons:x-mark'" class="w-5 h-5" aria-hidden="true" />
              </span>
              <span class="row-copy">
                <strong>{{ match.opponent?.name || 'Rival desconocido' }}</strong>
                <span class="meta">{{ formatMatchDate(match.match_date || match.created_at) }}<template v-if="match.is_placement_match"> · Colocación</template></span>
              </span>
              <span class="rank-score" :class="match.elo_change > 0 ? 'text-success' : match.elo_change < 0 ? 'text-danger' : ''">{{ match.elo_change > 0 ? '+' : '' }}{{ match.elo_change }}<small>SR</small></span>
            </NuxtLink>
          </div>
          <div v-else class="panel empty-state">
            <Icon name="heroicons:calendar" class="empty-state-icon" aria-hidden="true" />
            <h3 class="empty-state-title">Sin partidos aún</h3>
            <p class="empty-state-description">{{ isInPlacement ? 'Juega partidos para ver tu historial aquí.' : 'Juega partidos competitivos para ver tu historial aquí.' }}</p>
            <NuxtLink to="/matchmaking" class="btn-primary">
              Buscar rival
              <Icon name="heroicons:magnifying-glass" class="w-5 h-5" aria-hidden="true" />
            </NuxtLink>
          </div>
        </section>

        <section v-if="!isInPlacement" class="panel progress-panel" aria-labelledby="activity-title">
          <div class="progress-panel__head">
            <div>
              <h2 id="activity-title">Actividad mensual</h2>
              <p class="meta">{{ decayStatus?.days_remaining_in_month || 0 }} días restantes</p>
            </div>
            <span class="numeric progress-panel__need"><strong>{{ decayStatus?.matches_this_month || 0 }}</strong> / {{ decayStatus?.matches_required || 2 }} partidos</span>
          </div>
          <div class="meter" :class="{ 'is-met': metGoal }" role="progressbar" :aria-valuenow="decayStatus?.matches_this_month || 0" aria-valuemin="0" :aria-valuemax="decayStatus?.matches_required || 2">
            <span :style="{ width: `${Math.min(((decayStatus?.matches_this_month || 0) / (decayStatus?.matches_required || 2)) * 100, 100)}%` }"></span>
          </div>
          <p class="activity-status" :class="metGoal ? 'text-success' : 'text-warning'">
            <Icon :name="metGoal ? 'heroicons:check-circle' : 'heroicons:exclamation-triangle'" class="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            <span v-if="metGoal">Meta cumplida. Tu SR está protegido este mes.</span>
            <span v-else>Juega {{ matchesLeft }} partido{{ matchesLeft !== 1 ? 's' : '' }} más para evitar el decay de SR (−{{ decayStatus?.estimated_decay || 25 }} SR).</span>
          </p>
        </section>
        <p v-else class="panel meta">Durante los partidos de colocación no hay decay de SR.</p>

        <section v-if="!isInPlacement && (position?.segment_rank || position?.tier_rank)" aria-labelledby="positions-title">
          <div class="section-heading"><h2 id="positions-title">Tus posiciones</h2></div>
          <div class="list-surface">
            <div v-if="position.segment_rank" class="list-row">
              <span class="row-copy"><strong>{{ position.segment_name || 'Segmento' }}</strong><span class="meta">Ranking del segmento</span></span>
              <span class="rank-score">#{{ position.segment_rank }}<small>de {{ position.segment_total }}</small></span>
            </div>
            <div v-if="position.tier_rank" class="list-row">
              <span class="row-copy"><strong>{{ tierName(nextTierProgress?.currentTier?.tier) }}</strong><span class="meta">Ranking por tier</span></span>
              <span class="rank-score">#{{ position.tier_rank }}<small>de {{ position.tier_total }}</small></span>
            </div>
          </div>
        </section>

        <NuxtLink to="/leaderboard" class="btn-secondary">
          Ver la clasificación nacional
          <Icon name="heroicons:arrow-right" class="w-5 h-5" aria-hidden="true" />
        </NuxtLink>
      </div>
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, watch } from 'vue'
import type { MonthlyDecayStatus, RatingTierInfo, RatingTier, AdvancedStats, HeadToHeadStats, PlayerSearchResult } from '~/types'
import { useRankIconAsset } from '~/composables/useRankIcon'
import { usePlayerSearch } from '~/composables/usePlayerSearch'
import { getRatingTier } from '~/server/utils/rating-system'
import { tierName } from '~/utils/tiers'
import { formatScore } from '~/utils/pendingAction'

definePageMeta({
  middleware: 'auth'
})

// Composables
const { isAuthenticated, userId } = useAuthState()
const { player, loading: playerLoading, fetchPlayer } = usePlayer()
const { fetchDecayStatus, status: decayStatus } = useMonthlyDecay()
const { searchPlayers, results: searchResults, loading: searchLoading, clearResults } = usePlayerSearch()


// State
const loading = ref(true)
const error = ref<Error | null>(null)
const position = ref<{
  global_rank: number
  total_players: number
  segment_rank?: number
  segment_total?: number
  segment_name?: string
  tier_rank?: number
  tier_total?: number
  players_above: number
  players_below: number
  percentile: number
} | null>(null)
const ratingHistory = ref<any[]>([])
const recentMatches = ref<any[]>([])
const historyStats = ref<{
  wins: number
  losses: number
  win_rate: number
  total_elo_change: number
  peak_elo: number
} | null>(null)
const advancedStats = ref<AdvancedStats | null>(null)
const selectedPeriod = ref<'month' | 'year' | 'all'>('year')
const h2hOpponent = ref<PlayerSearchResult | null>(null)
const h2hStats = ref<HeadToHeadStats | null>(null)
const h2hLoading = ref(false)
const h2hPeriod = ref<'month' | 'year' | 'all'>('all')
const searchQuery = ref('')
const showSearchResults = ref(false)
const nextTierProgress = ref<{
  currentTier: { tier: string; minElo: number; maxElo: number; color: string }
  nextTier: { tier: string; minElo: number; maxElo: number; color: string } | null
  eloNeeded: number
  progressPercent: number
  isMaxTier: boolean
} | null>(null)

// Computed
const isInPlacement = computed(() => {
  return (player.value?.placement_matches_completed || 0) < 3
})

const periods = [
  { value: 'month' as const, label: 'Último mes' },
  { value: 'year' as const, label: 'Último año' },
  { value: 'all' as const, label: 'Todo' }
]
const metGoal = computed(() => (decayStatus.value?.matches_this_month || 0) >= (decayStatus.value?.matches_required || 2))
const matchesLeft = computed(() => (decayStatus.value?.matches_required || 2) - (decayStatus.value?.matches_this_month || 0))
const trendLabel = (trend?: string) => (trend === 'improving' ? 'Al alza' : trend === 'declining' ? 'A la baja' : trend === 'stable' ? 'Estable' : '—')

const winRate = computed(() => {
  if (!historyStats.value) return 0
  return Math.round(historyStats.value.win_rate)
})

const formatMatchDate = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  
  // Helper to get date string in Ecuador timezone (YYYY-MM-DD)
  const getEcuadorDateString = (d: Date): string => {
    return d.toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' }) // en-CA gives YYYY-MM-DD format
  }
  
  // Get date strings in Ecuador timezone
  const dateStr = getEcuadorDateString(date)
  const nowStr = getEcuadorDateString(now)
  
  // Parse dates to compare
  const dateParts = dateStr.split('-').map(Number)
  const nowParts = nowStr.split('-').map(Number)
  
  const dateOnly = new Date(dateParts[0], dateParts[1] - 1, dateParts[2])
  const nowDateOnly = new Date(nowParts[0], nowParts[1] - 1, nowParts[2])
  
  const diffTime = nowDateOnly.getTime() - dateOnly.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) {
    return 'Hoy'
  } else if (diffDays === 1) {
    return 'Ayer'
  } else if (diffDays < 7) {
    return `Hace ${diffDays} días`
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    return `Hace ${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30)
    return `Hace ${months} ${months === 1 ? 'mes' : 'meses'}`
  } else {
    // Use Ecuador timezone for display
    return date.toLocaleDateString('es-ES', { 
      timeZone: 'America/Guayaquil',
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    })
  }
}

// Methods
const loadAllData = async () => {
  if (!player.value?.id) {
    return
  }

  try {
    error.value = null

    // Load all data in parallel
    const [rankingResponse, historyResponse, tierResponse] = await Promise.all([
      // Ranking position
      $fetch<{
        success: boolean
        is_unrated: boolean
        position: typeof position.value
      }>(`/api/players/${player.value.id}/ranking-position`).catch(() => null),
      
      // Rating history (get 20 for chart, we'll use first 10 for recent matches)
      $fetch<{
        success: boolean
        history: any[]
        stats: typeof historyStats.value & AdvancedStats
      }>(`/api/players/${player.value.id}/rating-history`, {
        query: { limit: 20, period: selectedPeriod.value }
      }).catch(() => null),
      
      // Next tier progress (custom endpoint or calculate client-side)
      $fetch<{
        success: boolean
        progress: typeof nextTierProgress.value
      }>(`/api/players/${player.value.id}/tier-progress`).catch(() => null)
    ])

    // Also fetch decay status (not in placement)
    if (!isInPlacement.value) {
      await fetchDecayStatus(player.value.id).catch(() => null)
    }

    // Set data
    if (rankingResponse?.success) {
      position.value = rankingResponse.position
    }

    if (historyResponse?.success) {
      ratingHistory.value = historyResponse.history.slice().reverse() // Oldest first for chart
      historyStats.value = {
        wins: historyResponse.stats.wins,
        losses: historyResponse.stats.losses,
        win_rate: historyResponse.stats.win_rate,
        total_elo_change: historyResponse.stats.total_elo_change,
        peak_elo: historyResponse.stats.peak_elo
      }
      advancedStats.value = {
        current_win_streak: historyResponse.stats.current_win_streak,
        best_win_streak: historyResponse.stats.best_win_streak,
        current_losing_streak: historyResponse.stats.current_losing_streak,
        win_rate_by_day_of_week: historyResponse.stats.win_rate_by_day_of_week,
        win_rate_by_time_of_day: historyResponse.stats.win_rate_by_time_of_day,
        best_month: historyResponse.stats.best_month,
        days_since_last_match: historyResponse.stats.days_since_last_match,
        period: historyResponse.stats.period,
        has_sufficient_data: historyResponse.stats.has_sufficient_data
      }
      
      // Get last 10 matches (includes both competitive and placement matches)
      recentMatches.value = historyResponse.history
        .slice(0, 10) // Already sorted by created_at DESC, so first 10 are most recent
        .map((h: any) => ({
          id: h.id,
          match_id: h.match_id,
          opponent: h.opponent,
          was_winner: h.was_winner,
          elo_change: h.elo_change || (h.elo_after - h.elo_before), // Calculate if not present
          elo_before: h.elo_before,
          elo_after: h.elo_after,
          is_placement_match: h.is_placement_match,
          created_at: h.created_at,
          match_date: h.match_date || h.created_at // Use actual match date if available, fallback to created_at
        }))
    }

    if (tierResponse?.success) {
      nextTierProgress.value = tierResponse.progress
    } else {
      // Calculate client-side if endpoint doesn't exist
      nextTierProgress.value = calculateTierProgress(player.value.elo)
    }

  } catch (err: any) {
    console.error('Error loading ranking data:', err)
    error.value = new Error('Error al cargar estadísticas. Por favor intenta de nuevo.')
    throw err // Re-throw so initialize can handle it
  }
}

// Client-side tier progress calculation as fallback
const RATING_TIERS: RatingTierInfo[] = [
  { tier: 'Bronze', minElo: 1, maxElo: 1499, color: '#CD7F32' },
  { tier: 'Silver', minElo: 1500, maxElo: 1999, color: '#C0C0C0' },
  { tier: 'Gold', minElo: 2000, maxElo: 2499, color: '#FFD700' },
  { tier: 'Platinum', minElo: 2500, maxElo: 2999, color: '#E5E4E2' },
  { tier: 'Diamond', minElo: 3000, maxElo: 3499, color: '#B9F2FF' },
  { tier: 'Master', minElo: 3500, maxElo: 3999, color: '#9932CC' },
  { tier: 'Grandmaster', minElo: 4000, maxElo: Infinity, color: '#FF4500' },
]

// Get current tier info
const tierInfo = computed<RatingTierInfo>(() => {
  if (!player.value) {
    return { tier: 'Unrated', minElo: 0, maxElo: 0, color: '#6B7280' }
  }
  
  for (const tier of RATING_TIERS) {
    if (player.value.elo >= tier.minElo && player.value.elo <= tier.maxElo) {
      return tier
    }
  }
  return RATING_TIERS[0]
})

// Get rank icon path
const rankIconPath = computed(() => {
  return useRankIconAsset(tierInfo.value.tier)
})

const imageError = ref(false)
const handleImageError = () => {
  imageError.value = true
}

const calculateTierProgress = (elo: number) => {
  const currentTierData = RATING_TIERS.find(t => elo >= t.minElo && elo <= t.maxElo) || RATING_TIERS[0]
  const currentIndex = RATING_TIERS.findIndex(t => t.tier === currentTierData.tier)
  
  if (currentIndex === RATING_TIERS.length - 1 || currentTierData.tier === 'Grandmaster') {
    return {
      currentTier: currentTierData,
      nextTier: null,
      eloNeeded: 0,
      progressPercent: 100,
      isMaxTier: true
    }
  }
  
  const nextTierData = RATING_TIERS[currentIndex + 1]
  const eloNeeded = nextTierData.minElo - elo
  const tierRange = currentTierData.maxElo - currentTierData.minElo
  const eloInTier = elo - currentTierData.minElo
  const progressPercent = tierRange > 0 ? Math.round((eloInTier / tierRange) * 100) : 0
  
  return {
    currentTier: currentTierData,
    nextTier: nextTierData,
    eloNeeded,
    progressPercent,
    isMaxTier: false
  }
}

// Initial load
const initialize = async () => {
  if (!isAuthenticated.value || !userId.value) {
    loading.value = false
    return
  }

  try {
    loading.value = true
    error.value = null

    // First, fetch the player if we have a user ID
    if (!player.value) {
      await fetchPlayer(userId.value)
    }

    // Then load all ranking data if player exists
    if (player.value?.id) {
      await loadAllData()
    } else {
      // Player doesn't exist - show appropriate message
      loading.value = false
    }
  } catch (err: any) {
    console.error('Error initializing ranking page:', err)
    error.value = err
  } finally {
    loading.value = false
  }
}

// Watch for period changes
watch(selectedPeriod, () => {
  if (player.value?.id && !loading.value) {
    loadAllData().catch(err => {
      console.error('Error loading ranking data:', err)
      error.value = err
    })
  }
})

// Watch for player changes (in case player is loaded elsewhere)
watch(() => player.value?.id, (newId, oldId) => {
  if (newId && newId !== oldId && !loading.value) {
    loadAllData().catch(err => {
      console.error('Error loading ranking data:', err)
      error.value = err
    })
  }
})

// Head to Head functions
const handleH2HSearch = async () => {
  if (searchQuery.value.trim().length >= 2) {
    await searchPlayers(searchQuery.value, player.value?.id)
    showSearchResults.value = true
  } else {
    clearResults()
    showSearchResults.value = false
  }
}

const selectH2HOpponent = (opponent: PlayerSearchResult) => {
  if (opponent.id === player.value?.id) {
    return
  }
  h2hOpponent.value = opponent
  searchQuery.value = opponent.name
  showSearchResults.value = false
  loadH2HStats()
}

const loadH2HStats = async () => {
  if (!player.value?.id || !h2hOpponent.value?.id) {
    return
  }
  
  try {
    h2hLoading.value = true
    const response = await $fetch<{
      success: boolean
      stats: HeadToHeadStats | null
      message?: string
    }>(`/api/players/${player.value.id}/head-to-head/${h2hOpponent.value.id}`, {
      query: { period: h2hPeriod.value }
    }).catch((err: any) => {
      console.error('Error loading head-to-head stats:', err)
      throw new Error('Error al cargar estadísticas head-to-head. Por favor intenta de nuevo.')
    })
    
    if (response.success) {
      h2hStats.value = response.stats
    }
  } catch (err: any) {
    console.error('Error loading head-to-head stats:', err)
    h2hStats.value = null
    // Show error message to user
    if (err.message) {
      // Could add a toast notification here if needed
    }
  } finally {
    h2hLoading.value = false
  }
}

watch(h2hPeriod, () => {
  if (h2hOpponent.value) {
    loadH2HStats()
  }
})

const formatTimeSince = (days: number) => {
  if (days === 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  if (days < 7) return `Hace ${days} días`
  if (days < 30) {
    const weeks = Math.floor(days / 7)
    return `Hace ${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`
  }
  if (days < 365) {
    const months = Math.floor(days / 30)
    return `Hace ${months} ${months === 1 ? 'mes' : 'meses'}`
  }
  const years = Math.floor(days / 365)
  return `Hace ${years} ${years === 1 ? 'año' : 'años'}`
}

// Get player tier from ELO
const getPlayerTier = (player: PlayerSearchResult | null | undefined): string | null => {
  if (!player || player.elo === undefined || player.elo === null) return null
  const tierInfo = getRatingTier(player.elo)
  return tierInfo.tier
}

// Get player rank icon path
const getPlayerRankIcon = (player: PlayerSearchResult | null | undefined): string | null => {
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

// Get Top 100 tier - only applies when there are 100+ Grandmaster players and player is in top 100
const getTop100Tier = () => {
  if (!tierInfo.value || tierInfo.value.tier !== 'Grandmaster') {
    return undefined
  }
  
  // If we have tier ranking data
  if (position.value?.tier_rank && position.value?.tier_total) {
    const tierTotal = position.value.tier_total
    const tierRank = position.value.tier_rank
    
    // Top100 only applies when:
    // 1. There are 100 or more Grandmaster players (tierTotal >= 100)
    // 2. Player is in the top 100 by tier_rank (tierRank <= 100)
    if (tierTotal >= 100 && tierRank <= 100) {
      return 'Top100'
    }
  }
  
  // Fallback: if no tier data but player is Grandmaster and in top 100 globally
  // Only if there are likely 100+ players total
  if (position.value?.global_rank && position.value.global_rank <= 100 && position.value?.total_players && position.value.total_players >= 100) {
    return 'Top100'
  }
  
  return undefined
}

// Watch for auth/user changes
watch([isAuthenticated, userId], async ([authenticated, uid]) => {
  if (authenticated && uid) {
    await initialize()
  } else {
    loading.value = false
  }
}, { immediate: true })

</script>

<style scoped>
.panel-title { font-size: 20px; margin-bottom: 16px; }
.rating { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.rating__copy { display: grid; gap: 6px; justify-items: start; min-width: 0; }
.rating__label { font-weight: 500; font-size: 14px; letter-spacing: 0; }
.rating-number { font-size: clamp(42px, 4.5vw, 64px); font-weight: 700; letter-spacing: -0.05em; line-height: 1.15; font-variant-numeric: tabular-nums; }
.rating-number span { font-size: 14px; font-weight: 500; letter-spacing: 0; color: var(--foreground-muted); }
.rating__facts { display: flex; flex-wrap: wrap; gap: 4px 16px; font-size: 14px; color: var(--foreground-muted); margin-top: 4px; }
.rating__facts strong { color: var(--foreground); }
.rating__tier { width: 88px; height: 88px; object-fit: contain; flex-shrink: 0; }
.progress-panel { display: grid; gap: 12px; }
.progress-panel h2 { font-size: 20px; }
.progress-panel__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.progress-panel__need { font-size: 14px; color: var(--foreground-muted); white-space: nowrap; }
.progress-panel__need strong { font-size: 22px; color: var(--foreground); }
.meter { height: 10px; border-radius: 999px; background: var(--lens); overflow: hidden; }
.meter > span { display: block; height: 100%; border-radius: inherit; background: var(--accent); transform-origin: left; }
.meter:not(.is-met) > span { background: var(--accent); }
.meter__scale { display: flex; justify-content: space-between; font-size: 13px; color: var(--foreground-muted); }
.meter__scale strong { color: var(--foreground); }
.activity-status { display: flex; align-items: flex-start; gap: 8px; font-size: 14px; }
.segmented { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; padding: 4px; border-radius: 999px; background: var(--lens); border: 1px solid var(--edge); }
.segmented button { min-height: 44px; border-radius: 999px; border: 0; background: transparent; color: var(--foreground-muted); font-weight: 600; font-size: 15px; }
.segmented button[aria-pressed="true"] { background: var(--surface); color: var(--foreground); }
.h2h { display: grid; gap: 16px; }
.h2h .panel-title { margin-bottom: 0; }
.h2h__search { position: relative; }
.h2h__results { position: absolute; z-index: 10; left: 0; right: 0; margin: 8px 0 0; padding: 0; list-style: none; max-height: 240px; overflow-y: auto; box-shadow: var(--shadow-lg); }
.result-mark.is-win { background: var(--success-subtle); color: var(--success); border-color: transparent; }
.result-mark.is-loss { background: var(--danger-subtle); color: var(--danger); border-color: transparent; }
@media (prefers-reduced-motion: no-preference) {
  .meter > span { animation: meter-fill 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.2s backwards; }
}
@keyframes meter-fill { from { transform: scaleX(0); } }
@media (max-width: 767px) { .rating__tier { width: 64px; height: 64px; } }
</style>
