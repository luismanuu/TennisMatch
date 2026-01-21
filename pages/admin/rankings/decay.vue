<template>
  <div class="min-h-screen bg-background relative overflow-hidden">
    <div class="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <div class="orb orb-accent w-96 h-96 -top-48 -right-48 animate-float opacity-20"></div>
      <div class="orb orb-secondary w-80 h-80 -bottom-40 -left-40 animate-float-delayed opacity-15"></div>
      <div class="grid-pattern absolute inset-0 opacity-30"></div>
    </div>

    <AppNavigation />
    <div class="h-16"></div>

    <div class="section-padding relative z-10">
      <div class="container-medium px-6">
        <div class="text-center mb-12 animate-fade-up">
          <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-subtle/30 border border-accent/30 backdrop-blur-sm mb-6">
            <Icon name="heroicons:arrow-down" class="w-4 h-4 text-accent" />
            <span class="text-size-4 font-semibold text-accent">Monthly Decay</span>
          </div>
          <h1 class="text-size-1 font-semibold text-foreground mb-4">Gestión de Monthly Decay</h1>
          <p class="text-size-3 font-regular text-foreground-muted">Administra el decay mensual de jugadores inactivos</p>
        </div>

        <!-- Navigation -->
        <div class="mb-8 flex flex-wrap gap-4">
          <NuxtLink to="/admin/rankings" class="btn-secondary text-size-4">
            <Icon name="heroicons:chart-bar" class="w-4 h-4 mr-2" />
            Estadísticas
          </NuxtLink>
          <NuxtLink to="/admin/rankings/trends" class="btn-secondary text-size-4">
            <Icon name="heroicons:arrow-trending-up" class="w-4 h-4 mr-2" />
            Tendencias
          </NuxtLink>
          <NuxtLink to="/admin/rankings/leaderboards" class="btn-secondary text-size-4">
            <Icon name="heroicons:trophy" class="w-4 h-4 mr-2" />
            Leaderboards
          </NuxtLink>
          <NuxtLink to="/admin/rankings/placement" class="btn-secondary text-size-4">
            <Icon name="heroicons:clock" class="w-4 h-4 mr-2" />
            Placement
          </NuxtLink>
          <NuxtLink to="/admin/rankings/decay" class="btn-primary text-size-4">
            <Icon name="heroicons:arrow-down" class="w-4 h-4 mr-2" />
            Decay
          </NuxtLink>
          <NuxtLink to="/admin/rankings/health" class="btn-secondary text-size-4">
            <Icon name="heroicons:heart" class="w-4 h-4 mr-2" />
            Health
          </NuxtLink>
        </div>

        <!-- Statistics -->
        <div v-if="decayStats" class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-6 md:mb-8">
          <div class="glass-card-elevated p-6">
            <h3 class="text-size-3 font-semibold text-foreground-muted mb-2">Elegibles</h3>
            <p class="text-size-1 font-bold text-foreground">{{ decayStats.total_eligible }}</p>
          </div>
          <div class="glass-card-elevated p-6">
            <h3 class="text-size-3 font-semibold text-foreground-muted mb-2">En Riesgo</h3>
            <p class="text-size-1 font-bold text-red-400">{{ decayStats.total_at_risk }}</p>
          </div>
          <div class="glass-card-elevated p-6">
            <h3 class="text-size-3 font-semibold text-foreground-muted mb-2">Exentos</h3>
            <p class="text-size-1 font-bold text-foreground">{{ decayStats.total_exempt }}</p>
          </div>
          <div class="glass-card-elevated p-6">
            <h3 class="text-size-3 font-semibold text-foreground-muted mb-2">Decay Total</h3>
            <p class="text-size-1 font-bold text-red-400">-{{ decayStats.total_decay_amount }} ELO</p>
          </div>
        </div>

        <!-- Filters -->
        <div class="glass-card-elevated p-4 mb-8">
          <div class="flex items-center gap-4">
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                v-model="showOnlyAtRisk"
                @change="filterPlayers"
                class="w-5 h-5 rounded border-border text-accent focus:ring-accent"
              />
              <span class="text-size-4 text-foreground">Solo en riesgo</span>
            </label>
            <button
              v-if="decayStats && decayStats.total_at_risk > 0"
              @click="handleBulkTrigger"
              :disabled="loading || bulkTriggering"
              class="btn-danger text-size-4 ml-auto disabled:opacity-50"
            >
              <Icon name="heroicons:arrow-down" class="w-4 h-4 mr-2" />
              Aplicar Decay a Todos
            </button>
          </div>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="glass-card-elevated p-12 text-center">
          <Icon name="heroicons:arrow-path" class="w-8 h-8 text-accent animate-spin mx-auto mb-4" />
          <p class="text-size-3 text-foreground-muted">Cargando...</p>
        </div>

        <!-- No Players -->
        <div v-else-if="filteredPlayers.length === 0" class="glass-card-elevated p-12 text-center">
          <Icon name="heroicons:check-circle" class="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h2 class="text-size-2 font-semibold text-foreground mb-2">¡Excelente! No hay jugadores en riesgo de decay</h2>
          <p class="text-size-4 text-foreground-muted mb-6">
            <span v-if="showOnlyAtRisk">
              No hay jugadores en riesgo de decay con los filtros actuales. Intenta desactivar el filtro "Solo en riesgo" para ver todos los jugadores.
            </span>
            <span v-else>
              Todos los jugadores han jugado suficientes partidos este mes para evitar el decay.
            </span>
          </p>
          <button v-if="showOnlyAtRisk" @click="showOnlyAtRisk = false; filterPlayers()" class="btn-primary text-size-4">
            <Icon name="heroicons:eye" class="w-4 h-4 mr-2" />
            Ver Todos los Jugadores
          </button>
        </div>

        <!-- Players Grid -->
        <div v-else-if="filteredPlayers.length > 0" class="space-y-6">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <AdminDecayStatusCard
            v-for="player in filteredPlayers"
            :key="player.id"
            :player="player"
            :show-actions="true"
            :loading="triggeringIds.has(player.id) || exemptingIds.has(player.id)"
            @trigger="handleTrigger(player.id)"
            @exempt="handleExempt(player.id)"
          />
          </div>
          
          <!-- Pagination -->
          <PaginationControls
            v-if="decayTotal > decayPageSize"
            :current-page="decayPage"
            :total-pages="Math.ceil(decayTotal / decayPageSize)"
            :total="decayTotal"
            :page-size="decayPageSize"
            :loading="loading"
            @page-change="(page) => fetchDecayStatus(showOnlyAtRisk, page)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import PaginationControls from '~/components/admin/PaginationControls.vue'
