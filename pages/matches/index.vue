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
    
    <!-- Additional action button for this page -->
    <div class="fixed top-16 left-0 right-0 z-40 border-b border-border-subtle bg-background/80 backdrop-blur-xl">
      <div class="container-wide px-6 py-3">
        <div class="flex justify-end">
          <NuxtLink 
            v-if="isAuthenticated"
            to="/matches/new" 
            class="btn-primary text-size-4 !py-2 !px-4 group"
          >
            <Icon name="heroicons:plus" class="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
            Programar Partido
          </NuxtLink>
        </div>
      </div>
    </div>

    <div class="h-16"></div>
    <div v-if="isAuthenticated" class="h-12"></div>

    <div class="section-padding relative z-10">
      <div class="container-medium px-6">
        <!-- Header -->
        <div class="text-center mb-12 animate-fade-up">
          <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-subtle/30 border border-accent/30 backdrop-blur-sm mb-6">
            <Icon name="heroicons:calendar" class="w-4 h-4 text-accent" />
            <span class="text-size-4 font-semibold text-accent">Partidos</span>
          </div>
          <h1 class="text-size-1 font-semibold text-foreground mb-4">
            Tus Partidos
          </h1>
          <p class="text-size-3 font-regular text-foreground-muted">
            Gestiona tus partidos programados, en curso y completados
          </p>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="glass-card-elevated p-12 text-center animate-fade-in-scale">
          <div class="w-16 h-16 rounded-full bg-accent-subtle flex items-center justify-center mx-auto mb-6">
            <Icon name="heroicons:arrow-path" class="w-8 h-8 text-accent animate-spin" />
          </div>
          <p class="text-size-3 font-regular text-foreground-muted">Cargando partidos...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="glass-card-elevated p-10 max-w-md mx-auto animate-fade-in-scale">
          <div class="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
            <Icon name="heroicons:exclamation-triangle" class="w-10 h-10 text-red-400" />
          </div>
          <h3 class="text-size-2 font-semibold text-foreground mb-3 text-center">Error</h3>
          <p class="text-size-4 font-regular text-foreground-muted mb-6 text-center">{{ error.message }}</p>
          <button @click="loadMatches" class="btn-primary text-size-3 w-full justify-center group">
            <Icon name="heroicons:arrow-path" class="w-5 h-5 mr-2 group-hover:rotate-180 transition-transform duration-500" />
            Reintentar
          </button>
        </div>

        <!-- Status Filter -->
        <div v-if="!loading && !error && matches.length > 0" class="mb-8 flex gap-3 flex-wrap justify-center animate-fade-up animate-delay-1">
          <button
            @click="statusFilter = null"
            :class="[
              'px-4 py-2 rounded-full text-size-4 font-semibold transition-all flex items-center gap-2',
              statusFilter === null
                ? 'bg-accent text-background border-2 border-accent'
                : 'bg-surface border-2 border-border-subtle text-foreground-muted hover:border-accent/50 hover:bg-surface-elevated'
            ]"
          >
            <Icon name="heroicons:squares-2x2" class="w-4 h-4" />
            Todos
          </button>
          <button
            @click="statusFilter = 'pending'"
            :class="[
              'px-4 py-2 rounded-full text-size-4 font-semibold transition-all flex items-center gap-2',
              statusFilter === 'pending'
                ? 'bg-orange-500/20 text-orange-400 border-2 border-orange-500/50 backdrop-blur-sm'
                : 'bg-surface border-2 border-border-subtle text-foreground-muted hover:border-orange-500/50 hover:bg-surface-elevated'
            ]"
          >
            <Icon name="heroicons:bell-alert" class="w-4 h-4" />
            Pendientes
          </button>
          <button
            @click="statusFilter = 'scheduled'"
            :class="[
              'px-4 py-2 rounded-full text-size-4 font-semibold transition-all flex items-center gap-2',
              statusFilter === 'scheduled'
                ? 'bg-blue-500/20 text-blue-400 border-2 border-blue-500/50 backdrop-blur-sm'
                : 'bg-surface border-2 border-border-subtle text-foreground-muted hover:border-blue-500/50 hover:bg-surface-elevated'
            ]"
          >
            <Icon name="heroicons:calendar" class="w-4 h-4" />
            Programados
          </button>
          <button
            @click="statusFilter = 'active'"
            :class="[
              'px-4 py-2 rounded-full text-size-4 font-semibold transition-all flex items-center gap-2',
              statusFilter === 'active'
                ? 'bg-yellow-500/20 text-yellow-400 border-2 border-yellow-500/50 backdrop-blur-sm'
                : 'bg-surface border-2 border-border-subtle text-foreground-muted hover:border-yellow-500/50 hover:bg-surface-elevated'
            ]"
          >
            <Icon name="heroicons:play-circle" class="w-4 h-4" />
            En Curso
          </button>
          <button
            @click="statusFilter = 'completed'"
            :class="[
              'px-4 py-2 rounded-full text-size-4 font-semibold transition-all flex items-center gap-2',
              statusFilter === 'completed'
                ? 'bg-green-500/20 text-green-400 border-2 border-green-500/50 backdrop-blur-sm'
                : 'bg-surface border-2 border-border-subtle text-foreground-muted hover:border-green-500/50 hover:bg-surface-elevated'
            ]"
          >
            <Icon name="heroicons:check-circle" class="w-4 h-4" />
            Completados
          </button>
          <button
            @click="statusFilter = 'cancelled'"
            :class="[
              'px-4 py-2 rounded-full text-size-4 font-semibold transition-all flex items-center gap-2',
              statusFilter === 'cancelled'
                ? 'bg-red-500/20 text-red-400 border-2 border-red-500/50 backdrop-blur-sm'
                : 'bg-surface border-2 border-border-subtle text-foreground-muted hover:border-red-500/50 hover:bg-surface-elevated'
            ]"
          >
            <Icon name="heroicons:x-circle" class="w-4 h-4" />
            Cancelados
          </button>
        </div>

        <!-- Matches List -->
        <div v-if="!loading && !error && paginatedFilteredMatches.length > 0" class="space-y-4">
          <div 
            v-for="(match, index) in paginatedFilteredMatches" 
            :key="match.id"
            class="glass-card-elevated p-6 md:p-8 hover-lift cursor-pointer animate-fade-up"
            :class="getMatchCardClass(match)"
            :style="{ animationDelay: `${(index + 2) * 0.1}s` }"
            @click="navigateTo(`/matches/${match.id}`)"
          >
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <!-- Players -->
              <div class="flex-1">
                <div class="flex items-center gap-6 mb-4">
                  <!-- Player 1 -->
                  <div class="flex items-center gap-3">
                    <div :class="['w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0', getPlayerIconClasses(match, match.player1_id)]">
                      <span class="text-xl font-bold">
                        {{ getPlayerInitials(match.player1?.name || 'Jugador 1') }}
                      </span>
                    </div>
                    <div>
                      <div v-if="match.player1" class="mb-1">
                        <NuxtLink
                          :to="`/players/${match.player1.id}`"
                          @click.stop
                          class="text-size-2 font-semibold text-foreground hover:text-accent hover:underline transition-all cursor-pointer block"
                        >
                          {{ match.player1.name }}
                        </NuxtLink>
                        <span 
                          v-if="match.player1.status === 'deleted'"
                          class="mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-600 border border-red-500/30"
                        >
                          Eliminado
                        </span>
                      </div>
                      <p v-else class="text-size-2 font-semibold text-foreground mb-1">
                        Jugador 1
                      </p>
                      <div v-if="match.player1?.category" class="px-2 py-1 rounded-full bg-surface border border-border-subtle inline-block">
                        <p class="text-size-4 font-regular text-foreground-muted">
                          {{ match.player1.category.name }}
                        </p>
                      </div>
                    </div>
                  </div>

                  <!-- VS Divider -->
                  <div class="flex flex-col items-center">
                    <div class="w-12 h-12 rounded-full bg-surface border-2 border-border-subtle flex items-center justify-center">
                      <span class="text-size-3 font-bold text-foreground-muted">VS</span>
                    </div>
                  </div>

                  <!-- Player 2 -->
                  <div class="flex items-center gap-3">
                    <div :class="['w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0', getPlayerIconClasses(match, match.player2_id)]">
                      <span class="text-xl font-bold">
                        {{ getPlayerInitials(match.player2?.name || match.pending_player2?.name || 'Jugador 2') }}
                      </span>
                    </div>
                    <div>
                      <div v-if="match.player2" class="mb-1">
                        <NuxtLink
                          :to="`/players/${match.player2.id}`"
                          @click.stop
                          class="text-size-2 font-semibold text-foreground hover:text-accent-secondary hover:underline transition-all cursor-pointer block"
                        >
                          {{ match.player2.name }}
                        </NuxtLink>
                        <span 
                          v-if="match.player2.status === 'deleted'"
                          class="mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-600 border border-red-500/30"
                        >
                          Eliminado
                        </span>
                      </div>
                      <NuxtLink
                        v-else-if="match.pending_player2"
                        :to="`/players/${match.pending_player2.id}`"
                        @click.stop
                        class="text-size-2 font-semibold text-foreground hover:text-accent-secondary hover:underline transition-all cursor-pointer block mb-1"
                      >
                        {{ match.pending_player2.name }}
                      </NuxtLink>
                      <p v-else class="text-size-2 font-semibold text-foreground mb-1">
                        Jugador 2
                      </p>
                      <div v-if="match.player2?.category || match.pending_player2?.category" class="px-2 py-1 rounded-full bg-surface border border-border-subtle inline-block mb-1">
                        <p class="text-size-4 font-regular text-foreground-muted">
                          {{ match.player2?.category?.name || match.pending_player2?.category?.name }}
                        </p>
                      </div>
                      <div v-if="match.pending_player2" class="px-2 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30 inline-block">
                        <p class="text-size-4 font-semibold text-yellow-400">
                          Pendiente
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <!-- Status Badge and Date -->
                <div class="flex items-center gap-4 flex-wrap">
                  <MatchTournamentBadge :match="match" />
                  <div class="flex items-center gap-2 px-3 py-1 rounded-full border backdrop-blur-sm" :class="getStatusBadgeClass(match.status, match.scheduled_at)">
                    <Icon :name="getStatusIcon(match.status)" class="w-4 h-4" />
                    <span class="text-size-4 font-semibold">{{ getStatusLabel(match.status, match.scheduled_at) }}</span>
                  </div>
                  <!-- Only show date if it exists (to avoid showing "Sin agendar" twice) -->
                  <div v-if="(match.status === 'completed' && match.played_at) || (match.status !== 'completed' && match.scheduled_at)" class="flex items-center gap-2 text-foreground-muted">
                    <Icon name="heroicons:calendar" class="w-4 h-4" />
                    <span class="text-size-4">{{ formatDate(match.status === 'completed' && match.played_at ? match.played_at : match.scheduled_at) }}</span>
                  </div>
                  <div v-if="match.location" class="flex items-center gap-2 text-foreground-muted">
                    <Icon name="heroicons:map-pin" class="w-4 h-4" />
                    <span class="text-size-4">{{ match.location }}</span>
                  </div>
                </div>
              </div>

              <!-- Match Details -->
              <div class="flex flex-col md:items-end gap-4 md:min-w-[200px]">
                <!-- Show result only if score has been approved (completed match or score_approved_by exists) -->
                <div v-if="match.score && (match.status === 'completed' || match.score_approved_by)" class="text-center md:text-right">
                  <div class="p-4 rounded-xl bg-gradient-to-br from-accent-subtle/30 to-accent-subtle/10 border border-accent/30">
                    <div class="flex items-center gap-2 mb-2 justify-center md:justify-end">
                      <Icon name="heroicons:trophy" class="w-5 h-5 text-accent" />
                      <p class="text-size-4 font-semibold text-foreground-muted">Resultado</p>
                    </div>
                    <p class="text-size-2 font-bold text-foreground mb-2">{{ match.score }}</p>
                    <div v-if="match.winner" class="flex items-center gap-2 justify-center md:justify-end">
                      <span class="text-size-4 text-foreground-muted">Ganador:</span>
                      <NuxtLink
                        :to="`/players/${match.winner.id}`"
                        @click.stop
                        class="text-size-4 font-semibold text-accent hover:underline transition-all"
                      >
                        {{ match.winner.name }}
                      </NuxtLink>
                    </div>
                  </div>
                </div>
                <!-- Show proposed score if active match has proposed score but not approved yet -->
                <div v-else-if="match.status === 'active' && match.score_proposed_by && !match.score_approved_by" class="text-center md:text-right">
                  <div class="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
                    <div class="flex items-center gap-2 mb-2 justify-center md:justify-end">
                      <Icon name="heroicons:clock" class="w-5 h-5 text-yellow-400" />
                      <p class="text-size-4 font-semibold text-foreground-muted">Puntuación Propuesta</p>
                    </div>
                    <p class="text-size-2 font-bold text-yellow-400">{{ match.score }}</p>
                  </div>
                </div>
                <div v-else class="flex items-center gap-2 text-foreground-muted justify-center md:justify-end">
                  <Icon name="heroicons:arrow-right" class="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  <span class="text-size-4">Ver detalles</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div v-if="!loading && !error && totalFilteredPages > 1" class="flex items-center justify-center gap-4 mt-8 animate-fade-up">
          <button
            @click="currentPage = Math.max(1, currentPage - 1); if (!statusFilter) loadMatches(currentPage)"
            :disabled="currentPage === 1"
            class="px-4 py-2 rounded-xl border-2 border-border-subtle bg-surface text-foreground-muted hover:border-accent hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            <Icon name="heroicons:chevron-left" class="w-4 h-4" />
            Anterior
          </button>
          <div class="flex items-center gap-2">
            <span class="text-size-4 text-foreground-muted">Página</span>
            <span class="text-size-3 font-semibold text-foreground">{{ currentPage }}</span>
            <span class="text-size-4 text-foreground-muted">de</span>
            <span class="text-size-3 font-semibold text-foreground">{{ totalFilteredPages }}</span>
          </div>
          <button
            @click="currentPage = Math.min(totalFilteredPages, currentPage + 1); if (!statusFilter) loadMatches(currentPage)"
            :disabled="currentPage >= totalFilteredPages"
            class="px-4 py-2 rounded-xl border-2 border-border-subtle bg-surface text-foreground-muted hover:border-accent hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            Siguiente
            <Icon name="heroicons:chevron-right" class="w-4 h-4" />
          </button>
        </div>

        <!-- Empty State -->
        <div v-if="!loading && !error && paginatedFilteredMatches.length === 0" class="glass-card-elevated p-12 text-center max-w-md mx-auto animate-fade-in-scale">
          <div class="w-24 h-24 rounded-2xl bg-gradient-to-br from-accent-subtle to-accent-subtle/50 border-2 border-accent/30 flex items-center justify-center mx-auto mb-6">
            <Icon name="heroicons:calendar-x" class="w-12 h-12 text-accent" />
          </div>
          <h2 class="text-size-2 font-semibold text-foreground mb-4">
            {{ statusFilter ? `No hay partidos ${getStatusLabel(statusFilter).toLowerCase()}` : 'No hay partidos' }}
          </h2>
          <p class="text-size-4 font-regular text-foreground-muted mb-8 max-w-md mx-auto leading-relaxed">
            {{ statusFilter ? 'Intenta cambiar el filtro para ver otros partidos.' : 'Sé el primero en programar un partido en la plataforma.' }}
          </p>
          <NuxtLink 
            v-if="isAuthenticated && !statusFilter"
            to="/matches/new" 
            class="btn-primary text-size-3 inline-flex items-center group"
          >
            <Icon name="heroicons:plus" class="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
            Programar Primer Partido
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: []
})

