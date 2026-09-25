<template>
  <header class="page-heading">
    <NuxtLink v-if="backTo" :to="backTo" class="text-link">
      <Icon name="heroicons:arrow-left" class="w-5 h-5" aria-hidden="true" />
      {{ backLabel || 'Volver' }}
    </NuxtLink>
    <p v-if="meta" class="meta">{{ meta }}</p>
    <div :class="$slots.actions ? 'page-heading-row' : undefined">
      <div class="page-heading-copy">
        <h1>{{ title }}</h1>
        <p v-if="subtitle" class="meta page-heading-subtitle">{{ subtitle }}</p>
      </div>
      <div v-if="$slots.actions" class="quick-actions">
        <slot name="actions" />
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
/**
 * Plain/detail page heading (DESIGN_SYSTEM.md §4): optional back link, a short
 * context line, one wrapping h1, optional subtitle and actions. The photo variant
 * is <PhotoPanel variant="compact"> with an h1 inside.
 */
interface Props {
  title: string
  subtitle?: string
  meta?: string
  backTo?: string
  backLabel?: string
}

defineProps<Props>()
</script>

<style scoped>
.page-heading-row { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 16px 24px; }
.page-heading-copy { display: grid; gap: 10px; min-width: 0; flex: 1 1 22rem; }
.page-heading-subtitle { font-size: 16px; max-width: 58ch; }
</style>