definePageMeta({
  middleware: ['admin']
})

const { 
  loading, 
  decayStatus, 
  decayStats, 
  decayPage,
  decayPageSize,
  decayTotal,
  fetchDecayStatus, 
  triggerDecay, 
  exemptFromDecay 
} = useAdminRankings()
const toast = useToastNotifications()

const showOnlyAtRisk = ref(true)
const triggeringIds = ref<Set<string>>(new Set())
const exemptingIds = ref<Set<string>>(new Set())
const bulkTriggering = ref(false)

const filteredPlayers = computed(() => {
  // Server-side filtering is handled by fetchDecayStatus
  return decayStatus.value
})

const filterPlayers = async () => {
  // Reset to page 1 when filter changes
  await fetchDecayStatus(showOnlyAtRisk.value, 1)
}

const handleTrigger = async (playerId: string) => {
  if (!confirm('¿Estás seguro de que quieres aplicar decay a este jugador?')) {
    return
  }

  try {
    triggeringIds.value.add(playerId)
    await triggerDecay(playerId)
    toast.success('Decay aplicado exitosamente')
  } catch (err: any) {
    toast.error(err.message || 'Error al aplicar decay')
  } finally {
    triggeringIds.value.delete(playerId)
  }
}

const handleExempt = async (playerId: string) => {
  if (!confirm('¿Estás seguro de que quieres eximir a este jugador del decay?')) {
    return
  }

  try {
    exemptingIds.value.add(playerId)
    await exemptFromDecay(playerId)
    toast.success('Jugador eximido del decay')
  } catch (err: any) {
    toast.error(err.message || 'Error al eximir jugador')
  } finally {
    exemptingIds.value.delete(playerId)
  }
}

const handleBulkTrigger = async () => {
  if (!confirm(`¿Estás seguro de que quieres aplicar decay a todos los ${decayStats.value?.total_at_risk || 0} jugadores en riesgo?`)) {
    return
  }

  try {
    bulkTriggering.value = true
    const atRiskPlayers = decayStatus.value.filter((p: any) => p.is_at_risk)
    
    for (const player of atRiskPlayers) {
      await triggerDecay(player.id)
    }
    
    toast.success(`Decay aplicado a ${atRiskPlayers.length} jugadores`)
  } catch (err: any) {
    toast.error(err.message || 'Error al aplicar decay en masa')
  } finally {
    bulkTriggering.value = false
  }
}

onMounted(() => {
  fetchDecayStatus(showOnlyAtRisk.value)
})
</script>
