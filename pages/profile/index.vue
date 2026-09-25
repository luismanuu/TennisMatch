<template>
  <PageLayout>
    <h1 v-if="!player" class="sr-only">Mi perfil</h1>

    <div v-if="loading" class="panel loading-state" aria-busy="true">
      <Icon name="heroicons:arrow-path" class="loading-spinner animate-spin" aria-hidden="true" />
      <p class="loading-text">Cargando tu perfil…</p>
    </div>

    <div v-else-if="error" class="panel empty-state" role="alert">
      <Icon name="heroicons:exclamation-triangle" class="empty-state-icon text-danger" aria-hidden="true" />
      <h2 class="empty-state-title">No pudimos cargar tu perfil</h2>
      <p class="empty-state-description">{{ error.message }}</p>
      <button type="button" class="btn-primary" @click="loadProfile">
        <Icon name="heroicons:arrow-path" class="w-5 h-5" aria-hidden="true" />
        Reintentar
      </button>
    </div>

    <!-- Perfil (DESIGN.md §7, design/mock/court-Perfil.html) -->
    <div v-else-if="player" class="split-grid even">
      <div class="flow-stack">
        <PhotoPanel photo="hero" variant="profile" eager>
          <div class="profile-tools">
            <NuxtLink to="/profile/edit" class="btn-photo">
              Editar perfil
              <Icon name="heroicons:pencil-square" class="w-5 h-5" aria-hidden="true" />
            </NuxtLink>
          </div>
          <div class="identity">
            <span class="avatar avatar-lg" aria-hidden="true">{{ getPlayerInitials(player.name) }}</span>
            <h1>{{ player.name }}</h1>
            <p v-if="user?.primaryEmailAddress?.emailAddress">{{ user.primaryEmailAddress.emailAddress }}</p>
            <p v-if="player.category?.name">
              {{ player.category.name }}<template v-if="player.category.description"> · {{ player.category.description }}</template>
            </p>
            <p class="location">
              <Icon name="heroicons:map-pin" class="w-5 h-5" aria-hidden="true" />
              {{ player.city?.name ? `${player.city.name}, Ecuador` : 'Ciudad sin especificar' }}
            </p>
          </div>
        </PhotoPanel>

        <section class="panel" aria-label="Resumen">
          <div class="stats three">
            <div>
              <strong class="stat-value">{{ isUnrated ? '—' : (tierName(getTop100Tier() || tierInfo?.tier) || '—') }}</strong>
              <span class="meta">Nivel actual</span>
            </div>
            <div>
              <strong class="stat-value">{{ globalRank ? `#${globalRank}` : '—' }}</strong>
              <span class="meta">En Ecuador</span>
            </div>
            <div>
              <strong class="stat-value">{{ player.win_streak || 0 }}</strong>
              <span class="meta">Victorias seguidas<template v-if="!isUnrated && player.win_streak >= 5"> · bonus máximo</template></span>
            </div>
          </div>
          <details class="more-stats">
            <summary>Ver estadísticas</summary>
            <div class="stats three">
              <div><strong class="stat-value">{{ player.elo.toLocaleString('es-EC') }}</strong><span class="meta">SR actual</span></div>
              <div><strong class="stat-value">{{ player.total_matches_played || 0 }}</strong><span class="meta">Partidos jugados</span></div>
              <div><strong class="stat-value">{{ percentile !== null ? `Top ${percentile}%` : '—' }}</strong><span class="meta">En Ecuador</span></div>
              <div><strong class="stat-value">{{ ratingStats?.wins || 0 }}</strong><span class="meta">Victorias</span></div>
              <div><strong class="stat-value">{{ winRate }}</strong><span class="meta">Porcentaje de victorias</span></div>
              <div><strong class="stat-value">{{ player.loss_streak || 0 }}</strong><span class="meta">Derrotas seguidas</span></div>
            </div>
          </details>
        </section>
      </div>

      <div class="flow-stack">
        <section class="panel rating" aria-labelledby="rating-title">
          <div class="rating__copy">
            <h2 id="rating-title" class="meta rating__label">Tu nivel de juego</h2>
            <p class="rating-number">{{ player.elo.toLocaleString('es-EC') }} <span>SR</span></p>
            <RatingTierBadge
              :elo="player.elo"
              :total-matches-played="player.total_matches_played || 0"
              :placement-matches-completed="player.placement_matches_completed || 0"
              :show-provisional="true"
            />
            <p class="meta mt-2">{{ isUnrated ? 'Juega tu primer partido para obtener tu clasificación.' : 'Tu calificación actual en el sistema.' }}</p>
            <NuxtLink v-if="!isUnrated" to="/my-ranking" class="text-link">
              Ver mi ranking
              <Icon name="heroicons:arrow-right" class="w-4 h-4" aria-hidden="true" />
            </NuxtLink>
          </div>
          <img v-if="tierImage" :src="tierImage" width="72" height="72" :alt="`Nivel ${tierName(getTop100Tier() || tierInfo?.tier)}`" class="rating__tier">
        </section>

        <section v-if="!isUnrated && (player.placement_matches_completed || 0) < 3" class="panel placement-wrap">
          <PlacementProgress
            :completed="player.placement_matches_completed || 0"
            :match-results="placementMatchResults"
          />
        </section>

        <MonthlyDecayWarning
          v-if="decayStatus && !isUnrated"
          :matches-this-month="decayStatus.matches_this_month"
          :matches-required="decayStatus.matches_required"
          :days-remaining="decayStatus.days_remaining_in_month"
          :estimated-decay="decayStatus.estimated_decay"
          :show-matchmaking-link="true"
          :is-in-placement="(player.placement_matches_completed || 0) < 3"
        />

        <section v-if="!isUnrated" aria-labelledby="positions-title">
          <div class="section-heading"><h2 id="positions-title">Tus posiciones</h2></div>
          <div v-if="rankingLoading" class="list-surface loading-state" aria-busy="true">
            <p class="loading-text">Cargando ranking…</p>
          </div>
          <div v-else-if="position" class="list-surface">
            <div v-if="position.global_rank && position.total_players > 0" class="list-row">
              <span class="row-copy"><strong>Ecuador</strong><span class="meta">{{ position.players_below >= 0 ? `${position.players_below} jugadores por debajo` : 'Ranking nacional' }}</span></span>
              <span class="rank-score">#{{ position.global_rank }}<small>de {{ position.total_players }}</small></span>
            </div>
            <div v-if="position.tier_rank && position.tier_total > 0 && rankingPosition.tier" class="list-row">
              <span class="row-copy"><strong>{{ tierName(rankingPosition.tier) }}</strong><span class="meta">Dentro de tu tier</span></span>
              <span class="rank-score">#{{ position.tier_rank }}<small>de {{ position.tier_total }}</small></span>
            </div>
            <div v-if="position.segment_rank && position.segment_total > 0" class="list-row">
              <span class="row-copy"><strong>{{ position.segment_name || 'Tu región' }}</strong><span class="meta">Ranking regional</span></span>
              <span class="rank-score">#{{ position.segment_rank }}<small>de {{ position.segment_total }}</small></span>
            </div>
          </div>
          <p v-else-if="rankingPosition && rankingPosition.is_unrated" class="panel meta">Aún no has completado partidos de colocación.</p>
          <div v-else-if="rankingPosition && rankingPosition.success && !rankingPosition.position && rankingPosition.current_players === 0" class="panel">
            <p class="meta">Aún no hay suficientes jugadores para calcular el ranking. Se necesitan al menos {{ rankingPosition.min_players_required || 2 }} jugadores con partidos jugados; ahora hay {{ rankingPosition.current_players || 0 }}.</p>
          </div>
          <p v-else class="panel meta">No hay información de ranking disponible.</p>
        </section>

        <section class="panel account" aria-labelledby="account-title">
          <div class="account__copy">
            <h2 id="account-title">Cuenta</h2>
            <p class="meta">{{ player.phone_number || 'Sin teléfono' }} · {{ user?.primaryEmailAddress?.emailAddress || 'Email no disponible' }}</p>
          </div>
          <button type="button" class="btn-secondary" @click="openUserProfileModal">
            Gestionar cuenta
            <Icon name="heroicons:cog-6-tooth" class="w-5 h-5" aria-hidden="true" />
          </button>
        </section>
      </div>
    </div>

    <div v-else-if="!loading && !player" class="panel empty-state">
      <Icon name="heroicons:user-circle" class="empty-state-icon" aria-hidden="true" />
      <h2 class="empty-state-title">Completa tu perfil</h2>
      <p class="empty-state-description">Para comenzar a usar la plataforma, necesitas completar tu perfil de jugador.</p>
      <NuxtLink to="/onboarding" class="btn-primary">
        Completar perfil
        <Icon name="heroicons:arrow-right" class="w-5 h-5" aria-hidden="true" />
      </NuxtLink>
    </div>

    <!-- Account management (Clerk) -->
    <Transition name="modal">
      <div v-if="showUserProfileModal" class="account-modal" role="dialog" aria-modal="true" aria-label="Gestionar cuenta">
        <div class="account-modal__backdrop" @click="closeUserProfileModal"></div>
        <div class="user-profile-modal-container">
          <button type="button" class="icon-button account-modal__close" aria-label="Cerrar" @click="closeUserProfileModal">
            <Icon name="heroicons:x-mark" class="w-5 h-5" aria-hidden="true" />
          </button>
          <ClientOnly>
            <div class="user-profile-wrapper">
              <UserProfile :routing="'hash'" />
            </div>
            <template #fallback>
              <div class="loading-state">
                <Icon name="heroicons:arrow-path" class="loading-spinner animate-spin" aria-hidden="true" />
                <p class="loading-text">Cargando tu cuenta…</p>
              </div>
            </template>
          </ClientOnly>
        </div>
      </div>
    </Transition>
  </PageLayout>
