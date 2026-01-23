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
        
        <!-- Pending Actions Section -->
        <div 
          v-if="notificationsCount.total > 0" 
          class="glass-card-elevated p-6 mb-8 border-l-4 border-accent animate-fade-in-scale"
        >
          <div class="flex items-start gap-4">
            <div class="w-12 h-12 rounded-xl bg-accent-subtle/30 border border-accent/30 flex items-center justify-center flex-shrink-0">
              <Icon name="heroicons:bell-alert" class="w-6 h-6 text-accent" />
            </div>
            <div class="flex-1">
              <div class="flex items-center gap-3 mb-2">
                <h3 class="text-size-2 font-semibold text-foreground">Acciones Pendientes</h3>
                <span class="px-2 py-1 rounded-full bg-accent text-white text-xs font-bold">
                  {{ notificationsCount.total }}
                </span>
              </div>
              <p class="text-size-4 font-regular text-foreground-muted mb-4">
                Tienes {{ notificationsCount.total }} {{ notificationsCount.total === 1 ? 'partido que requiere' : 'partidos que requieren' }} tu atención
              </p>
              
              <!-- Quick list of notifications -->
              <div class="space-y-2 mb-4">
                <div 
                  v-for="notification in topNotifications" 
                  :key="notification.id"
                  class="flex items-center gap-3 p-3 rounded-lg bg-surface-elevated hover:bg-surface transition-colors cursor-pointer"
                  @click="navigateToMatch(notification.match_id)"
                >
                  <Icon 
                    :name="getNotificationIcon(notification.type)" 
                    class="w-5 h-5 text-accent flex-shrink-0" 
                  />
                  <p class="text-size-4 font-regular text-foreground flex-1" v-html="getNotificationText(notification)"></p>
                  <Icon name="heroicons:arrow-right" class="w-4 h-4 text-foreground-muted" />
                </div>
              </div>
              
              <NuxtLink 
                to="/matches?filter=pending" 
                class="btn-primary inline-flex items-center gap-2"
              >
                <Icon name="heroicons:eye" class="w-4 h-4" />
                Ver Todos los Partidos Pendientes
              </NuxtLink>
            </div>
          </div>
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
              <!-- Loading state -->
              <div v-if="playerLoading" class="p-4 rounded-xl bg-gradient-to-br from-surface to-surface-elevated border border-border-subtle">
                <div class="flex items-center gap-3">
                  <div class="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                  <p class="text-size-4 font-regular text-foreground-muted">Cargando perfil...</p>
                </div>
              </div>
              <!-- Profile complete -->
              <div v-else-if="player?.category" class="p-4 rounded-xl bg-gradient-to-br from-surface to-surface-elevated border border-border-subtle hover:border-accent/30 transition-all">
                <div class="flex items-center gap-3 mb-2">
                  <Icon name="heroicons:star" class="w-4 h-4 text-foreground-muted" />
                  <p class="text-size-4 font-semibold text-foreground-muted">Categoría</p>
                </div>
                <p class="text-size-3 font-semibold text-foreground">{{ player.category.name }}</p>
                <p v-if="player.category.description" class="text-size-4 font-regular text-foreground-muted mt-1">
                  {{ player.category.description }}
                </p>
              </div>
              <!-- Profile incomplete - only show when NOT loading and player exists but has no category -->
              <div v-else-if="!playerLoading && player && !player.category" class="p-4 rounded-xl bg-accent-subtle/30 border border-accent/30 animate-fade-in-scale">
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
              <!-- Profile doesn't exist yet - only show when NOT loading and no player -->
              <div v-else-if="!playerLoading && !player" class="p-4 rounded-xl bg-accent-subtle/30 border border-accent/30 animate-fade-in-scale">
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
              <!-- Create Tournament (only for organizers) -->
              <NuxtLink 
                v-if="isOrganizer"
                to="/organizer/tournaments"
                class="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br from-surface to-surface-elevated border border-border-subtle hover:border-purple-500/50 hover:bg-surface-elevated cursor-pointer group transition-all hover-lift"
              >
                <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <Icon name="heroicons:trophy" class="w-6 h-6 text-background" />
                </div>
                <div class="flex-1">
                  <span class="text-size-3 font-semibold text-foreground group-hover:text-purple-400 transition-colors block">
                    Crear Torneo
                  </span>
                  <span class="text-size-4 font-regular text-foreground-muted">
                    Organiza un nuevo torneo
                  </span>
                </div>
                <Icon name="heroicons:chevron-right" class="w-5 h-5 text-foreground-muted group-hover:text-purple-400 group-hover:translate-x-1 transition-all" />
              </NuxtLink>
              <NuxtLink 
                to="/matchmaking"
                class="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br from-surface to-surface-elevated border border-border-subtle hover:border-blue-500/50 hover:bg-surface-elevated cursor-pointer group transition-all hover-lift"
              >
                <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <Icon name="heroicons:magnifying-glass" class="w-6 h-6 text-background" />
                </div>
                <div class="flex-1">
                  <span class="text-size-3 font-semibold text-foreground group-hover:text-blue-400 transition-colors block">
                    Busca Partida Competitiva
                  </span>
                  <span class="text-size-4 font-regular text-foreground-muted">
                    Encuentra oponentes de tu nivel
                  </span>
                </div>
                <Icon name="heroicons:chevron-right" class="w-5 h-5 text-foreground-muted group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
              </NuxtLink>
              <NuxtLink 
                to="/matches/new"
                class="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br from-surface to-surface-elevated border border-border-subtle hover:border-green-500/50 hover:bg-surface-elevated cursor-pointer group transition-all hover-lift"
              >
                <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <Icon name="heroicons:plus" class="w-6 h-6 text-background" />
                </div>
                <div class="flex-1">
                  <span class="text-size-3 font-semibold text-foreground group-hover:text-green-400 transition-colors block">
                    Registrar Partido
                  </span>
                  <span class="text-size-4 font-regular text-foreground-muted">
                    Programa un nuevo encuentro
                  </span>
                </div>
                <Icon name="heroicons:chevron-right" class="w-5 h-5 text-foreground-muted group-hover:text-green-400 group-hover:translate-x-1 transition-all" />
              </NuxtLink>
              <NuxtLink 
                to="/matches"
                class="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br from-surface to-surface-elevated border border-border-subtle hover:border-indigo-500/50 hover:bg-surface-elevated cursor-pointer group transition-all hover-lift"
              >
                <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <Icon name="heroicons:calendar" class="w-6 h-6 text-background" />
                </div>
                <div class="flex-1">
                  <span class="text-size-3 font-semibold text-foreground group-hover:text-indigo-400 transition-colors block">
                    Ver Partidos
                  </span>
                  <span class="text-size-4 font-regular text-foreground-muted">
                    Historial y próximos encuentros
                  </span>
                </div>
                <Icon name="heroicons:chevron-right" class="w-5 h-5 text-foreground-muted group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
              </NuxtLink>
              <NuxtLink 
                to="/my-ranking"
                class="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br from-surface to-surface-elevated border border-border-subtle hover:border-accent/50 hover:bg-surface-elevated cursor-pointer group transition-all hover-lift"
              >
                <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <Icon name="heroicons:chart-bar-square" class="w-6 h-6 text-background" />
                </div>
                <div class="flex-1">
                  <span class="text-size-3 font-semibold text-foreground group-hover:text-amber-400 transition-colors block">
                    Ver tu Ranking
                  </span>
                  <span class="text-size-4 font-regular text-foreground-muted">
                    Sigue tu progreso y estadísticas
                  </span>
                </div>
                <Icon name="heroicons:chevron-right" class="w-5 h-5 text-foreground-muted group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
              </NuxtLink>
              <template v-for="(feature, index) in dashboardFeatures" :key="index">
                <NuxtLink
                  v-if="feature === 'Gestionar tu perfil de jugador'"
                  to="/profile"
                  class="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br from-surface to-surface-elevated border border-green-500/30 hover:border-green-500/50 hover:bg-surface-elevated cursor-pointer group transition-all hover-lift"
                >
                  <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <Icon name="heroicons:user-circle" class="w-6 h-6 text-background" />
                  </div>
                  <div class="flex-1">
                    <span class="text-size-3 font-semibold text-foreground group-hover:text-green-400 transition-colors block">
                      {{ feature }}
                    </span>
                  </div>
                  <Icon name="heroicons:chevron-right" class="w-5 h-5 text-foreground-muted group-hover:text-green-400 group-hover:translate-x-1 transition-all" />
                </NuxtLink>
                <NuxtLink
                  v-else-if="feature === 'Ver y crear torneos'"
                  to="/organizer/tournaments"
                  class="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br from-surface to-surface-elevated border border-purple-500/30 hover:border-purple-500/50 hover:bg-surface-elevated cursor-pointer group transition-all hover-lift"
                >
                  <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <Icon name="heroicons:trophy" class="w-6 h-6 text-background" />
                  </div>
                  <div class="flex-1">
                    <span class="text-size-3 font-semibold text-foreground group-hover:text-purple-400 transition-colors block">
                      {{ feature }}
                    </span>
                  </div>
                  <Icon name="heroicons:chevron-right" class="w-5 h-5 text-foreground-muted group-hover:text-purple-400 group-hover:translate-x-1 transition-all" />
                </NuxtLink>
                <li 
                  v-else
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
              </template>
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

        <!-- Estadísticas y Ranking Info -->
        <div class="mt-12 grid md:grid-cols-2 gap-6 animate-fade-up animate-delay-4">
          <!-- Estadísticas Card -->
          <NuxtLink 
            to="/my-ranking"
            class="glass-card-elevated p-6 hover-lift group transition-all"
          >
            <div class="flex items-center gap-4 mb-4">
              <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                <Icon name="heroicons:chart-bar" class="w-6 h-6 text-background" />
              </div>
              <div>
                <h3 class="text-size-3 font-semibold text-foreground group-hover:text-blue-400 transition-colors">
                  Estadísticas
                </h3>
                <p class="text-size-5 text-foreground-muted">Tu rendimiento</p>
              </div>
            </div>
            <p class="text-size-4 text-foreground-muted">
              Visualiza tus estadísticas detalladas, historial de partidas y progreso de ranking
            </p>
          </NuxtLink>

          <!-- Ranking Info Card -->
          <div 
            @click="showRankingInfo = true"
            class="glass-card-elevated p-6 hover-lift group transition-all cursor-pointer"
          >
            <div class="flex items-center gap-4 mb-4">
              <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                <Icon name="heroicons:information-circle" class="w-6 h-6 text-background" />
              </div>
              <div>
                <h3 class="text-size-3 font-semibold text-foreground group-hover:text-accent transition-colors">
                  Ranking Info
                </h3>
                <p class="text-size-5 text-foreground-muted">Sistema de ranking</p>
              </div>
            </div>
            <p class="text-size-4 text-foreground-muted">
              Aprende cómo funciona el sistema de ranking, tiers y cálculo de ELO
            </p>
          </div>
        </div>

        <!-- Ranking System Info Modal -->
        <RankingSystemInfo v-model="showRankingInfo" />
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
              La plataforma definitiva para jugadores amateur. Sistema ELO avanzado, 
              matchmaking inteligente, torneos organizados y rankings en tiempo real.
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
      <section class="section-padding relative z-10">
        <div class="container-medium px-6">
          <div class="text-center mb-16">
            <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-subtle/30 border border-accent/30 backdrop-blur-sm mb-6">
              <Icon name="heroicons:sparkles" class="w-4 h-4 text-accent" />
              <span class="text-size-4 font-semibold text-accent">Características Principales</span>
            </div>
            <h2 class="text-size-1 font-semibold text-foreground mb-4">
              Todo lo que necesitas para competir
            </h2>
            <p class="text-size-3 font-regular text-foreground-muted max-w-2xl mx-auto">
              Una plataforma completa con sistema de ranking, matchmaking inteligente y torneos organizados
            </p>
          </div>
          
          <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <!-- Sistema ELO -->
            <div class="glass-card-elevated p-8 hover-lift group">
              <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 border-2 border-accent/30 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Icon name="heroicons:chart-bar" class="w-8 h-8 text-accent" />
              </div>
              <h3 class="text-size-2 font-semibold text-foreground mb-3">Sistema ELO Avanzado</h3>
              <p class="text-size-4 font-regular text-foreground-muted mb-4">
                Rating dinámico basado en tus resultados competitivos con 7 tiers (Bronze a Grandmaster)
              </p>
              <ul class="space-y-2 text-size-4 text-foreground-muted">
                <li class="flex items-center gap-2">
                  <Icon name="heroicons:check-circle" class="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span>Partidos de colocación iniciales</span>
                </li>
                <li class="flex items-center gap-2">
                  <Icon name="heroicons:check-circle" class="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span>Decay mensual para mantener actividad</span>
                </li>
                <li class="flex items-center gap-2">
                  <Icon name="heroicons:check-circle" class="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span>Historial completo de cambios</span>
                </li>
              </ul>
            </div>

            <!-- Matchmaking -->
            <div class="glass-card-elevated p-8 hover-lift group">
              <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 border-2 border-blue-500/30 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Icon name="heroicons:magnifying-glass" class="w-8 h-8 text-blue-400" />
              </div>
              <h3 class="text-size-2 font-semibold text-foreground mb-3">Matchmaking Inteligente</h3>
              <p class="text-size-4 font-regular text-foreground-muted mb-4">
                Encuentra oponentes perfectos basado en tu nivel, ubicación y actividad reciente
              </p>
              <ul class="space-y-2 text-size-4 text-foreground-muted">
                <li class="flex items-center gap-2">
                  <Icon name="heroicons:check-circle" class="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span>Búsqueda por tier (2 arriba, 1 abajo)</span>
                </li>
                <li class="flex items-center gap-2">
                  <Icon name="heroicons:check-circle" class="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span>Filtrado por ciudad y segmento</span>
                </li>
                <li class="flex items-center gap-2">
                  <Icon name="heroicons:check-circle" class="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span>Límite de 4 partidos/mes por oponente</span>
                </li>
              </ul>
            </div>

            <!-- Torneos -->
            <div class="glass-card-elevated p-8 hover-lift group">
              <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 border-2 border-purple-500/30 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Icon name="heroicons:trophy" class="w-8 h-8 text-purple-400" />
              </div>
              <h3 class="text-size-2 font-semibold text-foreground mb-3">Torneos Organizados</h3>
              <p class="text-size-4 font-regular text-foreground-muted mb-4">
                Participa en competencias estructuradas con brackets automáticos y seguimiento en tiempo real
              </p>
              <ul class="space-y-2 text-size-4 text-foreground-muted">
                <li class="flex items-center gap-2">
                  <Icon name="heroicons:check-circle" class="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span>Brackets automáticos</span>
                </li>
                <li class="flex items-center gap-2">
                  <Icon name="heroicons:check-circle" class="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span>Múltiples fases y grupos</span>
                </li>
                <li class="flex items-center gap-2">
                  <Icon name="heroicons:check-circle" class="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span>Programación inteligente</span>
                </li>
              </ul>
            </div>

            <!-- Partidos Competitivos -->
            <div class="glass-card-elevated p-8 hover-lift group">
              <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500/20 to-green-500/5 border-2 border-green-500/30 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Icon name="heroicons:check-badge" class="w-8 h-8 text-green-400" />
              </div>
              <h3 class="text-size-2 font-semibold text-foreground mb-3">Partidos Competitivos</h3>
              <p class="text-size-4 font-regular text-foreground-muted mb-4">
                Diferencia entre partidos competitivos (afectan ELO) y amistosos (solo registro)
              </p>
              <ul class="space-y-2 text-size-4 text-foreground-muted">
                <li class="flex items-center gap-2">
                  <Icon name="heroicons:check-circle" class="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span>Partidos competitivos afectan ranking</span>
                </li>
                <li class="flex items-center gap-2">
                  <Icon name="heroicons:check-circle" class="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span>Partidos amistosos sin impacto ELO</span>
                </li>
                <li class="flex items-center gap-2">
                  <Icon name="heroicons:check-circle" class="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span>Historial completo de ambos tipos</span>
                </li>
              </ul>
            </div>

            <!-- Leaderboard -->
            <div class="glass-card-elevated p-8 hover-lift group">
              <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 border-2 border-amber-500/30 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Icon name="heroicons:bars-3-bottom-left" class="w-8 h-8 text-amber-400" />
              </div>
              <h3 class="text-size-2 font-semibold text-foreground mb-3">Leaderboards Múltiples</h3>
              <p class="text-size-4 font-regular text-foreground-muted mb-4">
                Rankings globales, por ciudad, segmento y tier para competir en diferentes categorías
              </p>
              <ul class="space-y-2 text-size-4 text-foreground-muted">
                <li class="flex items-center gap-2">
                  <Icon name="heroicons:check-circle" class="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span>Ranking global</span>
                </li>
                <li class="flex items-center gap-2">
                  <Icon name="heroicons:check-circle" class="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span>Ranking por ciudad/segmento</span>
                </li>
                <li class="flex items-center gap-2">
                  <Icon name="heroicons:check-circle" class="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span>Ranking por tier</span>
                </li>
              </ul>
            </div>

            <!-- Perfiles y Estadísticas -->
            <div class="glass-card-elevated p-8 hover-lift group">
              <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 border-2 border-cyan-500/30 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Icon name="heroicons:user-circle" class="w-8 h-8 text-cyan-400" />
              </div>
              <h3 class="text-size-2 font-semibold text-foreground mb-3">Perfiles y Estadísticas</h3>
              <p class="text-size-4 font-regular text-foreground-muted mb-4">
                Perfiles públicos con historial completo, estadísticas detalladas y gráficos de progreso
              </p>
              <ul class="space-y-2 text-size-4 text-foreground-muted">
                <li class="flex items-center gap-2">
                  <Icon name="heroicons:check-circle" class="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span>Historial de partidas competitivas</span>
                </li>
                <li class="flex items-center gap-2">
                  <Icon name="heroicons:check-circle" class="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span>Gráficos de progreso ELO</span>
                </li>
                <li class="flex items-center gap-2">
                  <Icon name="heroicons:check-circle" class="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span>Estadísticas de win rate y rachas</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <!-- Rating Tiers Section -->
      <section class="section-padding bg-surface relative z-10">
        <div class="container-medium px-6">
          <div class="text-center mb-16">
            <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-subtle/30 border border-accent/30 backdrop-blur-sm mb-6">
              <Icon name="heroicons:star" class="w-4 h-4 text-accent" />
              <span class="text-size-4 font-semibold text-accent">Sistema de Tiers</span>
            </div>
            <h2 class="text-size-1 font-semibold text-foreground mb-4">
              Sube de nivel y alcanza nuevos tiers
            </h2>
            <p class="text-size-3 font-regular text-foreground-muted max-w-2xl mx-auto">
              Desde Bronze hasta Grandmaster, cada victoria te acerca más al siguiente nivel
            </p>
          </div>
          
          <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div 
              v-for="tier in ratingTiers" 
              :key="tier.tier"
              class="glass-card p-6 text-center hover-lift group"
            >
              <div 
                class="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center border-2 transition-all group-hover:scale-110"
                :style="{ 
                  backgroundColor: `${tier.color}20`,
                  borderColor: `${tier.color}40`,
                  color: tier.color
                }"
              >
                <Icon name="heroicons:trophy" class="w-8 h-8" />
              </div>
              <h3 class="text-size-2 font-bold mb-2" :style="{ color: tier.color }">
                {{ tier.tier }}
              </h3>
              <p class="text-size-4 text-foreground-muted">
                {{ tier.minElo.toLocaleString() }} - {{ tier.maxElo === Infinity ? '∞' : tier.maxElo.toLocaleString() }} ELO
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- How It Works Section -->
      <section class="section-padding relative z-10">
        <div class="container-medium px-6">
          <div class="text-center mb-16">
            <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-subtle/30 border border-accent/30 backdrop-blur-sm mb-6">
              <Icon name="heroicons:question-mark-circle" class="w-4 h-4 text-accent" />
              <span class="text-size-4 font-semibold text-accent">Cómo Funciona</span>
            </div>
            <h2 class="text-size-1 font-semibold text-foreground mb-4">
              Comienza en 3 simples pasos
            </h2>
            <p class="text-size-3 font-regular text-foreground-muted max-w-2xl mx-auto">
              Únete a la comunidad de tenistas más grande de Ecuador en menos de un minuto
            </p>
          </div>
          
          <div class="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div class="glass-card-elevated p-8 text-center hover-lift">
              <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-accent/80 text-background font-bold text-size-2 flex items-center justify-center mx-auto mb-6">
                1
              </div>
              <h3 class="text-size-2 font-semibold text-foreground mb-3">Crea tu cuenta</h3>
              <p class="text-size-4 font-regular text-foreground-muted mb-4">
                Regístrate en menos de 30 segundos con tu email
              </p>
              <div class="flex items-center justify-center gap-2 text-size-5 text-foreground-muted">
                <Icon name="heroicons:check-circle" class="w-4 h-4 text-green-400" />
                <span>Verificación instantánea</span>
              </div>
            </div>
            <div class="glass-card-elevated p-8 text-center hover-lift">
              <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-secondary to-accent-secondary/80 text-background font-bold text-size-2 flex items-center justify-center mx-auto mb-6">
                2
              </div>
              <h3 class="text-size-2 font-semibold text-foreground mb-3">Completa tu perfil</h3>
              <p class="text-size-4 font-regular text-foreground-muted mb-4">
                Agrega tu ciudad, categoría y nivel de juego
              </p>
              <div class="flex items-center justify-center gap-2 text-size-5 text-foreground-muted">
                <Icon name="heroicons:check-circle" class="w-4 h-4 text-green-400" />
                <span>Configuración rápida</span>
              </div>
            </div>
            <div class="glass-card-elevated p-8 text-center hover-lift">
              <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 text-background font-bold text-size-2 flex items-center justify-center mx-auto mb-6">
                3
              </div>
              <h3 class="text-size-2 font-semibold text-foreground mb-3">Comienza a competir</h3>
              <p class="text-size-4 font-regular text-foreground-muted mb-4">
                Juega 3 partidos de colocación y obtén tu ranking inicial
              </p>
              <div class="flex items-center justify-center gap-2 text-size-5 text-foreground-muted">
                <Icon name="heroicons:check-circle" class="w-4 h-4 text-green-400" />
                <span>Matchmaking automático</span>
              </div>
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

