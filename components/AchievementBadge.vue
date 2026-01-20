<template>
  <div 
    class="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold transition-all hover:scale-105"
    :class="badgeClasses"
    :style="badgeStyle"
    :title="badge.description"
  >
    <Icon :name="badge.icon" class="w-3.5 h-3.5" />
    <span v-if="showLabel">{{ badge.label }}</span>
  </div>
</template>

<script setup lang="ts">
import type { BadgeType } from '~/types/leaderboard'
import { BADGE_DEFINITIONS } from '~/types/leaderboard'

const props = defineProps<{
  type: BadgeType
  showLabel?: boolean
}>()

const badge = computed(() => BADGE_DEFINITIONS[props.type])

const badgeClasses = computed(() => {
  const rarity = badge.value.rarity
  const baseClasses = 'backdrop-blur-sm border'
  
  switch (rarity) {
    case 'legendary':
      return `${baseClasses} animate-pulse-subtle`
    case 'epic':
      return `${baseClasses}`
    case 'rare':
      return `${baseClasses}`
    default:
      return baseClasses
  }
})

const badgeStyle = computed(() => {
  const color = badge.value.color
  return {
    backgroundColor: `${color}20`,
    borderColor: `${color}40`,
    color: color
  }
})
</script>

<style scoped>
@keyframes pulse-subtle {
  0%, 100% {
    opacity: 1;
    box-shadow: 0 0 8px var(--glow-color);
  }
  50% {
    opacity: 0.9;
    box-shadow: 0 0 16px var(--glow-color);
  }
}

.animate-pulse-subtle {
  animation: pulse-subtle 2s ease-in-out infinite;
  --glow-color: v-bind('badge.color + "40"');
}
</style>
