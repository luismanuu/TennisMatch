<template>
  <div class="min-h-screen bg-background relative overflow-hidden">
    <!-- Ambient Background Effects -->
    <div class="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <div class="orb orb-accent w-96 h-96 -top-48 -right-48 animate-float opacity-20"></div>
      <div class="orb orb-secondary w-80 h-80 -bottom-40 -left-40 animate-float-delayed opacity-15"></div>
      <div class="grid-pattern absolute inset-0 opacity-30"></div>
    </div>

    <!-- Navigation -->
    <AppNavigation />

    <div class="h-16"></div>

    <div class="section-padding relative z-10">
      <div class="container-medium px-6">
        <!-- Header -->
        <div class="text-center mb-12 animate-fade-up">
          <h1 class="text-size-1 font-semibold text-foreground mb-4">
            Mi Perfil
          </h1>
          <p class="text-size-3 font-regular text-foreground-muted">
            Gestiona tu informacion personal y preferencias
          </p>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="glass-card-elevated p-12 text-center animate-fade-in-scale">
          <div class="w-16 h-16 rounded-full bg-accent-subtle flex items-center justify-center mx-auto mb-6">
            <Icon name="heroicons:arrow-path" class="w-8 h-8 text-accent animate-spin" />
          </div>
          <p class="text-size-3 font-regular text-foreground-muted">Cargando perfil...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="glass-card-elevated p-10 max-w-md mx-auto animate-fade-in-scale">
          <div class="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
            <Icon name="heroicons:exclamation-triangle" class="w-10 h-10 text-red-400" />
          </div>
          <h3 class="text-size-2 font-semibold text-foreground mb-3 text-center">Error</h3>
          <p class="text-size-4 font-regular text-foreground-muted mb-6 text-center">{{ error.message }}</p>
          <button @click="loadProfile" class="btn-primary text-size-3 w-full justify-center group">
            <Icon name="heroicons:arrow-path" class="w-5 h-5 mr-2 group-hover:rotate-180 transition-transform duration-500" />
            Reintentar
          </button>
        </div>

        <!-- Profile Content -->
        <div v-else-if="player" class="glass-card-elevated p-8 md:p-10 animate-fade-up animate-delay-1 hover-lift">
          <!-- Profile Header -->
          <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-10">
            <div class="flex items-center gap-6">
              <div class="w-24 h-24 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 border-2 border-accent/30 flex items-center justify-center flex-shrink-0">
                <span class="text-4xl font-bold text-accent">
                  {{ getPlayerInitials(player.name) }}
                </span>
              </div>
              <div>
                <h2 class="text-size-1 font-semibold text-foreground mb-2">{{ player.name }}</h2>
                <div class="flex items-center gap-2 text-foreground-muted">
                  <Icon name="heroicons:envelope" class="w-4 h-4" />
                  <p class="text-size-4 font-regular">{{ user?.primaryEmailAddress?.emailAddress }}</p>
                </div>
              </div>
            </div>
            <NuxtLink to="/profile/edit" class="btn-primary text-size-3 !py-3 !px-6 group">
              <Icon name="heroicons:pencil" class="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
              Editar Perfil
            </NuxtLink>
          </div>

          <!-- Email Management Section -->
          <div class="mb-8 p-6 rounded-xl bg-gradient-to-br from-surface to-surface-elevated border border-border-subtle">
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg bg-accent-subtle flex items-center justify-center">
                  <Icon name="heroicons:envelope" class="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p class="text-size-4 font-semibold text-foreground-muted">Email</p>
                  <p class="text-size-2 font-semibold text-foreground">
                    {{ user?.primaryEmailAddress?.emailAddress || 'No disponible' }}
                  </p>
                </div>
              </div>
              <button
                @click="openUserProfileModal"
                class="btn-secondary text-size-3 !py-2 !px-4 group"
              >
                <Icon name="heroicons:cog-6-tooth" class="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                Gestionar Cuenta
              </button>
            </div>
            <p class="text-size-4 font-regular text-foreground-muted">
              Gestiona tu direccion de correo electronico y configuracion de cuenta
            </p>
          </div>

          <!-- Profile Info Grid -->
          <div class="grid md:grid-cols-3 gap-6 mb-8">
            <!-- Category -->
            <div class="p-6 rounded-xl bg-gradient-to-br from-surface to-surface-elevated border border-border-subtle hover:border-accent/30 transition-all hover-lift">
              <div class="flex items-center gap-3 mb-4">
                <div class="w-10 h-10 rounded-lg bg-accent-subtle flex items-center justify-center">
                  <Icon name="heroicons:star" class="w-5 h-5 text-accent" />
                </div>
                <p class="text-size-4 font-semibold text-foreground-muted">Categoria</p>
              </div>
              <p class="text-size-2 font-semibold text-foreground mb-2">
                {{ player.category?.name || 'No seleccionada' }}
              </p>
              <p v-if="player.category?.description" class="text-size-4 font-regular text-foreground-muted">
                {{ player.category.description }}
              </p>
            </div>

            <!-- City -->
            <div class="p-6 rounded-xl bg-gradient-to-br from-surface to-surface-elevated border border-border-subtle hover:border-accent/30 transition-all hover-lift">
              <div class="flex items-center gap-3 mb-4">
                <div class="w-10 h-10 rounded-lg bg-accent-secondary-muted flex items-center justify-center">
                  <Icon name="heroicons:map-pin" class="w-5 h-5 text-accent-secondary" />
                </div>
                <p class="text-size-4 font-semibold text-foreground-muted">Ciudad</p>
              </div>
              <p class="text-size-2 font-semibold text-foreground">
                {{ player.city?.name || 'No especificada' }}
              </p>
            </div>

            <!-- Phone Number -->
            <div class="p-6 rounded-xl bg-gradient-to-br from-surface to-surface-elevated border border-border-subtle hover:border-accent/30 transition-all hover-lift">
              <div class="flex items-center gap-3 mb-4">
                <div class="w-10 h-10 rounded-lg bg-accent-secondary-muted flex items-center justify-center">
                  <Icon name="heroicons:phone" class="w-5 h-5 text-accent-secondary" />
                </div>
                <p class="text-size-4 font-semibold text-foreground-muted">Telefono</p>
              </div>
              <p class="text-size-2 font-semibold text-foreground">
                {{ player.phone_number || 'No proporcionado' }}
              </p>
            </div>
          </div>

          <!-- Rating Section -->
          <div class="mb-8">
            <!-- ELO Rating with Tier -->
            <div class="p-8 rounded-xl bg-gradient-to-br from-accent-subtle/30 to-accent-subtle/10 border border-accent/30 hover-lift">
              <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-3">
                  <div class="w-12 h-12 rounded-xl bg-accent/20 border border-accent/30 flex items-center justify-center">
                    <Icon name="heroicons:trophy" class="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <p class="text-size-3 font-semibold text-foreground">Puntuación ELO</p>
                    <p class="text-size-4 text-foreground-muted">Clasificación Actual</p>
                  </div>
                </div>
                <RatingTierBadge 
                  :elo="player.elo" 
                  :total-matches-played="player.total_matches_played || 0"
                  :placement-matches-completed="player.placement_matches_completed || 0"
                  :show-provisional="true"
                />
              </div>
              <div class="flex items-baseline gap-3">
                <p class="text-size-1 font-bold text-gradient-static">{{ player.elo }}</p>
                <NuxtLink 
                  v-if="!isUnrated"
                  to="/my-ranking" 
                  class="btn-secondary text-size-4 !py-2 !px-4 group"
                >
                  <Icon name="heroicons:chart-bar-square" class="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                  Ver Mi Ranking
                </NuxtLink>
              </div>
              <p class="text-size-4 font-regular text-foreground-muted mt-2">
                {{ isUnrated ? '¡Juega tu primer partido para obtener tu clasificación!' : 'Tu calificación actual en el sistema' }}
              </p>

              <!-- Placement Progress (only show if rated and not completed) -->
              <PlacementProgress 
                v-if="!isUnrated && (player.placement_matches_completed || 0) < 3"
                :completed="player.placement_matches_completed || 0"
                :match-results="placementMatchResults"
              />
            </div>

            <!-- Monthly Decay Warning -->
            <MonthlyDecayWarning 
              v-if="decayStatus && !isUnrated"
              :matches-this-month="decayStatus.matches_this_month"
              :matches-required="decayStatus.matches_required"
              :days-remaining="decayStatus.days_remaining_in_month"
              :estimated-decay="decayStatus.estimated_decay"
              :show-matchmaking-link="true"
              :is-in-placement="(player.placement_matches_completed || 0) < 3"
            />

            <!-- Win/Loss Streak -->
            <div v-if="!isUnrated && (player.win_streak > 0 || player.loss_streak > 0)" class="flex gap-4">
              <div 
                v-if="player.win_streak > 0"
                class="flex-1 p-4 rounded-xl bg-green-500/10 border-2 border-green-500/30"
              >
                <div class="flex items-center gap-2 mb-2">
                  <Icon name="heroicons:fire" class="w-5 h-5 text-green-400" />
                  <span class="text-size-3 font-semibold text-green-400">¡Racha de victorias!</span>
                </div>
                <p class="text-size-4 text-foreground-muted">
                  {{ player.win_streak }} victoria(s) consecutiva(s)
                  <span v-if="player.win_streak >= 5" class="text-green-400"> (¡Máximo bonus!)</span>
                </p>
              </div>
            </div>
          </div>

          <!-- Stats -->
          <div class="pt-8 border-t border-border-subtle">
            <div class="flex items-center gap-3 mb-6">
              <Icon name="heroicons:chart-bar" class="w-6 h-6 text-foreground-muted" />
              <h3 class="text-size-2 font-semibold text-foreground">Estadisticas</h3>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div class="text-center p-6 rounded-xl bg-gradient-to-br from-surface to-surface-elevated border border-border-subtle hover:border-accent/30 transition-all hover-lift">
                <div class="w-10 h-10 rounded-lg bg-accent-subtle flex items-center justify-center mx-auto mb-3">
                  <Icon name="heroicons:trophy" class="w-5 h-5 text-accent" />
                </div>
                <div class="text-size-1 font-semibold text-gradient-static mb-1">{{ player.elo }}</div>
                <div class="text-size-4 font-regular text-foreground-muted">ELO</div>
              </div>
              <div class="text-center p-6 rounded-xl bg-gradient-to-br from-surface to-surface-elevated border border-border-subtle hover:border-accent/30 transition-all hover-lift">
                <div class="w-10 h-10 rounded-lg bg-accent-secondary-muted flex items-center justify-center mx-auto mb-3">
                  <Icon name="heroicons:calendar" class="w-5 h-5 text-accent-secondary" />
                </div>
                <div class="text-size-1 font-semibold text-gradient-static mb-1">{{ player.total_matches_played || 0 }}</div>
                <div class="text-size-4 font-regular text-foreground-muted">Partidos</div>
              </div>
              <div class="text-center p-6 rounded-xl bg-gradient-to-br from-surface to-surface-elevated border border-border-subtle hover:border-accent/30 transition-all hover-lift">
                <div class="w-10 h-10 rounded-lg bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-3">
                  <Icon name="heroicons:star" class="w-5 h-5 text-green-400" />
                </div>
                <div class="text-size-1 font-semibold text-gradient-static mb-1">{{ ratingStats?.wins || 0 }}</div>
                <div class="text-size-4 font-regular text-foreground-muted">Victorias</div>
              </div>
              <div class="text-center p-6 rounded-xl bg-gradient-to-br from-surface to-surface-elevated border border-border-subtle hover:border-accent/30 transition-all hover-lift">
                <div class="w-10 h-10 rounded-lg bg-accent-subtle flex items-center justify-center mx-auto mb-3">
                  <Icon name="heroicons:chart-bar" class="w-5 h-5 text-accent" />
                </div>
                <div class="text-size-1 font-semibold text-gradient-static mb-1">
                  {{ ratingStats && ratingStats.wins + ratingStats.losses > 0 
                    ? Math.round(ratingStats.win_rate) + '%' 
                    : '-' }}
                </div>
                <div class="text-size-4 font-regular text-foreground-muted">Win Rate</div>
              </div>
            </div>
          </div>

        </div>

        <!-- No Profile State - only show when NOT loading and no player exists -->
        <div v-else-if="!loading && !player" class="glass-card-elevated p-12 text-center max-w-md mx-auto animate-fade-in-scale">
          <div class="w-24 h-24 rounded-2xl bg-gradient-to-br from-accent-subtle to-accent-subtle/50 border-2 border-accent/30 flex items-center justify-center mx-auto mb-6">
            <Icon name="heroicons:user-circle" class="w-12 h-12 text-accent" />
          </div>
          <h2 class="text-size-2 font-semibold text-foreground mb-4">Completa tu perfil</h2>
          <p class="text-size-4 font-regular text-foreground-muted mb-8 max-w-md mx-auto leading-relaxed">
            Para comenzar a usar la plataforma, necesitas completar tu perfil de jugador.
          </p>
          <NuxtLink to="/onboarding" class="btn-primary text-size-3 inline-flex items-center group">
            <Icon name="heroicons:arrow-right" class="w-5 h-5 mr-2 group-hover:translate-x-1 transition-transform" />
            Completar Perfil
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- UserProfile Modal -->
    <Transition name="modal">
      <div
        v-if="showUserProfileModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      >
        <!-- Backdrop -->
        <div 
          class="absolute inset-0 bg-black/70 backdrop-blur-md" 
          @click="closeUserProfileModal"
        ></div>
        
        <!-- Modal Content -->
        <div class="user-profile-modal-container relative z-10">
          <!-- Close button -->
          <button
            @click="closeUserProfileModal"
            class="absolute top-4 right-4 z-20 p-2 rounded-full bg-surface-elevated border border-border hover:bg-surface hover:border-accent transition-all group"
            aria-label="Cerrar modal"
          >
            <Icon name="heroicons:x-mark" class="w-5 h-5 text-foreground-muted group-hover:text-accent transition-colors" />
          </button>
          
          <ClientOnly>
            <div class="user-profile-wrapper">
              <UserProfile 
                :routing="'hash'"
              />
            </div>
            <template #fallback>
              <div class="flex flex-col items-center justify-center py-16 px-8 bg-surface rounded-xl">
                <div class="w-16 h-16 rounded-full bg-accent-subtle flex items-center justify-center mb-6">
                  <Icon name="heroicons:arrow-path" class="w-8 h-8 text-accent animate-spin" />
                </div>
                <p class="text-size-3 font-regular text-foreground-muted">Cargando gestion de cuenta...</p>
              </div>
            </template>
          </ClientOnly>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { UserProfile } from '@clerk/vue'

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

