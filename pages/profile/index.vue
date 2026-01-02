<template>
  <div class="min-h-screen">
    <!-- Navigation -->
    <AppNavigation />

    <div class="h-16"></div>

    <div class="section-padding">
      <div class="container-medium px-6">
        <!-- Header -->
        <div class="text-center mb-12">
          <h1 class="text-size-1 font-semibold text-foreground mb-4">
            Mi Perfil
          </h1>
          <p class="text-size-3 font-regular text-foreground-muted">
            Gestiona tu información personal y preferencias
          </p>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="glass-card-elevated p-12 text-center">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
          <p class="text-size-4 font-regular text-foreground-muted mt-4">Cargando perfil...</p>
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
          <button @click="loadProfile" class="btn-primary text-size-4">
            Reintentar
          </button>
        </div>

        <!-- Profile Content -->
        <div v-else-if="player" class="glass-card-elevated p-8">
          <div class="flex items-start justify-between mb-8">
            <div>
              <h2 class="text-size-2 font-semibold text-foreground mb-2">{{ player.name }}</h2>
              <p class="text-size-4 font-regular text-foreground-muted">{{ user?.primaryEmailAddress?.emailAddress }}</p>
            </div>
            <NuxtLink to="/profile/edit" class="btn-primary text-size-4 !py-2 !px-4">
              Editar Perfil
            </NuxtLink>
          </div>

          <div class="grid md:grid-cols-2 gap-6">
            <!-- Category -->
            <div class="p-6 rounded-xl bg-surface border border-border-subtle">
              <p class="text-size-4 font-regular text-foreground-subtle mb-2">Categoría</p>
              <p class="text-size-3 font-semibold text-foreground">
                {{ player.category?.name || 'No seleccionada' }}
              </p>
              <p v-if="player.category?.description" class="text-size-4 font-regular text-foreground-muted mt-2">
                {{ player.category.description }}
              </p>
            </div>

            <!-- Phone Number -->
            <div class="p-6 rounded-xl bg-surface border border-border-subtle">
              <p class="text-size-4 font-regular text-foreground-subtle mb-2">Teléfono</p>
              <p class="text-size-3 font-semibold text-foreground">
                {{ player.phone_number || 'No proporcionado' }}
              </p>
            </div>
          </div>

          <!-- ELO Rating -->
          <div class="mt-6">
            <div class="p-6 rounded-xl bg-surface border border-border-subtle">
              <p class="text-size-4 font-regular text-foreground-subtle mb-2">Puntuación ELO</p>
              <p class="text-size-1 font-semibold text-gradient-static">{{ player.elo }}</p>
              <p class="text-size-4 font-regular text-foreground-muted mt-2">
                Tu calificación actual
              </p>
            </div>
          </div>

          <!-- Stats -->
          <div class="mt-8 pt-8 border-t border-border-subtle">
            <h3 class="text-size-3 font-semibold text-foreground mb-4">Estadísticas</h3>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div class="text-center p-4 rounded-xl bg-surface border border-border-subtle">
                <div class="text-size-1 font-semibold text-gradient-static mb-1">{{ player.elo }}</div>
                <div class="text-size-4 font-regular text-foreground-muted">ELO</div>
              </div>
              <div class="text-center p-4 rounded-xl bg-surface border border-border-subtle">
                <div class="text-size-1 font-semibold text-gradient-static mb-1">0</div>
                <div class="text-size-4 font-regular text-foreground-muted">Partidos</div>
              </div>
              <div class="text-center p-4 rounded-xl bg-surface border border-border-subtle">
                <div class="text-size-1 font-semibold text-gradient-static mb-1">0</div>
                <div class="text-size-4 font-regular text-foreground-muted">Victorias</div>
              </div>
              <div class="text-center p-4 rounded-xl bg-surface border border-border-subtle">
                <div class="text-size-1 font-semibold text-gradient-static mb-1">-</div>
                <div class="text-size-4 font-regular text-foreground-muted">Win Rate</div>
              </div>
            </div>
          </div>
        </div>

        <!-- No Profile State -->
        <div v-else class="glass-card-elevated p-12 text-center">
          <div class="w-20 h-20 rounded-2xl bg-accent-subtle flex items-center justify-center mx-auto mb-6">
            <span class="text-4xl">👤</span>
          </div>
          <h2 class="text-size-2 font-semibold text-foreground mb-4">Completa tu perfil</h2>
          <p class="text-size-4 font-regular text-foreground-muted mb-8 max-w-md mx-auto">
            Para comenzar a usar la plataforma, necesitas completar tu perfil de jugador.
          </p>
          <NuxtLink to="/onboarding" class="btn-primary text-size-3 inline-flex items-center">
            Completar Perfil
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
  middleware: 'auth'
})

const auth = useAuth()
const { isLoaded: authLoaded, isSignedIn } = auth
const { isLoaded: userLoaded, user } = useUser()
const { player, loading, error, fetchPlayer } = usePlayer()

const isLoaded = computed(() => authLoaded.value && userLoaded.value)
const userId = computed(() => user.value?.id || null)

const loadProfile = async () => {
  if (userId.value) {
    await fetchPlayer(userId.value)
  }
}

onMounted(async () => {
  if (isLoaded.value && userId.value) {
    await loadProfile()
  }
})

// Computed property to safely track when profile should be loaded
const shouldLoadProfile = computed(() => {
  return !!(isLoaded.value && isSignedIn.value && userId.value && !player.value)
})

// Watch for auth state changes and load profile when ready
watch(shouldLoadProfile, async (shouldLoad) => {
  if (shouldLoad) {
    await loadProfile()
  }
}, { immediate: false })
</script>

