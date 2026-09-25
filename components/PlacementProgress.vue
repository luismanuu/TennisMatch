<template>
  <div class="mt-6 pt-6 border-t border-border-subtle">
    <div class="flex items-center justify-between mb-3">
      <span class="text-size-4 font-semibold text-foreground">Partidos de Colocación</span>
      <div v-if="isComplete" class="flex items-center gap-2">
        <Icon name="heroicons:check-circle" class="w-5 h-5 text-green-400" />
        <span class="text-size-4 text-green-400 font-semibold">Completado</span>
      </div>
      <span v-else class="text-size-4 text-accent font-semibold">{{ completed }} / {{ total }}</span>
    </div>
    
    <!-- Progress Bar -->
    <div class="h-3 bg-surface-elevated rounded-full overflow-hidden mb-4">
      <div 
        class="h-full bg-accent rounded-full"
        :style="{ width: `${progressPercent}%` }"
      ></div>
    </div>
    
    <!-- Match Results -->
    <div class="flex justify-between gap-3 mb-3">
      <div 
        v-for="(match, index) in matchResults" 
        :key="index"
        class="flex-1 flex flex-col items-center"
      >
        <div 
          class="w-10 h-10 rounded-xl flex items-center justify-center transition-all border-2"
          :class="getMatchClasses(match, index)"
        >
          <!-- Checkmark for win -->
          <Icon 
            v-if="match === 'win'" 
            name="heroicons:check" 
            class="w-6 h-6 text-white" 
          />
          <!-- X for loss -->
          <Icon 
            v-else-if="match === 'loss'" 
            name="heroicons:x-mark" 
            class="w-6 h-6 text-white" 
          />
          <!-- Checkmark for completed but unknown result -->
          <Icon 
            v-else-if="index < completed" 
            name="heroicons:check-circle" 
            class="w-6 h-6 text-white" 
          />
          <!-- Number for pending -->
          <span v-else class="text-size-3 font-semibold text-foreground-muted">{{ index + 1 }}</span>
        </div>
      </div>
    </div>
    
    <!-- Status Message -->
    <p class="text-size-5 text-foreground-muted">
      {{ statusMessage }}
    </p>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  completed: number
  total?: number
  matchResults?: Array<'win' | 'loss' | null> // Array of match results: win, loss, or null for pending
}>()

const total = computed(() => props.total ?? 3)

const progressPercent = computed(() => 
  Math.min(100, (props.completed / total.value) * 100)
)

const isComplete = computed(() => props.completed >= total.value)

// Create array of match results, filling with null for pending matches
const matchResults = computed(() => {
  const results = props.matchResults || []
  // Fill array to total length with null for pending matches
  const filled: Array<'win' | 'loss' | null> = []
  for (let i = 0; i < total.value; i++) {
    filled.push(results[i] || null)
  }
  return filled
})

// Determine if a match at index is completed (either has result or index < completed count)
const isMatchCompleted = (index: number, match: 'win' | 'loss' | null) => {
  // If we have a result (win/loss), it's completed
  if (match === 'win' || match === 'loss') {
    return true
  }
  // If no result but index is less than completed count, mark as completed (but unknown result)
  if (index < props.completed) {
    return true
  }
  return false
}

const getMatchClasses = (match: 'win' | 'loss' | null, index: number) => {
  if (match === 'win') {
    return 'bg-green-500 border-green-500/50'
  }
  if (match === 'loss') {
    return 'bg-red-500 border-red-500/50'
  }
  // If completed but no result data, show as completed with accent color
  if (index < props.completed) {
    return 'bg-accent border-accent/50'
  }
  return 'bg-surface-elevated border-border-subtle'
}

const statusMessage = computed(() => {
  if (isComplete.value) {
    return '¡Ranking definitivo establecido! Ya puedes competir en el leaderboard.'
  }
  const remaining = total.value - props.completed
  return `Completa ${remaining} partido${remaining !== 1 ? 's' : ''} más para establecer tu ranking definitivo`
})
</script>
