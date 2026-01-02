<template>
  <ClientOnly>
    <nav class="fixed top-0 left-0 right-0 z-50 border-b border-border-subtle bg-background/80 backdrop-blur-xl">
      <div class="container-wide px-6">
        <div class="flex justify-between items-center h-16">
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

          <!-- Nav Actions -->
          <div class="flex items-center gap-2">
            <!-- Show authenticated navigation if signed in (stable once authenticated) -->
            <template v-if="isAuthenticated">
              <NuxtLink 
                to="/"
                :class="[
                  'flex items-center gap-2 px-4 py-2 rounded-xl text-size-4 font-regular transition-all group',
                  isDashboard 
                    ? 'bg-accent-subtle/30 text-foreground border border-accent/30' 
                    : 'text-foreground-muted hover:text-foreground hover:bg-surface-elevated'
                ]"
              >
                <Icon name="heroicons:squares-2x2" :class="['w-4 h-4 transition-transform', isDashboard ? 'text-accent' : 'group-hover:scale-110']" />
                <span>Dashboard</span>
              </NuxtLink>
              <NuxtLink 
                to="/matches" 
                :class="[
                  'flex items-center gap-2 px-4 py-2 rounded-xl text-size-4 font-regular transition-all group',
                  isMatchesPage
                    ? 'bg-accent-subtle/30 text-foreground border border-accent/30'
                    : 'text-foreground-muted hover:text-foreground hover:bg-surface-elevated'
                ]"
              >
                <Icon name="heroicons:calendar" :class="['w-4 h-4 transition-transform', isMatchesPage ? 'text-accent' : 'group-hover:scale-110']" />
                <span>Partidos</span>
              </NuxtLink>
              <NuxtLink 
                to="/profile" 
                :class="[
                  'flex items-center gap-2 px-4 py-2 rounded-xl text-size-4 font-regular transition-all group',
                  isProfilePage
                    ? 'bg-accent-subtle/30 text-foreground border border-accent/30'
                    : 'text-foreground-muted hover:text-foreground hover:bg-surface-elevated'
                ]"
              >
                <Icon name="heroicons:user-circle" :class="['w-4 h-4 transition-transform', isProfilePage ? 'text-accent' : 'group-hover:scale-110']" />
                <span>Mi Perfil</span>
              </NuxtLink>
              <SignOutButton>
                <button class="flex items-center gap-2 px-4 py-2 rounded-xl text-size-4 font-regular text-foreground-muted hover:text-foreground hover:bg-surface-elevated transition-all group">
                  <Icon name="heroicons:arrow-right-on-rectangle" class="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span class="hidden sm:inline">Cerrar Sesión</span>
                </button>
              </SignOutButton>
            </template>
            <!-- Show guest navigation if not authenticated (only show after auth is loaded) -->
            <template v-else-if="authLoaded">
              <NuxtLink 
                to="/sign-in" 
                class="flex items-center gap-2 px-4 py-2 rounded-xl text-size-4 font-regular text-foreground-muted hover:text-foreground hover:bg-surface-elevated transition-all hidden sm:flex group"
              >
                <Icon name="heroicons:arrow-right-on-rectangle" class="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span>Iniciar Sesión</span>
              </NuxtLink>
              <NuxtLink 
                to="/sign-up" 
                class="btn-primary text-size-4 !py-2 !px-4 group"
              >
                <Icon name="heroicons:sparkles" class="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                Comenzar Gratis
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
const { isAuthenticated, authLoaded } = useAuthState()
const route = useRoute()

// Helpers to check current page
const isDashboard = computed(() => route.path === '/')
const isMatchesPage = computed(() => route.path.startsWith('/matches'))
const isProfilePage = computed(() => route.path.startsWith('/profile'))
</script>