// Use shared auth state composable for consistent behavior
const { isAuthenticated, isLoaded, userId } = useAuthState()
const { player, fetchPlayer } = usePlayer()

const { matches, pagination, loading, error, fetchMatches } = useMatches()

const route = useRoute()
const statusFilter = ref<string | null>(null)
const currentPage = ref(1)
const pageSize = 10

// Check for query parameter to set initial filter
onMounted(() => {
  if (route.query.filter === 'pending') {
    statusFilter.value = 'pending'
  }
})

const filteredMatches = computed(() => {
  let filtered = matches.value
  
  // Apply status filter
  if (statusFilter.value === 'pending') {
    // Show matches with any pending action
    filtered = filtered.filter(m => {
      // Match proposal pending acceptance
      const hasPendingProposal = m.match_proposed_by && !m.match_accepted_by && !m.match_rejected_by
      
      // Score proposal pending approval
      const hasPendingScore = m.score_proposed_by && !m.score_approved_by
      
      // Schedule proposal pending approval
      const hasPendingSchedule = m.schedule_proposed_by && !m.schedule_approved_by && !m.schedule_rejected_by
      
      // Reschedule proposal pending approval
      const hasPendingReschedule = m.reschedule_proposed_by && !m.reschedule_approved_by && !m.reschedule_rejected_by
      
      // Acceptance change pending approval
      const hasPendingAcceptanceChange = m.acceptance_proposed_scheduled_at && !m.acceptance_change_approved_by && !m.acceptance_change_rejected_by
      
      return hasPendingProposal || hasPendingScore || hasPendingSchedule || hasPendingReschedule || hasPendingAcceptanceChange
    })
  } else if (statusFilter.value === 'cancelled') {
    filtered = filtered.filter(m => m.status === 'cancelled')
  } else if (!statusFilter.value) {
    filtered = filtered.filter(m => m.status !== 'cancelled')
  } else {
    filtered = filtered.filter(m => m.status === statusFilter.value)
  }
  
  // Apply pagination if no filter is active
  if (!statusFilter.value) {
    const start = (currentPage.value - 1) * pageSize
    const end = start + pageSize
    return filtered.slice(start, end)
  }
  
  // If filter is active, show all filtered results (no pagination)
  return filtered
})

