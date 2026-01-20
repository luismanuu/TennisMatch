<template>
  <div class="min-h-[60vh] flex items-center justify-center">
    <div class="glass-card-elevated p-12 max-w-2xl w-full text-center animate-fade-up">
      <!-- Icon -->
      <div class="mb-8 flex justify-center">
        <div class="relative">
          <div class="absolute inset-0 bg-accent/20 rounded-full blur-2xl animate-pulse"></div>
          <div class="relative w-24 h-24 rounded-full bg-accent-subtle/30 border-2 border-accent/30 flex items-center justify-center">
            <Icon name="heroicons:trophy" class="w-12 h-12 text-accent" />
          </div>
        </div>
      </div>

      <!-- Badge -->
      <div class="mb-6 flex justify-center">
        <span class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-subtle/30 text-accent border-2 border-accent/30 text-size-4 font-semibold">
          <Icon name="heroicons:sparkles" class="w-4 h-4" />
          Muy Pronto
        </span>
      </div>

      <!-- Title -->
      <h1 class="text-size-1 font-semibold text-foreground mb-4">
        Torneos Competitivos
      </h1>

      <!-- Subtitle -->
      <p class="text-size-3 font-regular text-foreground-muted mb-8 max-w-lg mx-auto">
        Estamos preparando una experiencia increíble de torneos competitivos para ti. Muy pronto podrás competir, ganar puntos y subir en el ranking.
      </p>

      <!-- Additional Info -->
      <div class="mb-8 p-6 rounded-xl bg-surface border-2 border-border-subtle">
        <p class="text-size-4 font-regular text-foreground-muted">
          Mientras tanto, asegúrate de tener tu perfil completo y prepárate para competir en un ambiente competitivo con sistema de ranking.
        </p>
      </div>

      <!-- CTAs -->
      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <NuxtLink
          to="/profile"
          class="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-accent text-foreground text-size-4 font-semibold hover-lift transition-all"
        >
          <Icon name="heroicons:user-circle" class="w-5 h-5" />
          Completar Perfil
        </NuxtLink>
        <NuxtLink
          to="/matches"
          class="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-surface border-2 border-border-subtle text-foreground text-size-4 font-semibold hover:border-accent hover:text-accent transition-all"
        >
          <Icon name="heroicons:calendar" class="w-5 h-5" />
          Ver Partidos
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// No props needed - this is a self-contained teaser component
</script>
