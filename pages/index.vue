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

    <!-- Spacer for fixed nav -->
    <div class="h-16"></div>

    <!-- Authenticated User Dashboard -->
    <div v-if="isAuthenticated" class="section-padding relative z-10">
      <div class="container-medium px-6">
        <!-- Welcome Header -->
        <div class="text-center mb-16 animate-fade-up">
          <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-subtle/30 border border-accent/30 backdrop-blur-sm mb-6">
            <Icon name="heroicons:trophy" class="w-4 h-4 text-accent" />
            <span class="text-size-4 font-semibold text-accent">Dashboard Activo</span>
          </div>
          <h1 class="text-size-1 font-semibold text-foreground mb-4">
            ¡Bienvenido de vuelta<span v-if="player?.name">, {{ player.name.split(' ')[0] }}</span>!
          </h1>
          <p class="text-size-3 font-regular text-foreground-muted max-w-xl mx-auto">
            Gestiona tus partidos, torneos y sigue tu progreso en la comunidad de tenis
          </p>
        </div>

        <!-- Dashboard Cards -->
        <div class="grid md:grid-cols-2 gap-6">
          <!-- Profile Card -->
          <div class="glass-card-elevated p-8 hover-lift animate-fade-up animate-delay-1">
            <div class="flex items-start gap-4 mb-6">
              <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 border-2 border-accent/30 flex items-center justify-center flex-shrink-0">
                <span v-if="player?.name" class="text-2xl font-bold text-accent">
                  {{ getPlayerInitials(player.name) }}
                </span>
                <Icon v-else name="heroicons:user" class="w-8 h-8 text-accent" />
              </div>
              <div class="flex-1 min-w-0">
                <h3 class="text-size-2 font-semibold text-foreground mb-1">Tu Perfil</h3>
                <p class="text-size-4 font-regular text-foreground-muted">Información de tu cuenta</p>
              </div>
              <NuxtLink to="/profile" class="btn-secondary text-size-4 !py-2 !px-4 flex-shrink-0 group">
                <Icon name="heroicons:arrow-right" class="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </NuxtLink>
            </div>
            <div class="space-y-3" v-if="user">
              <div class="p-4 rounded-xl bg-gradient-to-br from-surface to-surface-elevated border border-border-subtle hover:border-accent/30 transition-all">
                <div class="flex items-center gap-3 mb-2">
                  <Icon name="heroicons:envelope" class="w-4 h-4 text-foreground-muted" />
                  <p class="text-size-4 font-semibold text-foreground-muted">Email</p>
                </div>
                <p class="text-size-3 font-regular text-foreground">{{ user?.primaryEmailAddress?.emailAddress }}</p>
              </div>
              <div class="p-4 rounded-xl bg-gradient-to-br from-surface to-surface-elevated border border-border-subtle hover:border-accent/30 transition-all">
                <div class="flex items-center gap-3 mb-2">
                  <Icon name="heroicons:user-circle" class="w-4 h-4 text-foreground-muted" />
                  <p class="text-size-4 font-semibold text-foreground-muted">Nombre</p>
                </div>
                <p class="text-size-3 font-regular text-foreground">{{ user?.fullName || player?.name || 'No configurado' }}</p>
              </div>
              <div v-if="player?.phone_number" class="p-4 rounded-xl bg-gradient-to-br from-surface to-surface-elevated border border-border-subtle hover:border-accent/30 transition-all">
                <div class="flex items-center gap-3 mb-2">
                  <Icon name="heroicons:phone" class="w-4 h-4 text-foreground-muted" />
                  <p class="text-size-4 font-semibold text-foreground-muted">Teléfono</p>
                </div>
                <p class="text-size-3 font-regular text-foreground">{{ player.phone_number }}</p>
              </div>
              <div v-if="player?.category" class="p-4 rounded-xl bg-gradient-to-br from-surface to-surface-elevated border border-border-subtle hover:border-accent/30 transition-all">
                <div class="flex items-center gap-3 mb-2">
                  <Icon name="heroicons:star" class="w-4 h-4 text-foreground-muted" />
                  <p class="text-size-4 font-semibold text-foreground-muted">Categoría</p>
                </div>
                <p class="text-size-3 font-semibold text-foreground">{{ player.category.name }}</p>
                <p v-if="player.category.description" class="text-size-4 font-regular text-foreground-muted mt-1">
                  {{ player.category.description }}
                </p>
              </div>
              <div v-else class="p-4 rounded-xl bg-accent-subtle/30 border border-accent/30 animate-fade-in-scale">
                <div class="flex items-center gap-3 mb-2">
                  <Icon name="heroicons:exclamation-triangle" class="w-5 h-5 text-accent" />
                  <p class="text-size-4 font-semibold text-foreground">Perfil incompleto</p>
                </div>
                <p class="text-size-4 font-regular text-foreground-muted mb-3">
                  Completa tu perfil para comenzar a jugar
                </p>
                <NuxtLink to="/onboarding" class="btn-primary text-size-4 !py-2 !px-4 inline-flex items-center group">
                  <span>Completar Perfil</span>
                  <Icon name="heroicons:arrow-right" class="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </NuxtLink>
              </div>
            </div>
          </div>

          <!-- Features Card -->
          <div class="glass-card-elevated p-8 hover-lift animate-fade-up animate-delay-2">
            <div class="flex items-start gap-4 mb-6">
              <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-secondary/20 to-accent-secondary/5 border-2 border-accent-secondary/30 flex items-center justify-center flex-shrink-0">
                <Icon name="heroicons:bolt" class="w-8 h-8 text-accent-secondary" />
              </div>
              <div>
                <h3 class="text-size-2 font-semibold text-foreground mb-1">Acciones Rápidas</h3>
                <p class="text-size-4 font-regular text-foreground-muted">Lo que puedes hacer</p>
              </div>
            </div>
            <ul class="space-y-3">
              <NuxtLink 
                to="/matches/new"
                class="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br from-surface to-surface-elevated border border-border-subtle hover:border-accent/50 hover:bg-surface-elevated cursor-pointer group transition-all hover-lift"
              >
                <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <Icon name="heroicons:plus" class="w-6 h-6 text-background" />
                </div>
                <div class="flex-1">
                  <span class="text-size-3 font-semibold text-foreground group-hover:text-accent transition-colors block">
                    Registrar Partido
                  </span>
                  <span class="text-size-4 font-regular text-foreground-muted">
                    Programa un nuevo encuentro
                  </span>
                </div>
                <Icon name="heroicons:chevron-right" class="w-5 h-5 text-foreground-muted group-hover:text-accent group-hover:translate-x-1 transition-all" />
              </NuxtLink>
              <NuxtLink 
                to="/matches"
                class="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br from-surface to-surface-elevated border border-border-subtle hover:border-accent/50 hover:bg-surface-elevated cursor-pointer group transition-all hover-lift"
              >
                <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-secondary to-accent-secondary/80 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <Icon name="heroicons:calendar" class="w-6 h-6 text-background" />
                </div>
                <div class="flex-1">
                  <span class="text-size-3 font-semibold text-foreground group-hover:text-accent-secondary transition-colors block">
                    Ver Partidos
                  </span>
                  <span class="text-size-4 font-regular text-foreground-muted">
                    Historial y próximos encuentros
                  </span>
                </div>
                <Icon name="heroicons:chevron-right" class="w-5 h-5 text-foreground-muted group-hover:text-accent-secondary group-hover:translate-x-1 transition-all" />
              </NuxtLink>
              <li 
                v-for="(feature, index) in dashboardFeatures" 
                :key="index" 
                class="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br from-surface to-surface-elevated border border-border-subtle hover:border-accent/50 hover:bg-surface-elevated cursor-pointer group transition-all hover-lift"
              >
                <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-subtle to-accent-subtle/50 border border-accent/30 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <Icon name="heroicons:check-circle" class="w-6 h-6 text-accent" />
                </div>
                <div class="flex-1">
                  <span class="text-size-3 font-semibold text-foreground group-hover:text-accent transition-colors block">
                    {{ feature }}
                  </span>
                </div>
                <Icon name="heroicons:chevron-right" class="w-5 h-5 text-foreground-muted group-hover:text-accent group-hover:translate-x-1 transition-all" />
              </li>
            </ul>
          </div>
        </div>

        <!-- Stats Preview -->
        <div class="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-up animate-delay-3">
          <div 
            v-for="(stat, index) in stats" 
            :key="stat.label" 
            class="glass-card-elevated p-6 text-center hover-lift"
            :style="{ animationDelay: `${(index + 3) * 0.1}s` }"
          >
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-subtle to-accent-subtle/50 border border-accent/30 flex items-center justify-center mx-auto mb-3">
              <Icon :name="stat.icon" class="w-6 h-6 text-accent" />
            </div>
            <div class="text-size-1 font-semibold text-gradient-static mb-2">{{ stat.value }}</div>
            <div class="text-size-4 font-regular text-foreground-muted">{{ stat.label }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Guest Landing Page -->
    <div v-else>
      <!-- Hero Section -->
      <section class="section-padding relative overflow-hidden">
        <div class="container-medium px-6">
          <div class="text-center">
            <!-- Badge -->
            <div class="mb-8">
              <span class="inline-flex items-center gap-2 badge badge-accent">
                <span class="animate-tennis-bounce">🎾</span>
                <span>La #1 plataforma de tenis en Ecuador</span>
              </span>
            </div>

            <!-- Main Headline -->
            <h1 class="text-size-1 font-semibold text-foreground mb-6">
              Lleva tu juego al
              <span class="text-gradient"> siguiente nivel</span>
            </h1>

            <!-- Subheadline -->
            <p class="text-size-2 font-regular text-foreground-muted mb-8 max-w-2xl mx-auto">
              La plataforma definitiva para jugadores amateur. Registra partidos, 
              compite en torneos y sigue tu evolución con el sistema ELO.
            </p>

            <!-- CTA Buttons -->
            <div class="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <NuxtLink to="/sign-up" class="btn-primary text-size-3 w-full sm:w-auto">
                Comenzar Gratis
                <svg class="w-5 h-5 ml-2 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </NuxtLink>
              <NuxtLink to="/sign-in" class="btn-secondary text-size-3 w-full sm:w-auto">
                Ya tengo cuenta
              </NuxtLink>
            </div>

            <!-- Social Proof -->
            <div class="flex flex-wrap items-center justify-center gap-8 text-foreground-subtle">
              <div class="flex items-center gap-2">
                <div class="flex -space-x-2">
                  <div class="w-8 h-8 rounded-full bg-accent-subtle border-2 border-background"></div>
                  <div class="w-8 h-8 rounded-full bg-accent-secondary-muted border-2 border-background"></div>
                  <div class="w-8 h-8 rounded-full bg-surface border-2 border-background"></div>
                </div>
                <span class="text-size-4">+500 jugadores activos</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-accent">★★★★★</span>
                <span class="text-size-4">4.9/5 valoración</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Decorative gradient line -->
        <div class="gradient-line w-full max-w-md mx-auto mt-16 opacity-50"></div>
      </section>

      <!-- Features Section -->
      <section class="py-24 bg-surface">
        <div class="max-w-6xl mx-auto px-6">
          <h2 class="text-3xl font-bold text-white text-center mb-12">
            Características Principales
          </h2>
          <div class="grid md:grid-cols-3 gap-8">
            <div class="bg-background p-8 rounded-2xl border border-border">
              <div class="text-4xl mb-4">📊</div>
              <h3 class="text-xl font-semibold text-white mb-2">Sistema ELO</h3>
              <p class="text-gray-400">Rating dinámico basado en tus resultados competitivos.</p>
            </div>
            <div class="bg-background p-8 rounded-2xl border border-border">
              <div class="text-4xl mb-4">🏆</div>
              <h3 class="text-xl font-semibold text-white mb-2">Torneos</h3>
              <p class="text-gray-400">Participa en competencias organizadas automáticamente.</p>
            </div>
            <div class="bg-background p-8 rounded-2xl border border-border">
              <div class="text-4xl mb-4">📝</div>
              <h3 class="text-xl font-semibold text-white mb-2">Registro de Partidos</h3>
              <p class="text-gray-400">Guarda el historial completo de tus encuentros.</p>
            </div>
          </div>
        </div>
      </section>

      <!-- How It Works Section -->
      <section class="py-24">
        <div class="max-w-4xl mx-auto px-6 text-center">
          <h2 class="text-3xl font-bold text-white mb-12">Cómo Funciona</h2>
          <div class="grid md:grid-cols-3 gap-8">
            <div>
              <div class="w-12 h-12 rounded-full bg-accent text-black font-bold text-xl flex items-center justify-center mx-auto mb-4">1</div>
              <h3 class="text-xl font-semibold text-white mb-2">Crea tu cuenta</h3>
              <p class="text-gray-400">Regístrate en menos de 30 segundos</p>
            </div>
            <div>
              <div class="w-12 h-12 rounded-full bg-accent text-black font-bold text-xl flex items-center justify-center mx-auto mb-4">2</div>
              <h3 class="text-xl font-semibold text-white mb-2">Completa tu perfil</h3>
              <p class="text-gray-400">Agrega tu nivel de juego</p>
            </div>
            <div>
              <div class="w-12 h-12 rounded-full bg-accent text-black font-bold text-xl flex items-center justify-center mx-auto mb-4">3</div>
              <h3 class="text-xl font-semibold text-white mb-2">Comienza a competir</h3>
              <p class="text-gray-400">Registra partidos y únete a torneos</p>
            </div>
          </div>
        </div>
      </section>

      <!-- CTA Section -->
      <section class="section-padding">
        <div class="container-narrow px-6">
          <div class="glass-card-elevated p-12 text-center relative overflow-hidden">
            <!-- Background Glow -->
            <div class="absolute inset-0 bg-gradient-to-br from-accent-subtle to-transparent opacity-50"></div>
            
            <div class="relative z-10">
              <h2 class="text-size-1 font-semibold text-foreground mb-4">
                ¿Listo para competir?
              </h2>
              <p class="text-size-3 font-regular text-foreground-muted mb-8 max-w-md mx-auto">
                Únete a la comunidad de tenistas más grande de Ecuador. Es gratis y solo toma 30 segundos.
              </p>
              <NuxtLink to="/sign-up" class="btn-primary text-size-3 inline-flex items-center">
                Crear cuenta gratis
                <svg class="w-5 h-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </NuxtLink>
            </div>
          </div>
        </div>
      </section>

      <!-- Footer -->
      <footer class="border-t border-border py-8">
        <div class="container-wide px-6">
          <div class="flex flex-col md:flex-row justify-between items-center gap-4">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                <span class="text-sm">🎾</span>
              </div>
              <span class="text-size-4 font-regular text-foreground-muted">
                © 2024 Tenis Ecuador. Todos los derechos reservados.
              </span>
            </div>
            <div class="flex items-center gap-6 text-size-4 text-foreground-muted">
              <a href="#" class="hover:text-foreground transition-colors">Términos</a>
              <a href="#" class="hover:text-foreground transition-colors">Privacidad</a>
              <a href="#" class="hover:text-foreground transition-colors">Contacto</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: []
})