const { player, loading: playerLoading, fetchPlayer } = usePlayer()
const { isOrganizer } = useOrganizer()
const { isAdmin } = useAdmin()

// Notifications for pending actions section
const { notifications, count: notificationsCount } = useNotifications()

// Determine if user is staff (admin or organizer)
const isStaff = computed(() => isAdmin.value || isOrganizer.value)

// Notification helpers for pending actions section
const topNotifications = computed(() => {
  return notifications.value.slice(0, 3)
})

const router = useRouter()

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'match_proposal':
      return 'heroicons:hand-raised'
    case 'match_created':
      return 'heroicons:check-circle'
    case 'score_proposal':
      return 'heroicons:trophy'
    case 'schedule_proposal':
      return 'heroicons:calendar'
    case 'reschedule_proposal':
      return 'heroicons:arrow-path'
    case 'acceptance_change':
      return 'heroicons:pencil-square'
    default:
      return 'heroicons:bell'
  }
}

const getNotificationText = (notification: any) => {
  const metadata = notification.metadata || {}
  
  switch (notification.type) {
    case 'match_proposal':
      return `<strong>${metadata.proposed_by || 'Un jugador'}</strong> te ha propuesto un partido`
    case 'match_created':
      if (metadata.is_tournament) {
        return `Nuevo partido de torneo con <strong>${metadata.with_player || 'otro jugador'}</strong>`
      } else if (metadata.accepted_by) {
        return `<strong>${metadata.accepted_by}</strong> aceptó tu propuesta`
      } else {
        return `Partido confirmado con <strong>${metadata.with_player || 'otro jugador'}</strong>`
      }
    case 'score_proposal':
      return `Se propuso un resultado - requiere tu aprobación`
    case 'schedule_proposal':
      return `Nueva fecha propuesta para el partido`
    case 'reschedule_proposal':
      return `Solicitud de reprogramación del partido`
    case 'acceptance_change':
      return `Aceptado con propuesta de cambio de fecha/ubicación`
    default:
      return 'Nueva notificación sobre tu partido'
  }
}

