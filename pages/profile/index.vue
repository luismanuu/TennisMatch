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
            Gestiona tu información personal y preferencias
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

          <!-- Profile Info Grid -->
          <div class="grid md:grid-cols-2 gap-6 mb-8">
            <!-- Category -->
            <div class="p-6 rounded-xl bg-gradient-to-br from-surface to-surface-elevated border border-border-subtle hover:border-accent/30 transition-all hover-lift">
              <div class="flex items-center gap-3 mb-4">
                <div class="w-10 h-10 rounded-lg bg-accent-subtle flex items-center justify-center">
                  <Icon name="heroicons:star" class="w-5 h-5 text-accent" />
                </div>
                <p class="text-size-4 font-semibold text-foreground-muted">Categoría</p>
              </div>
              <p class="text-size-2 font-semibold text-foreground mb-2">
                {{ player.category?.name || 'No seleccionada' }}
              </p>
              <p v-if="player.category?.description" class="text-size-4 font-regular text-foreground-muted">
                {{ player.category.description }}
              </p>
            </div>

            <!-- Phone Number -->
            <div class="p-6 rounded-xl bg-gradient-to-br from-surface to-surface-elevated border border-border-subtle hover:border-accent/30 transition-all hover-lift">
              <div class="flex items-center gap-3 mb-4">
                <div class="w-10 h-10 rounded-lg bg-accent-secondary-muted flex items-center justify-center">
                  <Icon name="heroicons:phone" class="w-5 h-5 text-accent-secondary" />
                </div>
                <p class="text-size-4 font-semibold text-foreground-muted">Teléfono</p>
              </div>
              <p class="text-size-2 font-semibold text-foreground">
                {{ player.phone_number || 'No proporcionado' }}
              </p>
            </div>
          </div>

          <!-- ELO Rating -->
          <div class="mb-8">
            <div class="p-8 rounded-xl bg-gradient-to-br from-accent-subtle/30 to-accent-subtle/10 border border-accent/30 hover-lift">
              <div class="flex items-center gap-3 mb-4">
                <div class="w-12 h-12 rounded-xl bg-accent/20 border border-accent/30 flex items-center justify-center">
                  <Icon name="heroicons:trophy" class="w-6 h-6 text-accent" />
                </div>
                <p class="text-size-3 font-semibold text-foreground">Puntuación ELO</p>
              </div>
              <p class="text-size-1 font-bold text-gradient-static mb-2">{{ player.elo }}</p>
              <p class="text-size-4 font-regular text-foreground-muted">
                Tu calificación actual en el sistema
              </p>
            </div>
          </div>

          <!-- Stats -->
          <div class="pt-8 border-t border-border-subtle">
            <div class="flex items-center gap-3 mb-6">
              <Icon name="heroicons:chart-bar" class="w-6 h-6 text-foreground-muted" />
              <h3 class="text-size-2 font-semibold text-foreground">Estadísticas</h3>
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
                <div class="text-size-1 font-semibold text-gradient-static mb-1">0</div>
                <div class="text-size-4 font-regular text-foreground-muted">Partidos</div>
              </div>
              <div class="text-center p-6 rounded-xl bg-gradient-to-br from-surface to-surface-elevated border border-border-subtle hover:border-accent/30 transition-all hover-lift">
                <div class="w-10 h-10 rounded-lg bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-3">
                  <Icon name="heroicons:star" class="w-5 h-5 text-green-400" />
                </div>
                <div class="text-size-1 font-semibold text-gradient-static mb-1">0</div>
                <div class="text-size-4 font-regular text-foreground-muted">Victorias</div>
              </div>
              <div class="text-center p-6 rounded-xl bg-gradient-to-br from-surface to-surface-elevated border border-border-subtle hover:border-accent/30 transition-all hover-lift">
                <div class="w-10 h-10 rounded-lg bg-accent-subtle flex items-center justify-center mx-auto mb-3">
                  <Icon name="heroicons:chart-bar" class="w-5 h-5 text-accent" />
                </div>
                <div class="text-size-1 font-semibold text-gradient-static mb-1">-</div>
                <div class="text-size-4 font-regular text-foreground-muted">Win Rate</div>
              </div>
            </div>
          </div>
        </div>

        <!-- No Profile State -->
        <div v-else class="glass-card-elevated p-12 text-center max-w-md mx-auto animate-fade-in-scale">
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

const getPlayerInitials = (name: string) => {
  if (!name) return '?'
  const parts = name.trim().split(' ')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}
</script>