</template>

<script setup lang="ts">
import { UserProfile } from '@clerk/vue'
import { useRankIconAsset } from '~/composables/useRankIcon'
import { tierName } from '~/utils/tiers'

definePageMeta({
  middleware: 'auth'
})

const auth = useAuth()
const { isLoaded: authLoaded, isSignedIn } = auth
const { isLoaded: userLoaded, user } = useUser()
const { player, loading, error, fetchPlayer } = usePlayer()
const { status: decayStatus, fetchDecayStatus, checkDecayOnLogin } = useMonthlyDecay()

const isLoaded = computed(() => authLoaded.value && userLoaded.value)
const userId = computed(() => user.value?.id || null)
const showUserProfileModal = ref(false)

// Rating stats from history
const ratingStats = ref<{ wins: number; losses: number; win_rate: number; peak_elo: number } | null>(null)

// Placement match results
const placementMatchResults = ref<Array<'win' | 'loss' | null>>([])

// Ranking position
const rankingPosition = ref<any>(null)
const rankingLoading = ref(false)

// Check if player is unrated
const isUnrated = computed(() => (player.value?.total_matches_played ?? 0) === 0)

// Client-side tier calculation (same as other components)
const RATING_TIERS = [
  { tier: 'Bronze', minElo: 1, maxElo: 1499, color: '#CD7F32' },
  { tier: 'Silver', minElo: 1500, maxElo: 1999, color: '#C0C0C0' },
  { tier: 'Gold', minElo: 2000, maxElo: 2499, color: '#FFD700' },
  { tier: 'Platinum', minElo: 2500, maxElo: 2999, color: '#E5E4E2' },
  { tier: 'Diamond', minElo: 3000, maxElo: 3499, color: '#B9F2FF' },
  { tier: 'Master', minElo: 3500, maxElo: 3999, color: '#9932CC' },
  { tier: 'Grandmaster', minElo: 4000, maxElo: Infinity, color: '#FF4500' },
]

