<template>
  <div class="min-h-screen">
    <!-- Navigation -->
    <AppNavigation />

    <div class="h-16"></div>

    <div class="section-padding">
      <div class="container-medium px-6">
        <!-- Header -->
        <div class="text-center mb-12">
          <NuxtLink 
            v-if="canGoBack"
            to="/matches" 
            class="text-size-3 text-foreground-muted hover:text-foreground mb-4 inline-block"
          >
            ← Volver
          </NuxtLink>
          <h1 class="text-size-1 font-semibold text-foreground mb-4">
            Perfil del Jugador
          </h1>
        </div>

        <!-- Loading State -->
        <div v-if="publicLoading || publicPendingLoading" class="glass-card-elevated p-12 text-center">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
          <p class="text-size-4 font-regular text-foreground-muted mt-4">Cargando perfil...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="(publicError && !publicPendingPlayer) || (publicPendingError && !publicPlayer)" class="glass-card-elevated p-8">
          <div class="flex items-center gap-4 mb-4">
            <div class="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
              <span class="text-2xl">⚠️</span>
            </div>
            <div>
              <h3 class="text-size-2 font-semibold text-foreground mb-1">Error</h3>
              <p class="text-size-4 font-regular text-foreground-muted">{{ (publicError || publicPendingError)?.message || 'Error al cargar el perfil' }}</p>
            </div>
          </div>
          <button @click="loadProfile" class="btn-primary text-size-4">
            Reintentar
          </button>
        </div>

        <!-- Not Found State -->
        <div v-else-if="!publicPlayer && !publicPendingPlayer && !publicLoading && !publicPendingLoading" class="glass-card-elevated p-12 text-center">
          <div class="w-20 h-20 rounded-2xl bg-accent-subtle flex items-center justify-center mx-auto mb-6">
            <span class="text-4xl">👤</span>
          </div>
          <h2 class="text-size-2 font-semibold text-foreground mb-4">Jugador no encontrado</h2>
          <p class="text-size-4 font-regular text-foreground-muted mb-8 max-w-md mx-auto">
            El perfil que buscas no existe o ha sido eliminado.
          </p>
          <NuxtLink to="/matches" class="btn-primary text-size-3 inline-flex items-center">
            Volver a Partidos
            <svg class="w-5 h-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </NuxtLink>
        </div>

        <!-- Profile Content - Regular Player -->
        <div v-else-if="publicPlayer" class="glass-card-elevated p-8">
          <div class="flex items-start justify-between mb-8">
            <div>
              <h2 class="text-size-2 font-semibold text-foreground mb-2">{{ publicPlayer.name }}</h2>
              <p class="text-size-4 font-regular text-foreground-muted">
                Miembro desde {{ formatDate(publicPlayer.created_at) }}
              </p>
            </div>
            <div class="w-16 h-16 rounded-2xl bg-accent-subtle flex items-center justify-center">
              <span class="text-3xl">🎾</span>
            </div>
          </div>

          <div class="grid md:grid-cols-2 gap-6">
            <!-- Category -->
            <div class="p-6 rounded-xl bg-surface border border-border-subtle">
              <p class="text-size-4 font-regular text-foreground-subtle mb-2">Categoría</p>
              <p class="text-size-3 font-semibold text-foreground">
                {{ publicPlayer.category?.name || 'No seleccionada' }}
              </p>
              <p v-if="publicPlayer.category?.description" class="text-size-4 font-regular text-foreground-muted mt-2">
                {{ publicPlayer.category.description }}
              </p>
            </div>

            <!-- ELO Rating -->
            <div class="p-6 rounded-xl bg-surface border border-border-subtle">
              <p class="text-size-4 font-regular text-foreground-subtle mb-2">Puntuación ELO</p>
              <p class="text-size-1 font-semibold text-gradient-static">{{ publicPlayer.elo }}</p>
              <p class="text-size-4 font-regular text-foreground-muted mt-2">
                Calificación actual
              </p>
            </div>
          </div>

          <!-- Stats -->
          <div class="mt-8 pt-8 border-t border-border-subtle">
            <h3 class="text-size-3 font-semibold text-foreground mb-4">Estadísticas</h3>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div class="text-center p-4 rounded-xl bg-surface border border-border-subtle">
                <div class="text-size-1 font-semibold text-gradient-static mb-1">{{ publicPlayer.elo }}</div>
                <div class="text-size-4 font-regular text-foreground-muted">ELO</div>
              </div>
              <div class="text-center p-4 rounded-xl bg-surface border border-border-subtle">
                <div class="text-size-1 font-semibold text-gradient-static mb-1">{{ publicPlayer.total_matches_played || 0 }}</div>
                <div class="text-size-4 font-regular text-foreground-muted">Partidos</div>
              </div>
              <div class="text-center p-4 rounded-xl bg-surface border border-border-subtle">
                <div class="text-size-1 font-semibold text-gradient-static mb-1">{{ publicPlayer.win_streak || 0 }}</div>
                <div class="text-size-4 font-regular text-foreground-muted">Racha Victorias</div>
              </div>
              <div class="text-center p-4 rounded-xl bg-surface border border-border-subtle">
                <div class="text-size-1 font-semibold text-gradient-static mb-1">{{ publicPlayer.placement_matches_completed || 0 }}/3</div>
                <div class="text-size-4 font-regular text-foreground-muted">Colocación</div>
              </div>
            </div>
          </div>

          <!-- Ranking and Match History Tabs -->
          <div class="mt-8 pt-8 border-t border-border-subtle">
            <!-- Tab Navigation -->
            <div class="flex gap-2 mb-6 border-b border-border-subtle">
              <button
                @click="activeTab = 'ranking'"
                :class="[
                  'px-6 py-3 text-size-3 font-semibold transition-all border-b-2 -mb-px',
                  activeTab === 'ranking'
                    ? 'text-accent border-accent'
                    : 'text-foreground-muted border-transparent hover:text-foreground'
                ]"
              >
                Ranking
              </button>
              <button
                @click="activeTab = 'matches'"
                :class="[
                  'px-6 py-3 text-size-3 font-semibold transition-all border-b-2 -mb-px',
                  activeTab === 'matches'
                    ? 'text-accent border-accent'
                    : 'text-foreground-muted border-transparent hover:text-foreground'
                ]"
              >
                Historial de Partidas
              </button>
            </div>

            <!-- Ranking Tab -->
            <div v-if="activeTab === 'ranking'" class="animate-fade-in">
              <div v-if="rankingLoading" class="text-center py-12">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
                <p class="text-size-4 font-regular text-foreground-muted mt-4">Cargando ranking...</p>
              </div>
              <div v-else-if="rankingPosition && rankingPosition.success && !rankingPosition.is_unrated && rankingPosition.position && rankingPosition.position.global_rank && rankingPosition.position.total_players > 0" class="space-y-6">
                <!-- Global Ranking -->
                <div v-if="rankingPosition.position.total_players > 0" class="p-6 rounded-xl bg-surface border border-border-subtle">
                  <div class="flex items-center justify-between mb-4">
                    <h4 class="text-size-3 font-semibold text-foreground">Ranking Global</h4>
                    <RatingTierBadge 
                      :elo="publicPlayer.elo" 
                      :total-matches-played="publicPlayer.total_matches_played"
                      :show-elo="false"
                    />
                  </div>
                  <div class="grid md:grid-cols-3 gap-4">
                    <div>
                      <p class="text-size-5 text-foreground-muted mb-1">Posición</p>
                      <p class="text-size-2 font-bold text-foreground">
                        #{{ rankingPosition.position.global_rank }}
                        <span class="text-size-4 font-regular text-foreground-muted">
                          de {{ rankingPosition.position.total_players }}
                        </span>
                      </p>
                    </div>
                    <div v-if="rankingPosition.position.percentile >= 0">
                      <p class="text-size-5 text-foreground-muted mb-1">Percentil</p>
                      <p class="text-size-2 font-bold text-foreground">
                        Top {{ rankingPosition.position.percentile }}%
                      </p>
                    </div>
                    <div v-if="rankingPosition.position.players_below >= 0">
                      <p class="text-size-5 text-foreground-muted mb-1">Jugadores por debajo</p>
                      <p class="text-size-2 font-bold text-foreground">
                        {{ rankingPosition.position.players_below }}
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Segment Ranking -->
                <div v-if="rankingPosition.position.segment_rank && rankingPosition.position.segment_total && rankingPosition.position.segment_total > 0" class="p-6 rounded-xl bg-surface border border-border-subtle">
                  <h4 class="text-size-3 font-semibold text-foreground mb-4">
                    Ranking en {{ rankingPosition.position.segment_name || 'Tu Región' }}
                  </h4>
                  <div class="grid md:grid-cols-2 gap-4">
                    <div>
                      <p class="text-size-5 text-foreground-muted mb-1">Posición</p>
                      <p class="text-size-2 font-bold text-foreground">
                        #{{ rankingPosition.position.segment_rank }}
                        <span class="text-size-4 font-regular text-foreground-muted">
                          de {{ rankingPosition.position.segment_total }}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Tier Ranking -->
                <div v-if="rankingPosition.position.tier_rank && rankingPosition.position.tier_total && rankingPosition.position.tier_total > 0 && rankingPosition.tier" class="p-6 rounded-xl bg-surface border border-border-subtle">
                  <h4 class="text-size-3 font-semibold text-foreground mb-4">
                    Ranking en {{ rankingPosition.tier }}
                  </h4>
                  <div class="grid md:grid-cols-2 gap-4">
                    <div>
                      <p class="text-size-5 text-foreground-muted mb-1">Posición</p>
                      <p class="text-size-2 font-bold text-foreground">
                        #{{ rankingPosition.position.tier_rank }}
                        <span class="text-size-4 font-regular text-foreground-muted">
                          de {{ rankingPosition.position.tier_total }}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else-if="rankingPosition && rankingPosition.is_unrated" class="p-6 rounded-xl bg-surface border border-border-subtle text-center">
                <p class="text-size-4 font-regular text-foreground-muted">
                  Este jugador aún no ha completado partidos de colocación
                </p>
              </div>
              <div v-else-if="rankingPosition && rankingPosition.success && rankingPosition.position && (!rankingPosition.position.total_players || rankingPosition.position.total_players === 0)" class="p-6 rounded-xl bg-surface border border-border-subtle text-center">
                <p class="text-size-4 font-regular text-foreground-muted">
                  Aún no hay suficientes jugadores para calcular el ranking. Las estadísticas estarán disponibles cuando haya más jugadores en el sistema.
                </p>
              </div>
              <div v-else-if="rankingPosition && !rankingPosition.success" class="p-6 rounded-xl bg-surface border border-border-subtle text-center">
                <p class="text-size-4 font-regular text-foreground-muted">
                  No se pudo cargar la información de ranking
                </p>
              </div>
              <div v-else-if="!rankingPosition && !rankingLoading" class="p-6 rounded-xl bg-surface border border-border-subtle text-center">
                <p class="text-size-4 font-regular text-foreground-muted">
                  No hay información de ranking disponible
                </p>
              </div>
            </div>

            <!-- Match History Tab -->
            <div v-if="activeTab === 'matches'" class="animate-fade-in">
              <div v-if="matchHistoryLoading" class="text-center py-12">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
                <p class="text-size-4 font-regular text-foreground-muted mt-4">Cargando partidos...</p>
              </div>
              <div v-else-if="matchHistory.length > 0" class="space-y-4">
                <div 
                  v-for="match in matchHistory" 
                  :key="match.id"
                  class="p-6 rounded-xl bg-surface border border-border-subtle hover:border-accent/50 transition-all cursor-pointer"
                  @click="navigateTo(`/matches/${match.id}`)"
                >
                  <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <!-- Match Info -->
                    <div class="flex-1">
                      <div class="flex items-center gap-4 mb-3">
                        <!-- Opponent -->
                        <div class="flex items-center gap-3">
                          <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-surface-elevated to-surface border-2 border-border-subtle flex items-center justify-center">
                            <span class="text-lg font-bold text-foreground-muted">
                              {{ getOpponentInitials(match) }}
                            </span>
                          </div>
                          <div>
                            <p class="text-size-3 font-semibold text-foreground">
                              {{ getOpponentName(match) }}
                            </p>
                            <p v-if="match.played_at" class="text-size-5 text-foreground-muted">
                              {{ formatMatchDate(match.played_at) }}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div class="flex items-center gap-3 flex-wrap">
                        <span 
                          class="px-3 py-1 rounded-full text-size-5 font-semibold"
                          :class="getMatchStatusClass(match.status)"
                        >
                          {{ getMatchStatusLabel(match.status) }}
                        </span>
                        <span v-if="match.tournament" class="px-3 py-1 rounded-full bg-accent-subtle/30 border border-accent/30 text-size-5 text-foreground-muted">
                          {{ match.tournament.name }}
                        </span>
                      </div>
                    </div>
                    <!-- Result -->
                    <div v-if="match.status === 'completed' && match.score" class="text-center md:text-right">
                      <p class="text-size-2 font-bold text-foreground mb-1">{{ match.score }}</p>
                      <p v-if="match.winner" class="text-size-5 text-foreground-muted mb-2">
                        Ganador: {{ match.winner.name }}
                      </p>
                      <!-- ELO Change - Only show for competitive matches -->
                      <div v-if="match.is_competitive && match.elo_change !== undefined && match.elo_change !== null" class="mt-2">
                        <div 
                          class="text-size-2 font-bold"
                          :class="match.elo_change > 0 ? 'text-green-400' : match.elo_change < 0 ? 'text-red-400' : 'text-foreground-muted'"
                        >
                          {{ match.elo_change > 0 ? '+' : '' }}{{ match.elo_change }} ELO
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="p-6 rounded-xl bg-surface border border-border-subtle text-center">
                <p class="text-size-4 font-regular text-foreground-muted">
                  No hay partidos registrados
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Profile Content - Pending Player -->
        <div v-else-if="publicPendingPlayer" class="glass-card-elevated p-8">
          <!-- Pending Status Badge -->
          <div class="mb-6">
            <span class="px-4 py-2 rounded-full text-size-4 font-semibold bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 inline-block">
              ⏳ Pendiente de registro
            </span>
          </div>

          <div class="flex items-start justify-between mb-8">
            <div>
              <h2 class="text-size-2 font-semibold text-foreground mb-2">{{ publicPendingPlayer.name }}</h2>
              <p class="text-size-4 font-regular text-foreground-muted">
                Invitado el {{ formatDate(publicPendingPlayer.created_at) }}
              </p>
            </div>
            <div class="w-16 h-16 rounded-2xl bg-yellow-500/20 flex items-center justify-center">
              <span class="text-3xl">⏳</span>
            </div>
          </div>

          <div class="grid md:grid-cols-2 gap-6">
            <!-- Category -->
            <div class="p-6 rounded-xl bg-surface border border-border-subtle">
              <p class="text-size-4 font-regular text-foreground-subtle mb-2">Categoría</p>
              <p class="text-size-3 font-semibold text-foreground">
                {{ publicPendingPlayer.category?.name || 'No seleccionada' }}
              </p>
              <p v-if="publicPendingPlayer.category?.description" class="text-size-4 font-regular text-foreground-muted mt-2">
                {{ publicPendingPlayer.category.description }}
              </p>
            </div>

            <!-- Email -->
            <div class="p-6 rounded-xl bg-surface border border-border-subtle">
              <p class="text-size-4 font-regular text-foreground-subtle mb-2">Correo Electrónico</p>
              <p class="text-size-3 font-semibold text-foreground">
                {{ publicPendingPlayer.email || 'No proporcionado' }}
              </p>
            </div>
          </div>

          <!-- Status Info -->
          <div class="mt-6">
            <div class="p-6 rounded-xl bg-surface border border-border-subtle">
              <p class="text-size-4 font-regular text-foreground-subtle mb-2">Estado</p>
              <p class="text-size-3 font-semibold text-foreground">
                {{ getStatusLabel(publicPendingPlayer.status) }}
              </p>
              <p class="text-size-4 font-regular text-foreground-muted mt-2">
                Este jugador aún no ha completado su registro en la plataforma
              </p>
            </div>
          </div>

          <!-- Info Message -->
          <div class="mt-8 pt-8 border-t border-border-subtle">
            <div class="p-6 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
              <div class="flex items-start gap-4">
                <div class="w-8 h-8 rounded-xl bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                  <span class="text-xl">ℹ️</span>
                </div>
                <div>
                  <h3 class="text-size-3 font-semibold text-foreground mb-2">Jugador Pendiente</h3>
                  <p class="text-size-4 font-regular text-foreground-muted">
                    Este jugador ha sido invitado a un partido pero aún no ha completado su registro. 
                    Una vez que se registre, podrás ver su perfil completo con estadísticas y puntuación ELO.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: []
})

