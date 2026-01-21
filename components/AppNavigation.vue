<template>
  <ClientOnly>
    <nav class="fixed top-0 left-0 right-0 z-50 border-b border-border-subtle bg-background/80 backdrop-blur-xl">
      <div class="container-wide px-6">
        <div class="flex justify-between items-center h-16">
          <!-- Mobile Menu Button (Left Side) -->
          <div class="flex items-center gap-3">
            <MobileNav 
              v-if="isAuthenticated"
              :is-open="mobileMenuOpen"
              :current-path="route.path"
              :is-organizer="isOrganizer"
              :notification-count="unreadCount"
              @toggle="mobileMenuOpen = !mobileMenuOpen"
              @close="mobileMenuOpen = false"
            />
            
            <!-- Logo -->
            <NuxtLink to="/" class="flex items-center gap-3 group">
              <div class="relative w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center hover-bounce overflow-hidden border-2 border-accent/30 shadow-lg shadow-accent/20">
                <span class="text-lg relative z-10">🎾</span>
                <div class="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent"></div>
              </div>
              <span class="text-size-3 font-semibold text-foreground group-hover:text-accent transition-colors">
                Tenis Ecuador
              </span>
            </NuxtLink>
          </div>

          <!-- Nav Actions -->
          <div class="flex items-center gap-2 overflow-x-auto -mx-6 px-6 nav-scroll">
            <!-- Show authenticated navigation if signed in (stable once authenticated) -->
            <!-- Desktop Navigation (hidden on mobile) -->
            <template v-if="isAuthenticated" class="desktop-nav">
              <NuxtLink 
                to="/"
                :class="[
                  'hidden md:flex items-center gap-2 px-4 py-2 rounded-xl text-size-4 font-regular transition-all group flex-shrink-0',
                  isDashboard 
                    ? 'bg-accent-subtle/30 text-foreground border border-accent/30' 
                    : 'text-foreground-muted hover:text-foreground hover:bg-surface-elevated'
                ]"
              >
                <Icon name="heroicons:squares-2x2" :class="['w-4 h-4 transition-transform', isDashboard ? 'text-accent' : 'group-hover:scale-110']" />
                <span class="hidden lg:inline">Dashboard</span>
              </NuxtLink>
              <NuxtLink 
                to="/matches" 
                :class="[
                  'hidden md:flex items-center gap-2 px-4 py-2 rounded-xl text-size-4 font-regular transition-all group flex-shrink-0',
                  isMatchesPage
                    ? 'bg-accent-subtle/30 text-foreground border border-accent/30'
                    : 'text-foreground-muted hover:text-foreground hover:bg-surface-elevated'
                ]"
              >
                <Icon name="heroicons:calendar" :class="['w-4 h-4 transition-transform', isMatchesPage ? 'text-accent' : 'group-hover:scale-110']" />
                <span class="hidden lg:inline">Partidos</span>
              </NuxtLink>
              <NuxtLink 
                to="/my-ranking" 
                :class="[
                  'hidden md:flex items-center gap-2 px-4 py-2 rounded-xl text-size-4 font-regular transition-all group flex-shrink-0',
                  isMyRankingPage
                    ? 'bg-accent-subtle/30 text-foreground border border-accent/30'
                    : 'text-foreground-muted hover:text-foreground hover:bg-surface-elevated'
                ]"
              >
                <Icon name="heroicons:chart-bar-square" :class="['w-4 h-4 transition-transform', isMyRankingPage ? 'text-accent' : 'group-hover:scale-110']" />
                <span class="hidden lg:inline">Mi Ranking</span>
              </NuxtLink>
              <NuxtLink 
                to="/leaderboard" 
                :class="[
                  'hidden md:flex items-center gap-2 px-4 py-2 rounded-xl text-size-4 font-regular transition-all group flex-shrink-0',
                  isLeaderboardPage
                    ? 'bg-accent-subtle/30 text-foreground border border-accent/30'
                    : 'text-foreground-muted hover:text-foreground hover:bg-surface-elevated'
                ]"
              >
                <Icon name="heroicons:trophy" :class="['w-4 h-4 transition-transform', isLeaderboardPage ? 'text-accent' : 'group-hover:scale-110']" />
                <span class="hidden lg:inline">Leaderboard</span>
              </NuxtLink>
              <!-- Organizer Tournaments Link (only for organizers) -->
              <NuxtLink 
                v-if="isOrganizer"
                to="/organizer/tournaments" 
                :class="[
                  'hidden md:flex items-center gap-2 px-4 py-2 rounded-xl text-size-4 font-regular transition-all group flex-shrink-0',
                  isOrganizerTournamentsPage
                    ? 'bg-accent-subtle/30 text-foreground border border-accent/30'
                    : 'text-foreground-muted hover:text-foreground hover:bg-surface-elevated'
                ]"
              >
                <Icon name="heroicons:trophy" :class="['w-4 h-4 transition-transform', isOrganizerTournamentsPage ? 'text-accent' : 'group-hover:scale-110']" />
                <span class="hidden lg:inline">Mis Torneos</span>
              </NuxtLink>
              <NuxtLink 
                to="/profile" 
                :class="[
                  'hidden md:flex items-center gap-2 px-4 py-2 rounded-xl text-size-4 font-regular transition-all group flex-shrink-0',
                  isProfilePage
                    ? 'bg-accent-subtle/30 text-foreground border border-accent/30'
                    : 'text-foreground-muted hover:text-foreground hover:bg-surface-elevated'
                ]"
              >
                <Icon name="heroicons:user-circle" :class="['w-4 h-4 transition-transform', isProfilePage ? 'text-accent' : 'group-hover:scale-110']" />
                <span class="hidden lg:inline">Mi Perfil</span>
              </NuxtLink>
              <NuxtLink 
                to="/tournaments" 
                :class="[
                  'hidden md:flex items-center gap-2 px-4 py-2 rounded-xl text-size-4 font-regular transition-all group flex-shrink-0',
                  isTournamentsPage
                    ? 'bg-accent-subtle/30 text-foreground border border-accent/30'
                    : 'text-foreground-muted hover:text-foreground hover:bg-surface-elevated'
                ]"
              >
                <Icon name="heroicons:trophy" :class="['w-4 h-4 transition-transform', isTournamentsPage ? 'text-accent' : 'group-hover:scale-110']" />
                <span class="hidden lg:inline">Torneos</span>
              </NuxtLink>
              
              <!-- Notification Bell -->
              <NuxtLink
                to="/matches?filter=pending"
                class="relative flex items-center justify-center p-2 rounded-xl text-foreground-muted hover:text-foreground hover:bg-surface-elevated transition-all group flex-shrink-0"
                :title="unreadCount > 0 ? `${unreadCount} notificaciones sin leer` : 'Notificaciones'"
              >
                <Icon 
                  :name="unreadCount > 0 ? 'heroicons:bell-alert' : 'heroicons:bell'" 
                  class="w-6 h-6 transition-transform group-hover:scale-110" 
                />
                <!-- Badge for unread count -->
                <span 
                  v-if="unreadCount > 0" 
                  class="absolute -top-1 -right-1 flex items-center justify-center min-w-[1.25rem] h-5 px-1 bg-accent text-white text-xs font-bold rounded-full border-2 border-background"
                >
                  {{ unreadCount > 9 ? '9+' : unreadCount }}
                </span>
              </NuxtLink>
              
              <SignOutButton>
                <button class="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl text-size-4 font-regular text-foreground-muted hover:text-foreground hover:bg-surface-elevated transition-all group">
                  <Icon name="heroicons:arrow-right-on-rectangle" class="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span class="hidden lg:inline">Cerrar Sesión</span>
                </button>
              </SignOutButton>
            </template>
            <!-- Show guest navigation if not authenticated (only show after auth is loaded) -->
            <template v-else-if="authLoaded">
              <NuxtLink 
                to="/sign-in" 
                class="flex items-center gap-2 px-3 py-2 rounded-xl text-size-4 font-regular text-foreground-muted hover:text-foreground hover:bg-surface-elevated transition-all group flex-shrink-0"
              >
                <Icon name="heroicons:arrow-right-on-rectangle" class="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span class="hidden sm:inline">Iniciar Sesión</span>
              </NuxtLink>
              <NuxtLink 
                to="/sign-up" 
                class="btn-primary text-size-4 !py-2 !px-3 sm:!px-4 group flex-shrink-0"
              >
                <Icon name="heroicons:sparkles" class="w-4 h-4 mr-1 sm:mr-2 group-hover:scale-110 transition-transform" />
                <span class="hidden sm:inline">Comenzar Gratis</span>
                <span class="sm:hidden">Comenzar</span>
              </NuxtLink>
            </template>
            <!-- Show minimal loading state only during initial auth load -->
            <div v-else class="flex items-center gap-4">
              <div class="w-20 h-6 bg-surface rounded animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    </nav>
    <template #fallback>
      <nav class="fixed top-0 left-0 right-0 z-50 border-b border-border-subtle bg-background/80 backdrop-blur-xl">
        <div class="container-wide px-6">
          <div class="flex justify-between items-center h-16">
            <NuxtLink to="/" class="flex items-center gap-3 group">
              <div class="relative w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center hover-bounce overflow-hidden border-2 border-accent/30 shadow-lg shadow-accent/20">
                <span class="text-lg relative z-10">🎾</span>
                <div class="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent"></div>
              </div>
              <span class="text-size-3 font-semibold text-foreground">
                Tenis Ecuador
              </span>
            </NuxtLink>
            <div class="flex items-center gap-4">
              <div class="w-20 h-6 bg-surface rounded animate-pulse"></div>
            </div>
          </div>
        </div>
      </nav>
    </template>
  </ClientOnly>
