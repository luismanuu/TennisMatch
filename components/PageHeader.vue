<template>
  <div :class="headerClass">
    <!-- Badge (optional) -->
    <div v-if="badge" class="page-header-badge animate-fade-up">
      <Icon v-if="badgeIcon" :name="badgeIcon" class="w-4 h-4 text-accent" />
      <span class="text-size-4 font-semibold text-accent">{{ badge }}</span>
    </div>

    <!-- Back Link (optional) -->
    <NuxtLink
      v-if="backTo"
      :to="backTo"
      class="page-back-link animate-fade-up"
    >
      <Icon name="heroicons:arrow-left" class="w-4 h-4" />
      <span>{{ backLabel || 'Volver' }}</span>
    </NuxtLink>

    <!-- Title and Subtitle -->
    <div :class="titleContainerClass">
      <h1 class="page-header-title">{{ title }}</h1>
      <p v-if="subtitle" class="page-header-subtitle">{{ subtitle }}</p>
    </div>

    <!-- Action Button (optional) -->
    <div v-if="$slots.actions" class="flex items-center gap-3 animate-fade-up animate-delay-1">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
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

const headerClass = computed(() => {
  if (props.layout === 'split') {
    return 'page-header-with-back flex items-start justify-between mb-8'
  }
  return 'page-header'
})

const titleContainerClass = computed(() => {
  if (props.layout === 'split') {
    return 'flex-1'
  }
  return ''
})
</script>


