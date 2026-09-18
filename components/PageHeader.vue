<template>
  <header :class="headerClass">
    <!-- Back Link (optional) -->
    <NuxtLink
      v-if="backTo"
      :to="backTo"
      class="page-back-link animate-fade-up"
    >
      <Icon name="heroicons:arrow-left" class="w-4 h-4" />
      <span>{{ backLabel || 'Volver' }}</span>
    </NuxtLink>

    <div :class="layout === 'split' ? 'flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4' : ''">
      <div :class="titleContainerClass">
        <!-- Eyebrow (optional) -->
        <div v-if="badge" class="page-header-badge animate-fade-up">
          <Icon v-if="badgeIcon" :name="badgeIcon" class="w-3.5 h-3.5" />
          <span>{{ badge }}</span>
        </div>

        <!-- Title and Subtitle -->
        <h1 class="page-header-title">{{ title }}</h1>
        <p v-if="subtitle" class="page-header-subtitle">{{ subtitle }}</p>
      </div>

      <!-- Actions (optional) -->
      <div v-if="$slots.actions" class="flex flex-wrap items-center gap-3 animate-fade-up animate-delay-1 sm:flex-shrink-0">
        <slot name="actions" />
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
/**
 * Editorial page header: eyebrow · display title · subtitle, left-aligned.
 * `layout="split"` places the actions slot to the right on ≥ sm screens.
 */
interface Props {
  title: string
  subtitle?: string
  badge?: string
  badgeIcon?: string
  backTo?: string
  backLabel?: string
  layout?: 'centered' | 'split'
}

const props = withDefaults(defineProps<Props>(), {
  layout: 'centered'
})

const headerClass = computed(() => (props.layout === 'split' ? 'page-header-with-back' : 'page-header'))
const titleContainerClass = computed(() => (props.layout === 'split' ? 'flex-1 min-w-0' : ''))
</script>
