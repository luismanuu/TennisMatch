<template>
  <div class="coming-soon">
    <PhotoPanel photo="bluenight" variant="priority" eager>
      <template #decor><CourtLines rally /></template>
      <span class="status-pill">
        <Icon name="heroicons:sparkles" class="w-4 h-4" aria-hidden="true" />
        Muy pronto
      </span>
      <h1 class="coming-soon__title">Torneos competitivos</h1>
      <p>Estamos preparando torneos con cuadros, fases y puntos para el ranking. Muy pronto podrás inscribirte y competir.</p>
      <div class="quick-actions coming-soon__actions">
        <NuxtLink to="/profile" class="btn-primary">
          Completar perfil
          <Icon name="heroicons:user-circle" class="w-5 h-5" aria-hidden="true" />
        </NuxtLink>
        <NuxtLink to="/matches" class="btn-photo">Ver partidos</NuxtLink>
      </div>
    </PhotoPanel>
    <p class="meta coming-soon__note">Mientras tanto, completa tu perfil y juega partidos competitivos: tu nivel te acompañará en tu primer torneo.</p>
  </div>
</template>

<script setup lang="ts">
/** Player-facing Torneos while the flow ships (mock Torneos is a labeled placeholder too). */
</script>

<style scoped>
.coming-soon__title { font-size: var(--font-size-1); line-height: 1.12; letter-spacing: -0.035em; }
.coming-soon__actions { width: 100%; max-width: 520px; margin-top: 8px; }
.coming-soon__actions > .btn-photo { flex-grow: 1; }
.coming-soon__note { margin-top: 16px; max-width: 62ch; }
</style>