// Get tier info and rank icon
const tierInfo = computed(() => {
  if (!player.value?.elo) return null
  
  // Use client-side calculation
  for (const tier of RATING_TIERS) {
    if (player.value.elo >= tier.minElo && player.value.elo <= tier.maxElo) {
      return tier
    }
  }
  return RATING_TIERS[0] // Default to Bronze
})

const position = computed(() => (rankingPosition.value?.success && !rankingPosition.value?.is_unrated ? rankingPosition.value.position || null : null))
const globalRank = computed(() => (position.value?.total_players > 0 ? position.value.global_rank || null : null))
const percentile = computed(() => {
  const p = position.value?.percentile
  return typeof p === 'number' && p >= 0 ? p : null
})
const winRate = computed(() => (ratingStats.value && ratingStats.value.wins + ratingStats.value.losses > 0 ? `${Math.round(ratingStats.value.win_rate)}%` : '—'))

// Static tier art (DESIGN.md §4: secondary to content, fits its panel, no looping animation)
const tierImage = computed(() => {
  if (isUnrated.value || !tierInfo.value) return null
  return useRankIconAsset(getTop100Tier() || tierInfo.value.tier)
})

const loadPlacementMatchResults = async (playerId: string) => {
  try {
    // Fetch rating history to get placement match results
    // Note: rating_history only contains competitive matches (is_competitive = true)
    const historyResponse = await $fetch<any>(`/api/players/${playerId}/rating-history`, {
      query: { limit: 100 }
    })
    
    // Initialize with all nulls
    placementMatchResults.value = [null, null, null]
    
    if (historyResponse?.history && Array.isArray(historyResponse.history)) {
      // Filter placement matches
      const placementMatches = historyResponse.history.filter((h: any) => h.is_placement_match === true)
      
      if (placementMatches.length > 0) {
        // Sort by created_at ascending (oldest first) to get matches in chronological order
        const sortedMatches = placementMatches.sort((a: any, b: any) => {
          const dateA = new Date(a.created_at).getTime()
          const dateB = new Date(b.created_at).getTime()
          return dateA - dateB
        })
        
        // Map to win/loss/null array - only take first 3
        const results = sortedMatches.slice(0, 3).map((match: any) => {
          if (match.was_winner === true) return 'win'
          if (match.was_winner === false) return 'loss'
          return null
        })
        
        // Fill the array with results, keeping nulls for remaining slots
        for (let i = 0; i < 3; i++) {
          if (i < results.length) {
            placementMatchResults.value[i] = results[i]
          }
        }
      }
    }
  } catch (err) {
    console.error('Failed to load placement match results:', err)
    placementMatchResults.value = [null, null, null]
  }
}

