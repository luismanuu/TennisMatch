<template>
  <div 
    v-if="showWarning"
    class="p-4 rounded-xl border-2 transition-all"
    :class="warningClasses"
  >
    <div class="flex items-start gap-3">
      <div class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" :class="iconBgClass">
        <Icon :name="iconName" class="w-5 h-5" :class="iconClass" />
      </div>
      <div class="flex-1">
        <h4 class="text-size-3 font-semibold mb-1" :class="titleClass">
          {{ title }}
        </h4>
        <p class="text-size-4 text-foreground-muted mb-2">
          {{ description }}
        </p>
        <div class="flex items-center gap-4 text-size-4">
          <div class="flex items-center gap-2">
            <Icon name="heroicons:calendar" class="w-4 h-4 text-foreground-muted" />
            <span class="text-foreground-muted">
              <span class="font-semibold text-foreground">{{ matchesThisMonth }}/{{ matchesRequired }}</span> partidos este mes
            </span>
          </div>
          <div class="flex items-center gap-2">
            <Icon name="heroicons:clock" class="w-4 h-4 text-foreground-muted" />
            <span class="text-foreground-muted">
              <span class="font-semibold text-foreground">{{ daysRemaining }}</span> días restantes
            </span>
          </div>
        </div>
        <NuxtLink 
          v-if="showMatchmakingLink"
          to="/matchmaking" 
          class="inline-flex items-center gap-2 mt-3 text-size-4 font-semibold text-accent hover:underline"
        >
          <Icon name="heroicons:magnifying-glass" class="w-4 h-4" />
          Buscar oponente
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  matchesThisMonth: number
  matchesRequired?: number
  daysRemaining: number
  estimatedDecay?: number
  showMatchmakingLink?: boolean
  isInPlacement?: boolean
}>()

const matchesRequired = computed(() => props.matchesRequired ?? 2)

const matchesNeeded = computed(() => 
  Math.max(0, matchesRequired.value - props.matchesThisMonth)
)

const isUrgent = computed(() => 
  props.daysRemaining <= 3 && matchesNeeded.value > 0
)

const isOnTrack = computed(() => matchesNeeded.value === 0)

// Don't show warning if player is in placement matches (exempt from decay)
const showWarning = computed(() => 
  !props.isInPlacement && (!isOnTrack.value || isUrgent.value)
)

const warningClasses = computed(() => {
  if (isOnTrack.value) {
    return 'bg-green-500/10 border-green-500/30'
  }
  if (isUrgent.value) {
    return 'bg-red-500/10 border-red-500/30'
  }
  return 'bg-yellow-500/10 border-yellow-500/30'
})

const iconBgClass = computed(() => {
  if (isOnTrack.value) {
    return 'bg-green-500/20'
  }
  if (isUrgent.value) {
    return 'bg-red-500/20'
  }
  return 'bg-yellow-500/20'
})

const iconClass = computed(() => {
  if (isOnTrack.value) {
    return 'text-green-400'
  }
  if (isUrgent.value) {
    return 'text-red-400'
  }
  return 'text-yellow-400'
})

const iconName = computed(() => {
  if (isOnTrack.value) {
    return 'heroicons:check-circle'
  }
  if (isUrgent.value) {
    return 'heroicons:exclamation-triangle'
  }
  return 'heroicons:clock'
})

const titleClass = computed(() => {
  if (isOnTrack.value) {
    return 'text-green-400'
  }
  if (isUrgent.value) {
    return 'text-red-400'
  }
  return 'text-yellow-400'
})

const title = computed(() => {
  if (isOnTrack.value) {
    return '¡Requisito mensual cumplido!'
  }
  if (isUrgent.value) {
    return '¡Urgente! SR en riesgo de decay'
  }
  return 'Juega para evitar decay de SR'
})

const description = computed(() => {
  if (isOnTrack.value) {
    return 'Has jugado suficientes partidos este mes. Tu SR (Skill Rating) está protegido.'
  }
  if (isUrgent.value) {
    return `Necesitas ${matchesNeeded.value} partido(s) más en ${props.daysRemaining} días para evitar perder ${props.estimatedDecay ?? matchesNeeded.value * 25} puntos de SR.`
  }
  return `Juega ${matchesNeeded.value} partido(s) más este mes para evitar decay de SR.`
})
</script>