const paginatedFilteredMatches = computed(() => {
  if (statusFilter.value) {
    // When filtered, calculate pagination from filtered results
    const start = (currentPage.value - 1) * pageSize
    const end = start + pageSize
    return filteredMatches.value.slice(start, end)
  }
  return filteredMatches.value
})

const totalFilteredPages = computed(() => {
  if (statusFilter.value) {
    return Math.ceil(filteredMatches.value.length / pageSize)
  }
  return pagination.value?.totalPages || 1
})

const loadMatches = async (page: number = 1) => {
  if (isLoaded.value && userId.value) {
    // If there's a filter, load all matches (with high limit) for frontend filtering
    // Otherwise, use pagination
    const limit = statusFilter.value ? 1000 : pageSize
    await fetchMatches(userId.value, page, limit)
    currentPage.value = page
  }
}

// Determine if current user won the match
const didUserWin = (match: Match) => {
  if (!match.winner_id || !player.value) return null
  // Check if the winner is the current player
  return match.winner_id === player.value.id
}

// Get match card border color based on result
const getMatchCardClass = (match: Match) => {
  if (match.status === 'completed' && match.winner_id && player.value) {
    const won = didUserWin(match)
    if (won === true) {
      return 'border-l-4 border-green-500'
    } else if (won === false) {
      return 'border-l-4 border-red-500'
    }
  }
  return ''
}

