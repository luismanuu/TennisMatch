<template>
  <NuxtLink 
    :to="`/players/${player.id}`"
    :data-user-card="player.is_current_user ? 'true' : undefined"
    class="glass-card p-3 md:p-4 hover-lift transition-all duration-300 block group"
    :class="{ 
      'ring-2 ring-accent/50 bg-accent/5': player.is_current_user,
      'border-l-4': isTopThree
    }"
    :style="isTopThree ? { borderLeftColor: getRankColor(player.rank) } : {}"
  >
    <!-- Mobile Layout (Stacked) -->
    <div class="flex flex-col gap-3 md:hidden">
      <!-- Top Row: Rank and Name -->
      <div class="flex items-center gap-3">
        <div 
          class="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center font-bold text-base md:text-lg"
          :class="rankClasses"
          :style="rankStyle"
        >
          <template v-if="player.rank === 1">
            <Icon name="heroicons:trophy" class="w-5 h-5 md:w-6 md:h-6 text-yellow-400" />
          </template>
          <template v-else-if="player.rank === 2">
            <Icon name="heroicons:trophy" class="w-4 h-4 md:w-5 md:h-5 text-gray-300" />
          </template>
          <template v-else-if="player.rank === 3">
            <Icon name="heroicons:trophy" class="w-4 h-4 md:w-5 md:h-5 text-amber-600" />
          </template>
          <template v-else>
            #{{ player.rank }}
          </template>
        </div>
        
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <h3 class="text-size-4 md:text-size-3 font-semibold text-foreground truncate group-hover:text-accent transition-colors">
              {{ player.name }}
            </h3>
            <span 
              v-if="player.is_current_user" 
              class="px-2 py-0.5 rounded-full text-xs font-semibold bg-accent/20 text-accent border border-accent/30 flex-shrink-0"
            >
              Tú
            </span>
          </div>
          
          <div class="flex items-center gap-2 text-size-4 text-foreground-muted flex-wrap">
            <!-- City -->
            <span v-if="player.city" class="flex items-center gap-1">
              <Icon name="heroicons:map-pin" class="w-3 h-3 md:w-3.5 md:h-3.5" />
              <span class="truncate max-w-[120px]">{{ player.city.name }}</span>
            </span>
            <!-- Matches -->
            <span class="flex items-center gap-1">
              <Icon name="heroicons:play" class="w-3 h-3 md:w-3.5 md:h-3.5" />
              {{ player.total_matches_played }} partidos
            </span>
          </div>
        </div>
      </div>
      
      <!-- Bottom Row: ELO, Tier, and Status -->
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <!-- ELO -->
        <div class="flex items-center gap-2">
          <span class="text-size-3 md:text-size-2 font-bold text-foreground">{{ player.elo }}</span>
          <span class="text-size-4 text-foreground-muted">ELO</span>
        </div>
        
        <!-- Status Badges Row -->
        <div class="flex items-center gap-2 flex-wrap">
          <!-- Placement Status -->
          <div v-if="isInPlacement" class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-size-4 font-semibold">
            <Icon name="heroicons:clock" class="w-3.5 h-3.5 md:w-4 md:h-4" />
            <span class="whitespace-nowrap">Colocación ({{ player.placement_matches_completed || 0 }}/3)</span>
          </div>
          
          <!-- Tier Badge -->
          <RatingTierBadge 
            :elo="player.elo" 
            :total-matches-played="player.total_matches_played"
            :placement-matches-completed="player.placement_matches_completed"
          />
          
          <!-- Rank Change Indicator -->
          <div 
            v-if="player.rank_change !== undefined && player.rank_change !== 0" 
            class="flex items-center gap-1"
          >
            <div 
              v-if="player.rank_change > 0"
              class="flex items-center gap-1 text-green-400"
            >
              <Icon name="heroicons:arrow-up" class="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span class="text-xs font-semibold">{{ player.rank_change }}</span>
            </div>
            <div 
              v-else-if="player.rank_change < 0"
              class="flex items-center gap-1 text-red-400"
            >
              <Icon name="heroicons:arrow-down" class="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span class="text-xs font-semibold">{{ Math.abs(player.rank_change) }}</span>
            </div>
          </div>
          
          <!-- Streak Indicator -->
          <div v-if="player.win_streak >= 3 || player.loss_streak >= 3">
            <div 
              v-if="player.win_streak >= 3"
              class="flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20"
            >
              <Icon name="heroicons:fire" class="w-3.5 h-3.5 md:w-4 md:h-4 text-orange-400" />
              <span class="text-xs font-semibold text-orange-400">{{ player.win_streak }}</span>
            </div>
            <div 
              v-else-if="player.loss_streak >= 3"
              class="flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20"
            >
              <Icon name="heroicons:bolt-slash" class="w-3.5 h-3.5 md:w-4 md:h-4 text-cyan-400" />
              <span class="text-xs font-semibold text-cyan-400">{{ player.loss_streak }}</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Promotion Indicator (Full Width on Mobile) -->
      <div v-if="player.near_promotion && player.next_tier" class="w-full">
        <div class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/40 text-green-400 text-size-4 font-semibold animate-pulse-subtle">
          <Icon name="heroicons:arrow-trending-up" class="w-3.5 h-3.5 md:w-4 md:h-4" />
          <span>Promoción a {{ getTierNameInSpanish(player.next_tier) }}</span>
        </div>
      </div>
    </div>
    
    <!-- Desktop Layout (Horizontal) -->
    <div class="hidden md:flex items-center gap-4">
      <!-- Rank Display -->
      <div 
        class="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg"
        :class="rankClasses"
        :style="rankStyle"
      >
        <template v-if="player.rank === 1">
          <Icon name="heroicons:trophy" class="w-6 h-6 text-yellow-400" />
        </template>
        <template v-else-if="player.rank === 2">
          <Icon name="heroicons:trophy" class="w-5 h-5 text-gray-300" />
        </template>
        <template v-else-if="player.rank === 3">
          <Icon name="heroicons:trophy" class="w-5 h-5 text-amber-600" />
        </template>
        <template v-else>
          #{{ player.rank }}
        </template>
      </div>
      
      <!-- Player Info -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1">
          <h3 class="text-size-3 font-semibold text-foreground truncate group-hover:text-accent transition-colors">
            {{ player.name }}
          </h3>
          <span 
            v-if="player.is_current_user" 
            class="px-2 py-0.5 rounded-full text-xs font-semibold bg-accent/20 text-accent border border-accent/30"
          >
            Tú
          </span>
        </div>
        
        <div class="flex items-center gap-3 text-size-4 text-foreground-muted">
          <!-- City -->
          <span v-if="player.city" class="flex items-center gap-1">
            <Icon name="heroicons:map-pin" class="w-3.5 h-3.5" />
            {{ player.city.name }}
          </span>
          <!-- Matches -->
          <span class="flex items-center gap-1">
            <Icon name="heroicons:play" class="w-3.5 h-3.5" />
            {{ player.total_matches_played }} partidos
          </span>
        </div>
        
      </div>
      
      <!-- ELO and Tier -->
      <div class="flex-shrink-0 text-right">
        <div class="flex items-center gap-2 justify-end mb-1">
          <span class="text-size-2 font-bold text-foreground">{{ player.elo }}</span>
          <span class="text-size-4 text-foreground-muted">ELO</span>
        </div>
        <!-- Placement Status -->
        <div v-if="isInPlacement" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-size-4 font-semibold mb-2">
          <Icon name="heroicons:clock" class="w-4 h-4" />
          <span>Colocación ({{ player.placement_matches_completed || 0 }}/3)</span>
        </div>
        <!-- Promotion Indicator (can show even in placement) -->
        <div v-if="player.near_promotion && player.next_tier" class="mb-2">
          <div class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/40 text-green-400 text-size-4 font-semibold animate-pulse-subtle">
            <Icon name="heroicons:arrow-trending-up" class="w-4 h-4" />
            <span>Promoción a {{ getTierNameInSpanish(player.next_tier) }}</span>
          </div>
        </div>
        <RatingTierBadge 
          :elo="player.elo" 
          :total-matches-played="player.total_matches_played"
          :placement-matches-completed="player.placement_matches_completed"
        />
      </div>
      
      <!-- Rank Change Indicator -->
      <div 
        v-if="player.rank_change !== undefined && player.rank_change !== 0" 
        class="flex-shrink-0 w-10 flex items-center justify-center"
      >
        <div 
          v-if="player.rank_change > 0"
          class="flex items-center gap-1 text-green-400"
        >
          <Icon name="heroicons:arrow-up" class="w-4 h-4" />
          <span class="text-xs font-semibold">{{ player.rank_change }}</span>
        </div>
        <div 
          v-else-if="player.rank_change < 0"
          class="flex items-center gap-1 text-red-400"
        >
          <Icon name="heroicons:arrow-down" class="w-4 h-4" />
          <span class="text-xs font-semibold">{{ Math.abs(player.rank_change) }}</span>
        </div>
      </div>
      
      <!-- Streak Indicator -->
      <div v-if="player.win_streak >= 3 || player.loss_streak >= 3" class="flex-shrink-0">
        <div 
          v-if="player.win_streak >= 3"
          class="flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20"
        >
          <Icon name="heroicons:fire" class="w-4 h-4 text-orange-400" />
          <span class="text-xs font-semibold text-orange-400">{{ player.win_streak }}</span>
        </div>
        <div 
          v-else-if="player.loss_streak >= 3"
          class="flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20"
        >
          <Icon name="heroicons:bolt-slash" class="w-4 h-4 text-cyan-400" />
          <span class="text-xs font-semibold text-cyan-400">{{ player.loss_streak }}</span>
        </div>
      </div>
      
      <!-- Arrow -->
      <div class="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <Icon name="heroicons:chevron-right" class="w-5 h-5 text-foreground-muted" />
      </div>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
