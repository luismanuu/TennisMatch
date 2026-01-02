<template>
  <ClientOnly>
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
          <!-- Show authenticated navigation if signed in (stable once authenticated) -->
          <template v-if="isAuthenticated">
            <NuxtLink 
              to="/"
              :class="[
                'text-size-4 font-regular transition-colors',
                isDashboard ? 'text-foreground font-semibold' : 'text-foreground-muted hover:text-foreground'
              ]"
            >
              Dashboard
            </NuxtLink>
            <NuxtLink 
              to="/matches" 
              class="text-size-4 font-regular text-foreground-muted hover:text-foreground transition-colors"
              active-class="text-foreground font-semibold"
            >
              Partidos
            </NuxtLink>
            <NuxtLink 
              to="/profile" 
              class="text-size-4 font-regular text-foreground-muted hover:text-foreground transition-colors"
              active-class="text-foreground font-semibold"
            >
              Mi Perfil
            </NuxtLink>
            <SignOutButton>
              <button class="text-size-4 font-regular text-foreground-muted hover:text-foreground transition-colors">
                Cerrar Sesión
              </button>
            </SignOutButton>
          </template>
          <!-- Show guest navigation if not authenticated (only show after auth is loaded) -->
          <template v-else-if="authLoaded">
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
              <div class="relative w-10 h-10 rounded-xl bg-accent flex items-center justify-center hover-bounce overflow-hidden">
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

// Helper to check if we're on dashboard
const isDashboard = computed(() => route.path === '/')
</script>

