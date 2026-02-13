<template>
  <div 
    class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 transition-all"
    :class="badgeClasses"
    :style="badgeStyle"
  >
    <img
      v-if="rankIconPath && !imageError"
      :src="resolveAssetPath(rankIconPath)"
      :alt="`${tierInfo.tier} tier icon`"
      class="w-4 h-4 flex-shrink-0 object-contain"
      @error="handleImageError"
    >
    <div 
      v-else
      class="w-4 h-4 rounded-full"
      :style="{ backgroundColor: tierInfo.color }"
    ></div>
    <span class="text-size-4 font-semibold">
      {{ displayText }}
    </span>
    <span 
      v-if="showProvisional && isProvisional" 
      class="text-xs font-medium px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
    >
      Provisional
    </span>
  </div>
</template>

<script setup lang="ts">
import type { RatingTier, RatingTierInfo } from '~/types'
import { useRankIconAsset } from '~/composables/useRankIcon'

const props = defineProps<{
  elo: number
  totalMatchesPlayed?: number
  placementMatchesCompleted?: number
  showProvisional?: boolean
  showElo?: boolean
}>()

// Rating tiers definition
const RATING_TIERS: RatingTierInfo[] = [
  { tier: 'Bronze', minElo: 1, maxElo: 1499, color: '#CD7F32' },
  { tier: 'Silver', minElo: 1500, maxElo: 1999, color: '#C0C0C0' },
  { tier: 'Gold', minElo: 2000, maxElo: 2499, color: '#FFD700' },
  { tier: 'Platinum', minElo: 2500, maxElo: 2999, color: '#E5E4E2' },
  { tier: 'Diamond', minElo: 3000, maxElo: 3499, color: '#B9F2FF' },
  { tier: 'Master', minElo: 3500, maxElo: 3999, color: '#9932CC' },
  { tier: 'Grandmaster', minElo: 4000, maxElo: Infinity, color: '#FF4500' },
]

// Tier names in Spanish
const TIER_NAMES_ES: Record<RatingTier, string> = {
  'Bronze': 'Bronce',
  'Silver': 'Plata',
  'Gold': 'Oro',
  'Platinum': 'Platino',
  'Diamond': 'Diamante',
  'Master': 'Maestro',
  'Grandmaster': 'Gran Maestro',
  'Unrated': 'Sin clasificar'
}

const isUnrated = computed(() => (props.totalMatchesPlayed ?? 0) === 0)
const isProvisional = computed(() => 
  !isUnrated.value && (props.placementMatchesCompleted ?? 0) < 3
)

const tierInfo = computed<RatingTierInfo>(() => {
  if (isUnrated.value) {
    return { tier: 'Unrated', minElo: 0, maxElo: 0, color: '#6B7280' }
  }
  
  for (const tier of RATING_TIERS) {
    if (props.elo >= tier.minElo && props.elo <= tier.maxElo) {
      return tier
    }
  }
  return RATING_TIERS[0]!
})

const displayText = computed(() => {
  if (isUnrated.value) {
    return 'Sin clasificar'
  }
  
  const tierName = TIER_NAMES_ES[tierInfo.value.tier] || tierInfo.value.tier
  if (props.showElo) {
    return `${tierName} (${props.elo})`
  }
  return tierName
})

const badgeClasses = computed(() => {
  const baseClasses = 'backdrop-blur-sm'
  
  if (isUnrated.value) {
    return `${baseClasses} bg-gray-500/10 border-gray-500/30 text-gray-400`
  }
  
  return `${baseClasses} text-foreground`
})

const badgeStyle = computed(() => {
  if (isUnrated.value) {
    return {}
  }
  
  const color = tierInfo.value.color
  return {
    backgroundColor: `${color}15`,
    borderColor: `${color}50`,
  }
})

const rankIconPath = computed(() => {
  return useRankIconAsset(tierInfo.value.tier)
})

const imageError = ref(false)

const resolveAssetPath = (path: string | null) => {
  if (!path) return ''
  // In Nuxt, files in public/ folder are served directly from root
  // Paths like '/images/ranks/bronze.svg' map to public/images/ranks/bronze.svg
  return path
}

const handleImageError = () => {
  imageError.value = true
}
</script>