// Use shared auth state composable for consistent behavior
const { isLoaded, isAuthenticated, userId, user, isSignedIn } = useAuthState()

const { player, fetchPlayer } = usePlayer()

// Debug: Log auth state in development
if (process.dev && process.client) {
  watchEffect(() => {
    console.log('[Auth State]', {
      isLoaded: isLoaded.value,
      isAuthenticated: isAuthenticated.value,
      hasUser: !!user.value,
      userId: userId.value
    })
  })
}

// Load player profile if user is signed in
const loadPlayerProfile = async () => {
  if (!isLoaded.value || !isSignedIn.value || !userId.value) {
    return
  }
  
  try {
    await fetchPlayer(userId.value)
  } catch (error) {
    // Silently handle errors - profile might not exist yet
    // This is expected for new users
  }
}

// Computed property to safely track when profile should be loaded
const shouldLoadProfile = computed(() => {
  return !!(isLoaded.value && isSignedIn.value && userId.value && !player.value)
})

// Watch for auth state changes and load profile when ready
watch(shouldLoadProfile, async (shouldLoad) => {
  if (shouldLoad) {
    await loadPlayerProfile()
  }
}, { immediate: false })

// Also check on mount in case Clerk is already loaded
onMounted(async () => {
  if (isLoaded.value && userId.value) {
    await loadPlayerProfile()
  }
})

// Dashboard data
const dashboardFeatures = [
  'Seguir tu calificación ELO',
  'Ver y crear torneos',
  'Gestionar tu perfil de jugador'
]

const stats = [
  { value: player.value?.elo || '1,000', label: 'Puntos ELO', icon: 'heroicons:trophy' },
  { value: '0', label: 'Partidos', icon: 'heroicons:calendar' },
  { value: '0', label: 'Victorias', icon: 'heroicons:star' },
  { value: '-', label: 'Win Rate', icon: 'heroicons:chart-bar' }
]

const getPlayerInitials = (name: string) => {
  if (!name) return '?'
  const parts = name.trim().split(' ')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}
</script>
