<template>
  <div class="min-h-screen">
    <!-- Navigation -->
    <nav class="fixed top-0 left-0 right-0 z-50 border-b border-border-subtle bg-background/80 backdrop-blur-xl">
      <div class="container-wide px-6">
        <div class="flex justify-between items-center h-16">
          <!-- Logo -->
          <NuxtLink to="/" class="flex items-center gap-3 group">
            <div class="relative w-10 h-10 rounded-xl bg-accent flex items-center justify-center hover-bounce overflow-hidden">
              <span class="text-lg relative z-10">🎾</span>
              <div class="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent"></div>
            </div>
            <span class="text-size-3 font-semibold text-foreground">
              Tenis Ecuador
            </span>
          </NuxtLink>

          <!-- Nav Actions -->
          <div class="flex items-center gap-4">
            <template v-if="isAuthenticated">
              <NuxtLink 
                to="/profile" 
                class="text-size-4 font-regular text-foreground-muted hover:text-foreground transition-colors"
              >
                Mi Perfil
              </NuxtLink>
              <button
                @click="handleSignOut"
                class="text-size-4 font-regular text-foreground-muted hover:text-foreground transition-colors"
              >
                Cerrar Sesión
              </button>
            </template>
            <template v-else>
              <NuxtLink 
                to="/sign-in" 
                class="text-size-4 font-regular text-foreground-muted hover:text-foreground transition-colors hidden sm:block"
              >
                Iniciar Sesión
              </NuxtLink>
              <NuxtLink 
                to="/sign-up" 
                class="btn-primary text-size-4 !py-2 !px-4"
              >
                Comenzar Gratis
              </NuxtLink>
            </template>
          </div>
        </div>
      </div>
    </nav>

    <!-- Spacer for fixed nav -->
    <div class="h-16"></div>

    <!-- Authenticated User Dashboard -->
    <div v-if="isAuthenticated" class="section-padding">
      <div class="container-medium px-6">
        <!-- Welcome Header -->
        <div class="text-center mb-16">
          <div class="inline-flex items-center gap-2 badge badge-accent mb-6">
            <span>🏆</span>
            <span>Dashboard Activo</span>
          </div>
          <h1 class="text-size-1 font-semibold text-foreground mb-4">
            ¡Bienvenido de vuelta!
          </h1>
          <p class="text-size-3 font-regular text-foreground-muted max-w-xl mx-auto">
            Gestiona tus partidos, torneos y sigue tu progreso en la comunidad de tenis
          </p>
        </div>

        <!-- Dashboard Cards -->
        <div class="grid md:grid-cols-2 gap-6">
          <!-- Profile Card -->
          <div class="glass-card-elevated p-8 hover-lift">
            <div class="flex items-start gap-4 mb-6">
              <div class="w-14 h-14 rounded-2xl bg-accent-subtle flex items-center justify-center">
                <span class="text-2xl">👤</span>
              </div>
              <div class="flex-1">
                <h3 class="text-size-2 font-semibold text-foreground mb-1">Tu Perfil</h3>
                <p class="text-size-4 font-regular text-foreground-muted">Información de tu cuenta</p>
              </div>
              <NuxtLink to="/profile" class="btn-secondary text-size-4 !py-2 !px-4">
                Ver Perfil
              </NuxtLink>
            </div>
            <div class="space-y-4" v-if="user">
              <div class="p-4 rounded-xl bg-surface border border-border-subtle">
                <p class="text-size-4 font-regular text-foreground-subtle mb-1">Email</p>
                <p class="text-size-3 font-regular text-foreground">{{ user?.primaryEmailAddress?.emailAddress }}</p>
              </div>
              <div class="p-4 rounded-xl bg-surface border border-border-subtle">
                <p class="text-size-4 font-regular text-foreground-subtle mb-1">Nombre</p>
                <p class="text-size-3 font-regular text-foreground">{{ user?.fullName || 'No configurado' }}</p>
              </div>
              <div v-if="player" class="p-4 rounded-xl bg-surface border border-border-subtle">
                <p class="text-size-4 font-regular text-foreground-subtle mb-1">Categoría</p>
                <p class="text-size-3 font-regular text-foreground">{{ player.category?.name || 'No seleccionada' }}</p>
              </div>
              <div v-else class="p-4 rounded-xl bg-accent-subtle/50 border border-accent/30">
                <p class="text-size-4 font-regular text-foreground-subtle mb-2">Perfil incompleto</p>
                <NuxtLink to="/onboarding" class="text-size-4 font-semibold text-accent hover:underline">
                  Completa tu perfil →
                </NuxtLink>
              </div>
            </div>
          </div>

          <!-- Features Card -->
          <div class="glass-card-elevated p-8 hover-lift">
            <div class="flex items-start gap-4 mb-6">
              <div class="w-14 h-14 rounded-2xl bg-accent-subtle flex items-center justify-center">
                <span class="text-2xl">⚡</span>
              </div>
              <div>
                <h3 class="text-size-2 font-semibold text-foreground mb-1">Acciones Rápidas</h3>
                <p class="text-size-4 font-regular text-foreground-muted">Lo que puedes hacer</p>
              </div>
            </div>
            <ul class="space-y-3">
              <li v-for="(feature, index) in dashboardFeatures" :key="index" 
                  class="flex items-center gap-4 p-3 rounded-xl bg-surface border border-border-subtle hover-border-glow cursor-pointer group">
                <div class="w-10 h-10 rounded-xl bg-accent flex items-center justify-center flex-shrink-0">
                  <svg class="w-5 h-5 text-background" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span class="text-size-3 font-regular text-foreground group-hover:text-accent transition-colors">
                  {{ feature }}
                </span>
              </li>
            </ul>
          </div>
        </div>

        <!-- Stats Preview -->
        <div class="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div v-for="stat in stats" :key="stat.label" 
               class="glass-card p-6 text-center hover-lift">
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

// Use Clerk composables from @clerk/nuxt
// useAuth provides auth state, useUser provides user data
const { isLoaded: authLoaded, isSignedIn, userId: clerkUserId, signOut } = useAuth()
const { isLoaded: userLoaded, user } = useUser()

// Combined isLoaded - both auth and user must be loaded
const isLoaded = computed(() => authLoaded.value && userLoaded.value)

const { player, fetchPlayer } = usePlayer()

// Debug: Log auth state in development
if (process.dev && process.client) {
  watchEffect(() => {
    console.log('[Auth State]', {
      isLoaded: isLoaded.value,
      authLoaded: authLoaded.value,
      userLoaded: userLoaded.value,
      isSignedIn: isSignedIn.value,
      hasUser: !!user.value,
      userId: clerkUserId.value || user.value?.id
    })
  })
}

const handleSignOut = async () => {
  await signOut()
  await navigateTo('/')
}

// Use userId from useAuth (preferred) or fallback to user.id
const userId = computed(() => clerkUserId.value || user.value?.id || null)

// Computed properties for template conditions (Vue templates auto-unwrap refs)
// Check if refs exist and have values
const isAuthenticated = computed(() => {
  return !!(isLoaded.value && isSignedIn.value && user.value)
})

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
  'Registrar partidos de torneos',
  'Seguir tu calificación ELO',
  'Ver y crear torneos',
  'Gestionar tu perfil de jugador'
]

const stats = [
  { value: '1,247', label: 'Puntos ELO' },
  { value: '23', label: 'Partidos' },
  { value: '15', label: 'Victorias' },
  { value: '65%', label: 'Win Rate' }
]
</script>
