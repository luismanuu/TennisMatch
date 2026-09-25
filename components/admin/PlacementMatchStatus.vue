<template>
  <div class="placement-match-status">
    <div class="flex items-center gap-4">
      <div class="flex-1">
        <div class="flex items-center justify-between mb-2">
          <span class="text-size-4 font-semibold text-foreground">Placement Matches</span>
          <div v-if="completed >= total" class="flex items-center gap-2">
            <Icon name="heroicons:check-circle" class="w-4 h-4 text-green-400" />
            <span class="text-size-3 font-bold text-green-400">Completado</span>
          </div>
          <span v-else class="text-size-3 font-bold text-accent">
            {{ completed }}/{{ total }}
          </span>
        </div>
        <div class="w-full bg-surface border border-border-subtle rounded-full h-3 overflow-hidden">
          <div 
            class="h-full bg-accent transition-all duration-300"
            :style="{ width: `${(completed / total) * 100}%` }"
          />
        </div>
      </div>
      <div v-if="showActions" class="flex gap-2">
        <button
          v-if="completed < total"
          @click="$emit('reset')"
          :disabled="loading"
          class="btn-secondary text-size-4 !py-2 !px-4 disabled:opacity-50"
        >
          <Icon name="heroicons:arrow-path" class="w-4 h-4" />
          Reset
        </button>
        <button
          v-if="completed < total"
          @click="$emit('complete')"
          :disabled="loading"
          class="btn-primary text-size-4 !py-2 !px-4 disabled:opacity-50"
        >
          <Icon name="heroicons:check" class="w-4 h-4" />
          Completar
        </button>
      </div>
    </div>
    <div v-if="history && history.length > 0" class="mt-4 space-y-2">
      <p class="text-size-5 font-semibold text-foreground-muted mb-2">Historial de Placement</p>
      <div 
        v-for="(match, index) in history" 
        :key="index"
        class="p-3 rounded-lg bg-surface border border-border-subtle"
      >
        <div class="flex items-center justify-between">
          <span class="text-size-4 text-foreground-muted">
            Match {{ index + 1 }}: {{ match.was_winner ? 'Victoria' : 'Derrota' }}
          </span>
          <span class="text-size-4 font-semibold" :class="match.elo_change >= 0 ? 'text-green-400' : 'text-red-400'">
            {{ match.elo_change >= 0 ? '+' : '' }}{{ match.elo_change }} SR
          </span>
        </div>
        <p class="text-size-5 text-foreground-muted mt-1">
          {{ formatDate(match.created_at) }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  completed: number
  total?: number
  history?: Array<{
    created_at: string
    elo_change: number
    was_winner: boolean
  }>
  showActions?: boolean
  loading?: boolean
}

withDefaults(defineProps<Props>(), {
  total: 3,
  history: () => [],
  showActions: false,
  loading: false
})

defineEmits<{
  reset: []
  complete: []
}>()

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  // Use Ecuador timezone for display
  return date.toLocaleDateString('es-ES', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}
</script>