// Check if player is unrated
const isUnrated = computed(() => (player.value?.total_matches_played ?? 0) === 0)

const loadPlacementMatchResults = async (playerId: string) => {
  try {
    // Fetch rating history to get placement match results
    // Note: rating_history only contains competitive matches (is_competitive = true)
    const historyResponse = await $fetch<any>(`/api/players/${playerId}/rating-history`, {
      query: { limit: 100 }
    })
    
    if (historyResponse?.history) {
      // Filter placement matches and get results in order
      // Only competitive matches appear in rating_history, so we don't need to filter by is_competitive
      const placementMatches = historyResponse.history
        .filter((h: any) => h.is_placement_match === true)
        .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) // Oldest first
      
      // Map to win/loss/null array
      placementMatchResults.value = placementMatches.map((match: any) => {
        if (match.was_winner === true) return 'win'
        return 'loss'
      })
      
      // Fill remaining slots with null
      while (placementMatchResults.value.length < 3) {
        placementMatchResults.value.push(null)
      }
    }
  } catch (err) {
    console.error('Failed to load placement match results:', err)
    placementMatchResults.value = []
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
/* Modal container with glass-morphism styling */
.user-profile-modal-container {
  max-width: 95vw;
  width: auto;
  max-height: 90vh;
  overflow: hidden;
  border-radius: var(--radius-xl);
  box-shadow: 
    0 25px 50px -12px oklch(0 0 0 / 0.4),
    0 0 0 1px var(--border);
}

.user-profile-wrapper {
  width: 100%;
  overflow: auto;
  max-height: 85vh;
}

/* Modal transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}

.modal-enter-active .user-profile-modal-container,
.modal-leave-active .user-profile-modal-container {
  transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .user-profile-modal-container,
.modal-leave-to .user-profile-modal-container {
  opacity: 0;
  transform: scale(0.95) translateY(-10px);
}

.modal-enter-to .user-profile-modal-container,
.modal-leave-from .user-profile-modal-container {
  opacity: 1;
  transform: scale(1) translateY(0);
}
</style>