</template>

<script setup lang="ts">
// Use shared auth state composable for consistent behavior
const { isAuthenticated, authLoaded, user } = useAuthState()
const { isOrganizer } = useOrganizer()
const route = useRoute()

// Notifications - only need unreadCount for badge
const { unreadCount } = useNotifications()

const mobileMenuOpen = ref(false)

// Helpers to check current page
const isDashboard = computed(() => route.path === '/')
const isMatchesPage = computed(() => route.path.startsWith('/matches'))
const isTournamentsPage = computed(() => route.path.startsWith('/tournaments') && !route.path.startsWith('/organizer/tournaments'))
const isMyRankingPage = computed(() => route.path.startsWith('/my-ranking'))
const isLeaderboardPage = computed(() => route.path.startsWith('/leaderboard'))
const isProfilePage = computed(() => route.path.startsWith('/profile'))
const isOrganizerTournamentsPage = computed(() => route.path.startsWith('/organizer/tournaments'))

// Debug: Log organizer status in development
if (process.dev) {
  watch([isOrganizer, user], ([organizer, userData]) => {
    console.log('[Navigation] Organizer status:', {
      isOrganizer: organizer,
      hasUser: !!userData,
      role: userData?.publicMetadata?.role,
      publicMetadata: userData?.publicMetadata
    })
  }, { immediate: true })
}
</script>

<style scoped>
.nav-scroll {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.nav-scroll::-webkit-scrollbar {
  display: none;
}
</style>