const route = useRoute()
const playerId = route.params.id as string

const { publicPlayer, publicLoading, publicError, fetchPublicPlayer } = usePlayer()
const { publicPendingPlayer, publicPendingLoading, publicPendingError, fetchPublicPendingPlayer } = usePendingPlayers()

// Ranking and match history data
const rankingPosition = ref<any>(null)
const rankingLoading = ref(false)
const matchHistory = ref<any[]>([])
const matchHistoryLoading = ref(false)
const activeTab = ref<'ranking' | 'matches'>('ranking')

const canGoBack = computed(() => {
  // Check if we can go back (browser history)
  return typeof window !== 'undefined' && window.history.length > 1
})

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

  // Load match history (only last 20 matches for other players' profiles)
  matchHistoryLoading.value = true
  try {
    const response = await $fetch<{
      success: boolean
      matches: any[]
    }>(`/api/players/${playerId}/matches`, {
      query: { limit: 20 }
    }).catch(() => ({ success: false, matches: [] }))
    
    if (response.success) {
      matchHistory.value = response.matches
    }
  } catch (err) {
    console.error('Error loading match history:', err)
  } finally {
    matchHistoryLoading.value = false
  }
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
  return date.toLocaleDateString('es-ES', {
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
    scheduled: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    active: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
    completed: 'bg-green-500/20 text-green-400 border border-green-500/30',
    cancelled: 'bg-red-500/20 text-red-400 border border-red-500/30'
  }
  return classes[status] || 'bg-surface border border-border-subtle text-foreground-muted'
}

onMounted(async () => {
  await loadProfile()
})
</script>

