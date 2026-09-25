<template>
  <div class="decay-status-card p-4 rounded-xl bg-surface border" :class="isAtRisk ? 'border-red-500/30 bg-red-500/5' : 'border-border-subtle'">
    <div class="flex items-center justify-between mb-3">
      <div>
        <p class="text-size-3 font-semibold text-foreground">{{ player.name }}</p>
        <p class="text-size-5 text-foreground-muted">{{ player.city?.name || 'N/A' }}</p>
      </div>
      <div v-if="isAtRisk" class="px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-size-5 font-semibold">
        En Riesgo
      </div>
      <div v-else class="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-size-5 font-semibold">
        Seguro
      </div>
    </div>
    
    <div class="grid grid-cols-2 gap-4 mb-4">
      <div>
        <p class="text-size-5 text-foreground-muted mb-1">Partidos este mes</p>
        <p class="text-size-3 font-bold text-foreground">
          {{ player.matches_this_month }}/{{ player.matches_required }}
        </p>
      </div>
      <div>
        <p class="text-size-5 text-foreground-muted mb-1">Decay estimado</p>
        <p class="text-size-3 font-bold" :class="estimatedDecay > 0 ? 'text-red-400' : 'text-green-400'">
          {{ estimatedDecay > 0 ? `-${estimatedDecay}` : '0' }} SR
        </p>
      </div>
    </div>
    
    <div class="mb-4">
      <div class="flex items-center justify-between mb-2">
        <span class="text-size-5 text-foreground-muted">Progreso del mes</span>
        <span class="text-size-5 text-foreground-muted">{{ daysRemaining }} días restantes</span>
      </div>
      <div class="w-full bg-surface border border-border-subtle rounded-full h-2 overflow-hidden">
        <div 
          class="h-full transition-all duration-300"
          :class="progressPercent >= 100 ? 'bg-green-500' : progressPercent >= 50 ? 'bg-yellow-500' : 'bg-red-500'"
          :style="{ width: `${Math.min(100, progressPercent)}%` }"
        />
      </div>
    </div>
    
    <div v-if="showActions" class="flex gap-2">
      <button
        v-if="isAtRisk"
        @click="$emit('trigger')"
        :disabled="loading"
        class="btn-danger text-size-4 !py-2 !px-4 flex-1 disabled:opacity-50"
      >
        <Icon name="heroicons:arrow-down" class="w-4 h-4" />
        Aplicar Decay
      </button>
      <button
        @click="$emit('exempt')"
        :disabled="loading"
        class="btn-secondary text-size-4 !py-2 !px-4 flex-1 disabled:opacity-50"
      >
        <Icon name="heroicons:shield-check" class="w-4 h-4" />
        Eximir
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  player: {
    id: string
    name: string
    matches_this_month: number
    matches_required: number
    estimated_decay: number
    is_at_risk: boolean
    days_remaining_in_month?: number
    city?: { name: string }
  }
  showActions?: boolean
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showActions: false,
  loading: false
})

defineEmits<{
  trigger: []
  exempt: []
}>()

const isAtRisk = computed(() => props.player.is_at_risk)
const estimatedDecay = computed(() => props.player.estimated_decay || 0)
const daysRemaining = computed(() => props.player.days_remaining_in_month || 0)
const progressPercent = computed(() => {
  return (props.player.matches_this_month / props.player.matches_required) * 100
})
</script>
