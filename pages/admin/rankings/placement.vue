<template>
  <PageLayout container-size="medium">
        <PageHeader title="Gestión de Placement Matches" subtitle="Administra jugadores en fase de placement" back-to="/admin/rankings" back-label="Volver a rankings" />

        <!-- Navigation -->
        <div class="mb-8 flex flex-wrap gap-4">
          <NuxtLink to="/admin/rankings" class="btn-secondary text-size-4">
            <Icon name="heroicons:chart-bar" class="w-4 h-4" />
            Estadísticas
          </NuxtLink>
          <NuxtLink to="/admin/rankings/trends" class="btn-secondary text-size-4">
            <Icon name="heroicons:arrow-trending-up" class="w-4 h-4" />
            Tendencias
          </NuxtLink>
          <NuxtLink to="/admin/rankings/leaderboards" class="btn-secondary text-size-4">
            <Icon name="heroicons:trophy" class="w-4 h-4" />
            Leaderboards
          </NuxtLink>
          <NuxtLink to="/admin/rankings/placement" class="btn-primary text-size-4">
            <Icon name="heroicons:clock" class="w-4 h-4" />
            Placement
          </NuxtLink>
          <NuxtLink to="/admin/rankings/decay" class="btn-secondary text-size-4">
            <Icon name="heroicons:arrow-down" class="w-4 h-4" />
            Decay
          </NuxtLink>
          <NuxtLink to="/admin/rankings/health" class="btn-secondary text-size-4">
            <Icon name="heroicons:heart" class="w-4 h-4" />
            Health
          </NuxtLink>
        </div>

        <!-- Statistics -->
        <div v-if="placementStats" class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-6 md:mb-8">
          <div class="panel">
            <h3 class="text-size-3 font-semibold text-foreground-muted mb-2">Total en Placement</h3>
            <p class="text-size-1 font-bold text-foreground">{{ placementStats.total_in_placement }}</p>
          </div>
          <div class="panel">
            <h3 class="text-size-3 font-semibold text-foreground-muted mb-2">0/3 Completados</h3>
            <p class="text-size-1 font-bold text-foreground">{{ placementStats.completed_0 }}</p>
          </div>
          <div class="panel">
            <h3 class="text-size-3 font-semibold text-foreground-muted mb-2">1/3 Completados</h3>
            <p class="text-size-1 font-bold text-foreground">{{ placementStats.completed_1 }}</p>
          </div>
          <div class="panel">
            <h3 class="text-size-3 font-semibold text-foreground-muted mb-2">2/3 Completados</h3>
            <p class="text-size-1 font-bold text-foreground">{{ placementStats.completed_2 }}</p>
          </div>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="panel loading-state" aria-busy="true">
          <Icon name="heroicons:arrow-path" class="loading-spinner animate-spin" aria-hidden="true" />
          <p class="loading-text">Cargando…</p>
        </div>

        <!-- No Players -->
        <div v-else-if="placementMatches.length === 0" class="panel text-center">
          <Icon name="heroicons:check-circle" class="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h2 class="text-size-2 font-semibold text-foreground mb-2">¡Todos los jugadores han completado el posicionamiento!</h2>
          <p class="text-size-4 text-foreground-muted mb-6">
            No hay jugadores pendientes de partidos de posicionamiento en este momento.
          </p>
          <NuxtLink to="/admin/rankings" class="btn-primary text-size-4">
            <Icon name="heroicons:chart-bar" class="w-4 h-4" />
            Ver Estadísticas de Rankings
          </NuxtLink>
        </div>

        <!-- Players Table -->
        <div v-else-if="placementMatches.length > 0" class="panel overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full min-w-[600px]">
              <thead class="bg-surface border-b border-border-subtle">
                <tr>
                  <th class="text-left p-3 sm:p-4 text-size-4 font-semibold text-foreground">Jugador</th>
                  <th class="text-left p-3 sm:p-4 text-size-4 font-semibold text-foreground">SR</th>
                  <th class="text-left p-3 sm:p-4 text-size-4 font-semibold text-foreground">Placement</th>
                  <th class="text-left p-3 sm:p-4 text-size-4 font-semibold text-foreground hidden md:table-cell">Partidos</th>
                  <th class="text-left p-3 sm:p-4 text-size-4 font-semibold text-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr 
                  v-for="player in placementMatches" 
                  :key="player.id"
                  class="border-b border-border-subtle hover:bg-surface/50 transition-colors"
                >
                  <td class="p-3 sm:p-4">
                    <div>
                      <p class="text-size-4 font-semibold text-foreground">{{ player.name }}</p>
                      <p class="text-size-5 text-foreground-muted">{{ player.city?.name || 'N/A' }}</p>
                    </div>
                  </td>
                  <td class="p-3 sm:p-4 text-size-4 font-regular text-foreground">{{ player.elo }}</td>
                  <td class="p-3 sm:p-4">
                    <AdminPlacementMatchStatus
                      :completed="player.placement_matches_completed"
                      :total="3"
                      :history="player.placement_history"
                    />
                  </td>
                  <td class="p-3 sm:p-4 text-size-4 font-regular text-foreground hidden md:table-cell">{{ player.total_matches_played }}</td>
                  <td class="p-3 sm:p-4">
                    <div class="flex flex-col sm:flex-row gap-2">
                      <button
                        @click="handleReset(player.id)"
                        :disabled="loading || resettingIds.has(player.id)"
                        class="btn-secondary text-size-4 !py-2 !px-4 disabled:opacity-50"
                      >
                        <Icon name="heroicons:arrow-path" class="w-4 h-4" />
                        Reset
                      </button>
                      <button
                        @click="handleComplete(player.id)"
                        :disabled="loading || completingIds.has(player.id)"
                        class="btn-primary text-size-4 !py-2 !px-4 disabled:opacity-50"
                      >
                        <Icon name="heroicons:check" class="w-4 h-4" />
                        Completar
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <!-- Pagination -->
          <PaginationControls
            v-if="placementTotal > placementPageSize"
            :current-page="placementPage"
            :total-pages="Math.ceil(placementTotal / placementPageSize)"
            :total="placementTotal"
            :page-size="placementPageSize"
            :loading="loading"
            @page-change="(page) => fetchPlacementMatches(page)"
          />
        </div>
  </PageLayout>
