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
                <div class="text-size-1 font-semibold text-gradient-static mb-1">-</div>
                <div class="text-size-4 font-regular text-foreground-muted">Partidos</div>
              </div>
              <div class="text-center p-4 rounded-xl bg-surface border border-border-subtle">
                <div class="text-size-1 font-semibold text-gradient-static mb-1">-</div>
                <div class="text-size-4 font-regular text-foreground-muted">Victorias</div>
              </div>
              <div class="text-center p-4 rounded-xl bg-surface border border-border-subtle">
                <div class="text-size-1 font-semibold text-gradient-static mb-1">-</div>
                <div class="text-size-4 font-regular text-foreground-muted">Win Rate</div>
              </div>
            </div>
            <p class="text-size-4 font-regular text-foreground-muted mt-4 text-center">
              Las estadísticas detalladas estarán disponibles próximamente
            </p>
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

const canGoBack = computed(() => {
  // Check if we can go back (browser history)
  return typeof window !== 'undefined' && window.history.length > 1
})

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('es-ES', {
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
    }
  }
}

onMounted(async () => {
  await loadProfile()
})
</script>