// Get player icon classes based on match result
const getPlayerIconClasses = (match: Match, playerId: string | null) => {
  if (!playerId) {
    // Default colors for players without ID
    return 'bg-gradient-to-br from-accent/20 to-accent/5 border-2 border-accent/30 text-accent'
  }
  
  // For completed matches, show green for winner, red for loser
  if (match.status === 'completed' && match.winner_id) {
    if (match.winner_id === playerId) {
      // Winner: green
      return 'bg-gradient-to-br from-green-500/20 to-green-500/5 border-2 border-green-500/50 text-green-400'
    } else {
      // Loser: red
      return 'bg-gradient-to-br from-red-500/20 to-red-500/5 border-2 border-red-500/50 text-red-400'
    }
  }
  
  // Default colors for non-completed matches
  if (match.player1_id === playerId) {
    return 'bg-gradient-to-br from-accent/20 to-accent/5 border-2 border-accent/30 text-accent'
  } else {
    return 'bg-gradient-to-br from-accent-secondary/20 to-accent-secondary/5 border-2 border-accent-secondary/30 text-accent-secondary'
  }
}

const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return 'Sin agendar'
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return 'Fecha inválida'
  return date.toLocaleDateString('es-ES', {
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
  // Si está scheduled pero sin fecha, usar estilo amarillo
  if (status === 'scheduled' && !scheduledAt) {
    return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
  }
  const classes: Record<string, string> = {
    scheduled: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    active: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    completed: 'bg-green-500/10 text-green-400 border-green-500/30',
    cancelled: 'bg-red-500/10 text-red-400 border-red-500/30'
  }
  return classes[status] || 'bg-surface border border-border-subtle text-foreground-muted'
}

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

onMounted(async () => {
  if (isLoaded.value && userId.value) {
    // Load player data to determine match results
    if (!player.value?.id) {
      await fetchPlayer(userId.value)
    }
    await loadMatches(1)
  }
})

watch([isLoaded, userId], async () => {
  if (isLoaded.value && userId.value) {
    await loadMatches(1)
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
</script>