</template>

<script setup lang="ts">
import PaginationControls from '~/components/admin/PaginationControls.vue'
definePageMeta({
  middleware: ['admin']
})

const { 
  loading, 
  placementMatches, 
  placementStats, 
  placementPage,
  placementPageSize,
  placementTotal,
  fetchPlacementMatches, 
  resetPlacementMatches, 
  completePlacementMatches 
} = useAdminRankings()
const toast = useToastNotifications()

const resettingIds = ref<Set<string>>(new Set())
const completingIds = ref<Set<string>>(new Set())

const handleReset = async (playerId: string) => {
  if (!confirm('¿Estás seguro de que quieres resetear los placement matches de este jugador?')) {
    return
  }

  try {
    resettingIds.value.add(playerId)
    await resetPlacementMatches(playerId)
    toast.success('Placement matches reseteados exitosamente')
  } catch (err: any) {
    toast.error(err.message || 'Error al resetear placement matches')
  } finally {
    resettingIds.value.delete(playerId)
  }
}

const handleComplete = async (playerId: string) => {
  if (!confirm('¿Estás seguro de que quieres marcar los placement matches como completados?')) {
    return
  }

  try {
    completingIds.value.add(playerId)
    await completePlacementMatches(playerId)
    toast.success('Placement matches marcados como completados')
  } catch (err: any) {
    toast.error(err.message || 'Error al completar placement matches')
  } finally {
    completingIds.value.delete(playerId)
  }
}

onMounted(() => {
  fetchPlacementMatches()
})
</script>
