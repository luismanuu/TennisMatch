<script setup lang="ts">
import { UserProfile } from '@clerk/vue'

definePageMeta({
  middleware: 'auth'
})
</script>

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
          <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-subtle/30 border border-accent/30 backdrop-blur-sm mb-6">
            <Icon name="heroicons:cog-6-tooth" class="w-4 h-4 text-accent" />
            <span class="text-size-4 font-semibold text-accent">Gestion de Cuenta</span>
          </div>
          <h1 class="text-size-1 font-semibold text-foreground mb-4">
            Configuracion de Cuenta
          </h1>
          <p class="text-size-3 font-regular text-foreground-muted">
            Gestiona tu perfil, seguridad y preferencias de cuenta
          </p>
        </div>

        <!-- Back Link -->
        <div class="mb-8 animate-fade-up animate-delay-1">
          <NuxtLink to="/profile" class="inline-flex items-center gap-2 text-size-4 text-foreground-muted hover:text-accent transition-colors group">
            <Icon name="heroicons:arrow-left" class="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Volver a Mi Perfil
          </NuxtLink>
        </div>

        <!-- UserProfile Component Container -->
        <div class="user-profile-page-container animate-fade-up animate-delay-2">
          <ClientOnly>
            <div class="user-profile-wrapper">
              <UserProfile 
                :routing="'hash'"
              />
            </div>
            <template #fallback>
              <div class="glass-card-elevated p-16 text-center">
                <div class="w-16 h-16 rounded-full bg-accent-subtle flex items-center justify-center mx-auto mb-6">
                  <Icon name="heroicons:arrow-path" class="w-8 h-8 text-accent animate-spin" />
                </div>
                <p class="text-size-3 font-regular text-foreground-muted">Cargando configuracion de cuenta...</p>
              </div>
            </template>
          </ClientOnly>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Page container for UserProfile component */
.user-profile-page-container {
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow: 
    0 25px 50px -12px oklch(0 0 0 / 0.25),
    0 0 0 1px var(--border);
}

.user-profile-wrapper {
  width: 100%;
}

/* Override Clerk UserProfile to fit within page container */
.user-profile-page-container :deep(.cl-userProfile-root),
.user-profile-page-container :deep(.cl-rootBox),
.user-profile-page-container :deep(.cl-card),
.user-profile-page-container :deep(.cl-cardBox) {
  border-radius: var(--radius-xl) !important;
}
</style>