const navigateToMatch = (matchId: string) => {
  router.push(`/matches/${matchId}`)
}

const getPlayerInitials = (name: string) => {
  if (!name) return '?'
  const parts = name.trim().split(' ').filter(p => p.length > 0)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return (parts[0]?.[0] || '?').toUpperCase()
  return ((parts[0]?.[0] || '') + (parts[parts.length - 1]?.[0] || '')).toUpperCase() || '?'
}

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
  
  // Don't reload if already loading or already loaded
  if (playerLoading.value || player.value) {
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
  return !!(isLoaded.value && isSignedIn.value && userId.value && !player.value && !playerLoading.value)
})

// Watch for auth state changes and load profile when ready
watch(shouldLoadProfile, async (shouldLoad) => {
  if (shouldLoad) {
    await loadPlayerProfile()
  }
}, { immediate: false })

// Also check on mount in case Clerk is already loaded
onMounted(async () => {
  if (isLoaded.value && userId.value && !playerLoading.value) {
    await loadPlayerProfile()
  }
})

// Watch for when player profile loading completes and redirect to onboarding if no profile exists
const route = useRoute()
watch([playerLoading, player, isAuthenticated], async ([loading, currentPlayer, authenticated]) => {
  // Only redirect if:
  // 1. User is authenticated
  // 2. Profile loading is complete (not loading)
  // 3. No player profile exists
  // 4. We're on the home page (not already on onboarding)
  if (authenticated && !loading && !currentPlayer && route.path === '/') {
    // Small delay to avoid race conditions
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Double-check that player still doesn't exist after delay
    if (!player.value && !playerLoading.value) {
      console.log('🔄 No player profile found, redirecting to onboarding')
      await navigateTo('/onboarding', { replace: true })
    }
  }
}, { immediate: false })