import type { LeaderboardPlayer } from '~/types/leaderboard'

const props = defineProps<{
  player: LeaderboardPlayer
}>()

const isTopThree = computed(() => props.player.rank <= 3)

const getRankColor = (rank: number) => {
  switch (rank) {
    case 1: return '#FFD700' // Gold
    case 2: return '#C0C0C0' // Silver
    case 3: return '#CD7F32' // Bronze
    default: return 'transparent'
  }
}

const rankClasses = computed(() => {
  const rank = props.player.rank
  if (rank === 1) return 'bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border-2 border-yellow-500/40'
  if (rank === 2) return 'bg-gradient-to-br from-gray-300/20 to-gray-400/10 border-2 border-gray-400/40'
  if (rank === 3) return 'bg-gradient-to-br from-amber-600/20 to-amber-700/10 border-2 border-amber-600/40'
  return 'bg-surface-elevated border border-border-subtle'
})

const rankStyle = computed(() => {
  const rank = props.player.rank
  if (rank <= 3) return {}
  return { color: 'var(--foreground-muted)' }
})

const isInPlacement = computed(() => {
  return props.player.total_matches_played === 0 || (props.player.placement_matches_completed || 0) < 3
})

// Get tier name in Spanish
const getTierNameInSpanish = (tier: string | null | undefined): string => {
  if (!tier) return ''
  const tierNames: Record<string, string> = {
    'Bronze': 'Bronce',
    'Silver': 'Plata',
    'Gold': 'Oro',
    'Platinum': 'Platino',
    'Diamond': 'Diamante',
    'Master': 'Maestro',
    'Grandmaster': 'Gran Maestro'
  }
  return tierNames[tier] || tier
}
</script>

<style scoped>
@keyframes pulse-subtle {
  0%, 100% {
    opacity: 1;
    box-shadow: 0 0 8px oklch(0.70 0.22 150 / 0.3);
  }
  50% {
    opacity: 0.9;
    box-shadow: 0 0 16px oklch(0.70 0.22 150 / 0.5);
  }
}

.animate-pulse-subtle {
  animation: pulse-subtle 2s ease-in-out infinite;
}
</style>