const loadProfile = async () => {
  if (userId.value) {
    await fetchPlayer(userId.value)
    
    // Load decay status if player exists and is rated
    if (player.value?.id && !isUnrated.value) {
      await fetchDecayStatus(player.value.id)
      
      // Load rating stats
      try {
        const historyResponse = await $fetch<any>(`/api/players/${player.value.id}/rating-history`, {
          query: { limit: 100 }
        })
        ratingStats.value = historyResponse.stats
      } catch (err) {
        console.error('Failed to load rating stats:', err)
      }
      
      // Load ranking position
      rankingLoading.value = true
      try {
        const rankingData = await $fetch(`/api/players/${player.value.id}/ranking-position`).catch(() => null)
        rankingPosition.value = rankingData
      } catch (err) {
        console.error('Error loading ranking:', err)
      } finally {
        rankingLoading.value = false
      }
      
      // Load placement match results if in placement
      if ((player.value.placement_matches_completed || 0) < 3) {
        await loadPlacementMatchResults(player.value.id)
      }
    }
  }
}

onMounted(async () => {
  if (isLoaded.value && userId.value && !loading.value) {
    await loadProfile()
  }
})

// Computed property to safely track when profile should be loaded
const shouldLoadProfile = computed(() => {
  return !!(isLoaded.value && isSignedIn.value && userId.value && !player.value && !loading.value)
})

// Watch for auth state changes and load profile when ready
watch(shouldLoadProfile, async (shouldLoad) => {
  if (shouldLoad) {
    await loadProfile()
  }
}, { immediate: false })

// Get Top 100 tier - only applies when there are 100+ Grandmaster players and player is in top 100
const getTop100Tier = () => {
  if (!tierInfo.value || tierInfo.value.tier !== 'Grandmaster') {
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

const getPlayerInitials = (name: string) => {
  if (!name) return '?'
  const parts = name.trim().split(' ').filter(p => p.length > 0)
  if (parts.length >= 2) {
    const first = parts[0]?.[0] || ''
    const last = parts[parts.length - 1]?.[0] || ''
    if (first && last) {
      return (first + last).toUpperCase()
    }
  }
  return name.substring(0, 2).toUpperCase()
}

const openUserProfileModal = () => {
  showUserProfileModal.value = true
}

const closeUserProfileModal = () => {
  showUserProfileModal.value = false
}
</script>

<style scoped>
.profile-tools { align-self: flex-end; }
.identity { width: 100%; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 12px; }
.identity h1 { font-size: clamp(30px, 3vw, 38px); line-height: 1.12; letter-spacing: -0.035em; overflow-wrap: anywhere; }
.identity > p { max-width: 32ch; color: var(--on-photo-muted); overflow-wrap: anywhere; }
.location { display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 14px; }

.rating { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.rating__copy { display: grid; gap: 4px; justify-items: start; min-width: 0; }
.rating__label { font-weight: 500; font-size: 14px; letter-spacing: 0; }
.rating-number { font-size: clamp(42px, 4vw, 60px); font-weight: 700; letter-spacing: -0.05em; line-height: 1.2; font-variant-numeric: tabular-nums; }
.rating-number span { font-size: 14px; font-weight: 500; letter-spacing: 0; color: var(--foreground-muted); }
.rating__tier { width: 64px; height: 64px; object-fit: contain; flex-shrink: 0; }

.placement-wrap > :deep(div:first-child) { margin-top: 0; padding-top: 0; border-top: 0; }
.account { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; }
.account__copy { display: grid; gap: 4px; min-width: 0; overflow-wrap: anywhere; }
.account__copy h2 { font-size: 20px; }

.account-modal { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 16px; }
.account-modal__backdrop { position: absolute; inset: 0; background: rgba(0, 0, 0, 0.6); }
.account-modal__close { position: absolute; top: 12px; right: 12px; z-index: 2; }
.user-profile-modal-container { position: relative; z-index: 1; max-width: min(960px, 100%); max-height: 90vh; overflow: hidden; border-radius: var(--radius); border: 1px solid var(--edge); background: var(--surface); }
.user-profile-wrapper { width: 100%; overflow: auto; max-height: 90vh; }

@media (prefers-reduced-motion: no-preference) {
  .modal-enter-active, .modal-leave-active { transition: opacity 0.2s ease; }
  .modal-enter-active .user-profile-modal-container { transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
}
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .user-profile-modal-container { transform: translateY(8px); }
</style>
