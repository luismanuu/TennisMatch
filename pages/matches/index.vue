<template>
  <div class="min-h-screen">
    <!-- Navigation -->
    <AppNavigation />
    
    <!-- Additional action button for this page -->
    <div class="fixed top-16 left-0 right-0 z-40 border-b border-border-subtle bg-background/80 backdrop-blur-xl">
      <div class="container-wide px-6 py-3">
        <div class="flex justify-end">
          <NuxtLink 
            v-if="isAuthenticated"
            to="/matches/new" 
            class="btn-primary text-size-4 !py-2 !px-4"
          >
            Programar Partido
          </NuxtLink>
        </div>
      </div>
    </div>

    <div class="h-16"></div>
    <div v-if="isAuthenticated" class="h-12"></div>

    <div class="section-padding">
      <div class="container-medium px-6">
        <!-- Header -->
        <div class="text-center mb-12">
          <h1 class="text-size-1 font-semibold text-foreground mb-4">
            Partidos
          </h1>
          <p class="text-size-3 font-regular text-foreground-muted">
            Gestiona tus partidos programados, en curso y completados
          </p>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="glass-card-elevated p-12 text-center">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
          <p class="text-size-4 font-regular text-foreground-muted mt-4">Cargando partidos...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="glass-card-elevated p-8">
          <div class="flex items-center gap-4 mb-4">
            <div class="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
              <span class="text-2xl">⚠️</span>
            </div>
            <div>
              <h3 class="text-size-2 font-semibold text-foreground mb-1">Error</h3>
              <p class="text-size-4 font-regular text-foreground-muted">{{ error.message }}</p>
            </div>
          </div>
          <button @click="loadMatches" class="btn-primary text-size-4">
            Reintentar
          </button>
        </div>

        <!-- Status Filter -->
        <div v-if="matches.length > 0" class="mb-6 flex gap-3 flex-wrap justify-center">
          <button
            @click="statusFilter = null"
            :class="[
              'px-4 py-2 rounded-xl text-size-4 font-semibold transition-all',
              statusFilter === null
                ? 'bg-accent text-foreground'
                : 'bg-surface border border-border-subtle text-foreground-muted hover:border-accent/50'
            ]"
          >
            Todos
          </button>
          <button
            @click="statusFilter = 'scheduled'"
            :class="[
              'px-4 py-2 rounded-xl text-size-4 font-semibold transition-all',
              statusFilter === 'scheduled'
                ? 'bg-accent text-foreground'
                : 'bg-surface border border-border-subtle text-foreground-muted hover:border-accent/50'
            ]"
          >
            Programados
          </button>
          <button
            @click="statusFilter = 'active'"
            :class="[
              'px-4 py-2 rounded-xl text-size-4 font-semibold transition-all',
              statusFilter === 'active'
                ? 'bg-accent text-foreground'
                : 'bg-surface border border-border-subtle text-foreground-muted hover:border-accent/50'
            ]"
          >
            En Curso
          </button>
          <button
            @click="statusFilter = 'completed'"
            :class="[
              'px-4 py-2 rounded-xl text-size-4 font-semibold transition-all',
              statusFilter === 'completed'
                ? 'bg-accent text-foreground'
                : 'bg-surface border border-border-subtle text-foreground-muted hover:border-accent/50'
            ]"
          >
            Completados
          </button>
        </div>

        <!-- Matches List -->
        <div v-if="filteredMatches.length > 0" class="space-y-4">
          <div 
            v-for="match in filteredMatches" 
            :key="match.id"
            class="glass-card-elevated p-6 hover-lift cursor-pointer"
            @click="navigateTo(`/matches/${match.id}`)"
          >
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <!-- Players -->
              <div class="flex-1">
                <div class="flex items-center gap-4 flex-wrap mb-2">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-accent-subtle flex items-center justify-center">
                      <span class="text-lg">🎾</span>
                    </div>
                    <div>
                      <p class="text-size-3 font-semibold text-foreground">
                        {{ match.player1?.name || 'Jugador 1' }}
                      </p>
                      <p v-if="match.player1?.category" class="text-size-4 font-regular text-foreground-muted">
                        {{ match.player1.category.name }}
                      </p>
                    </div>
                  </div>

                  <div class="text-size-2 font-semibold text-foreground-muted">vs</div>

                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-accent-subtle flex items-center justify-center">
                      <span class="text-lg">🎾</span>
                    </div>
                    <div>
                      <p class="text-size-3 font-semibold text-foreground">
                        {{ match.player2?.name || match.pending_player2?.name || 'Jugador 2' }}
                      </p>
                      <p v-if="match.player2?.category || match.pending_player2?.category" class="text-size-4 font-regular text-foreground-muted">
                        {{ match.player2?.category?.name || match.pending_player2?.category?.name }}
                      </p>
                      <p v-if="match.pending_player2" class="text-size-4 font-regular text-red-400">
                        (Pendiente de registro)
                      </p>
                    </div>
                  </div>
                </div>
                
                <!-- Status Badge -->
                <div class="mt-2">
                  <span
                    :class="[
                      'px-3 py-1 rounded-full text-size-4 font-semibold inline-block',
                      getStatusBadgeClass(match.status)
                    ]"
                  >
                    {{ getStatusLabel(match.status) }}
                  </span>
                </div>
              </div>

              <!-- Match Details -->
              <div class="flex flex-col md:items-end gap-2">
                <div v-if="match.score" class="flex items-center gap-4">
                  <div class="text-center">
                    <p class="text-size-4 font-regular text-foreground-subtle mb-1">Resultado</p>
                    <p class="text-size-2 font-semibold text-foreground">{{ match.score }}</p>
                  </div>
                  <div v-if="match.winner" class="text-center">
                    <p class="text-size-4 font-regular text-foreground-subtle mb-1">Ganador</p>
                    <p class="text-size-3 font-semibold text-accent">{{ match.winner.name }}</p>
                  </div>
                </div>
                <div v-else-if="match.status === 'active' && match.score_proposed_by" class="text-center">
                  <p class="text-size-4 font-regular text-foreground-subtle mb-1">Puntuación Propuesta</p>
                  <p class="text-size-3 font-semibold text-yellow-400">{{ match.score }}</p>
                </div>
                <div class="flex items-center gap-4 text-size-4 font-regular text-foreground-muted">
                  <span>{{ formatDate(match.status === 'completed' && match.played_at ? match.played_at : match.scheduled_at) }}</span>
                  <span v-if="match.location">•</span>
                  <span v-if="match.location">{{ match.location }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="glass-card-elevated p-12 text-center">
          <div class="w-20 h-20 rounded-2xl bg-accent-subtle flex items-center justify-center mx-auto mb-6">
            <span class="text-4xl">🎾</span>
          </div>
          <h2 class="text-size-2 font-semibold text-foreground mb-4">
            {{ statusFilter ? `No hay partidos ${getStatusLabel(statusFilter).toLowerCase()}` : 'No hay partidos' }}
          </h2>
          <p class="text-size-4 font-regular text-foreground-muted mb-8 max-w-md mx-auto">
            {{ statusFilter ? 'Intenta cambiar el filtro para ver otros partidos.' : 'Sé el primero en programar un partido en la plataforma.' }}
          </p>
          <NuxtLink 
            v-if="isAuthenticated && !statusFilter"
            to="/matches/new" 
            class="btn-primary text-size-3 inline-flex items-center"
          >
            Programar Primer Partido
            <svg class="w-5 h-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
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
const { isAuthenticated } = useAuthState()

const { matches, loading, error, fetchMatches } = useMatches()

const statusFilter = ref<string | null>(null)

const filteredMatches = computed(() => {
  if (!statusFilter.value) return matches.value
  return matches.value.filter(m => m.status === statusFilter.value)
})

const loadMatches = async () => {
  await fetchMatches()
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    scheduled: 'Programado',
    active: 'En Curso',
    completed: 'Completado',
    cancelled: 'Cancelado'
  }
  return labels[status] || status
}

const getStatusBadgeClass = (status: string) => {
  const classes: Record<string, string> = {
    scheduled: 'bg-blue-500/20 text-blue-400 border border-blue-500/50',
    active: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50',
    completed: 'bg-green-500/20 text-green-400 border border-green-500/50',
    cancelled: 'bg-red-500/20 text-red-400 border border-red-500/50'
  }
  return classes[status] || 'bg-surface border border-border-subtle text-foreground-muted'
}

onMounted(async () => {
  await loadMatches()
})
</script>