// Dashboard data - different features for players vs staff
const dashboardFeatures = computed(() => {
  if (isStaff.value) {
    return [
      'Ver y crear torneos',
      'Gestionar tu perfil de jugador'
    ]
  } else {
    return [
      'Gestionar tu perfil de jugador'
    ]
  }
})

// Stats with real data
const stats = computed(() => {
  const totalMatches = player.value?.total_matches_played || 0
  const elo = player.value?.elo || 1000
  const placementMatches = player.value?.placement_matches_completed || 0
  
  // Calculate win rate and total wins if we have rating history
  let winRate = '-'
  let totalWins = 0
  if (ratingStats.value && ratingStats.value.wins + ratingStats.value.losses > 0) {
    winRate = `${Math.round(ratingStats.value.win_rate)}%`
    totalWins = ratingStats.value.wins || 0
  }
  
  return [
    { value: elo.toLocaleString(), label: 'Puntos ELO', icon: 'heroicons:trophy' },
    { value: totalMatches.toString(), label: 'Partidos', icon: 'heroicons:calendar' },
    { value: totalWins.toString(), label: 'Victorias', icon: 'heroicons:trophy' },
    { value: winRate, label: 'Win Rate', icon: 'heroicons:chart-bar' }
  ]
})

// Rating stats from history
const ratingStats = ref<{ wins: number; losses: number; win_rate: number; peak_elo: number } | null>(null)

// Ranking Info Modal
const showRankingInfo = ref(false)

// Load rating stats if player exists
const loadRatingStats = async () => {
  if (!player.value?.id) return
  
  try {
    const historyResponse = await $fetch<{
      success: boolean
      history: any[]
      stats: { wins: number; losses: number; win_rate: number; total_elo_change: number; peak_elo: number }
    }>(`/api/players/${player.value.id}/rating-history`, {
      query: { limit: 100 }
    })
    
    if (historyResponse?.success && historyResponse.stats) {
      ratingStats.value = historyResponse.stats
    }
  } catch (err) {
    console.error('Failed to load rating stats:', err)
  }
}

// Watch for player changes to load stats
watch(() => player.value?.id, (newId) => {
  if (newId) {
    loadRatingStats()
  }
}, { immediate: true })

// Rating tiers for display
const ratingTiers = [
  { tier: 'Bronze', minElo: 1, maxElo: 1499, color: '#CD7F32' },
  { tier: 'Silver', minElo: 1500, maxElo: 1999, color: '#C0C0C0' },
  { tier: 'Gold', minElo: 2000, maxElo: 2499, color: '#FFD700' },
  { tier: 'Platinum', minElo: 2500, maxElo: 2999, color: '#E5E4E2' },
  { tier: 'Diamond', minElo: 3000, maxElo: 3499, color: '#B9F2FF' },
  { tier: 'Master', minElo: 3500, maxElo: 3999, color: '#9932CC' },
  { tier: 'Grandmaster', minElo: 4000, maxElo: Infinity, color: '#FF4500' },
]
</script>
