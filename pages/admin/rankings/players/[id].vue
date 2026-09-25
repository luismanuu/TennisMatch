<template>
  <PageLayout container-size="medium">
        <!-- Header -->
        <div class="mb-8">
          <NuxtLink to="/admin/rankings" class="text-link mb-2">
            <Icon name="heroicons:arrow-left" class="w-4 h-4" />
            Volver a Rankings
          </NuxtLink>
          <div v-if="playerRankingDetails?.player" class="panel">
            <div class="flex items-center justify-between">
              <div>
                <h1 class="text-size-1 font-semibold text-foreground mb-2">{{ playerRankingDetails.player.name }}</h1>
                <div class="flex items-center gap-4">
                  <span class="text-size-3 font-bold text-accent">{{ playerRankingDetails.player.elo }} SR</span>
                  <span 
                    class="px-3 py-1 rounded-full text-size-4 font-semibold"
                    :style="{ 
                      color: playerRankingDetails.player.tier_color,
                      backgroundColor: playerRankingDetails.player.tier_color + '20'
                    }"
                  >
                    {{ playerRankingDetails.player.rating_tier }}
                  </span>
                  <span class="text-size-4 text-foreground-muted">Rank #{{ playerRankingDetails.player.current_rank }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="panel loading-state" aria-busy="true">
          <Icon name="heroicons:arrow-path" class="loading-spinner animate-spin" aria-hidden="true" />
          <p class="loading-text">Cargando detalles…</p>
        </div>

        <!-- Content -->
        <div v-else-if="playerRankingDetails" class="space-y-8">
          <!-- Overview Cards -->
          <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div class="panel">
              <h3 class="text-size-3 font-semibold text-foreground-muted mb-2">Partidos Totales</h3>
              <p class="text-size-1 font-bold text-foreground">{{ playerRankingDetails.player.total_matches_played }}</p>
            </div>
            <div class="panel">
              <h3 class="text-size-3 font-semibold text-foreground-muted mb-2">Racha de Victoria</h3>
              <p class="text-size-1 font-bold text-green-400">{{ playerRankingDetails.player.win_streak }}</p>
            </div>
            <div class="panel">
              <h3 class="text-size-3 font-semibold text-foreground-muted mb-2">Racha de Derrota</h3>
              <p class="text-size-1 font-bold text-red-400">{{ playerRankingDetails.player.loss_streak }}</p>
            </div>
            <div class="panel">
              <h3 class="text-size-3 font-semibold text-foreground-muted mb-2">Partidos este Mes</h3>
              <p class="text-size-1 font-bold text-foreground">{{ playerRankingDetails.player.matches_this_month }}</p>
            </div>
          </div>

          <!-- Placement Status -->
          <div v-if="playerRankingDetails.player.is_in_placement" class="panel">
            <h2 class="panel-title">Estado de Placement</h2>
            <AdminPlacementMatchStatus
              :completed="playerRankingDetails.player.placement_matches_completed"
              :total="3"
              :history="playerRankingDetails.rating_history?.filter((h: any) => h.is_placement_match) || []"
            />
          </div>

          <!-- Decay Status -->
          <div v-if="playerRankingDetails.decay_status" class="panel">
            <h2 class="panel-title">Estado de Decay</h2>
            <div class="space-y-4">
              <div class="p-4 rounded-xl bg-surface border border-border-subtle">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-size-4 text-foreground-muted">Partidos este mes</span>
                  <span class="text-size-3 font-bold text-foreground">
                    {{ playerRankingDetails.decay_status.matches_this_month }}/{{ playerRankingDetails.decay_status.matches_required }}
                  </span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-size-4 text-foreground-muted">Decay estimado</span>
                  <span class="text-size-3 font-bold" :class="playerRankingDetails.decay_status.will_decay ? 'text-red-400' : 'text-green-400'">
                    {{ playerRankingDetails.decay_status.will_decay ? `-${playerRankingDetails.decay_status.estimated_decay}` : '0' }} SR
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- ELO Progression Chart -->
          <div v-if="playerRankingDetails.elo_progression && playerRankingDetails.elo_progression.length > 0" class="panel">
            <h2 class="panel-title">Progresión de SR</h2>
            <EloHistoryChart :history-data="playerRankingDetails.elo_progression.map((e: any) => ({
              id: e.date,
              elo_before: e.elo - e.change,
              elo_after: e.elo,
              created_at: e.date
            }))" />
          </div>

          <!-- Recent Match Impact -->
          <div v-if="playerRankingDetails.recent_match_impact && playerRankingDetails.recent_match_impact.length > 0" class="panel">
            <h2 class="panel-title">Impacto de Partidos Recientes</h2>
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead class="bg-surface border-b border-border-subtle">
                  <tr>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">Fecha</th>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">Oponente</th>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">Resultado</th>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">Cambio SR</th>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">SR Después</th>
                  </tr>
                </thead>
                <tbody>
                  <tr 
                    v-for="match in playerRankingDetails.recent_match_impact" 
                    :key="match.id"
                    class="border-b border-border-subtle hover:bg-surface/50"
                  >
                    <td class="p-4 text-size-4 text-foreground-muted">{{ formatDate(match.created_at) }}</td>
                    <td class="p-4 text-size-4 text-foreground">
                      {{ match.opponent?.name || 'N/A' }}
                    </td>
                    <td class="p-4">
                      <span 
                        class="px-2 py-1 rounded text-size-4 font-semibold"
                        :class="match.was_winner ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'"
                      >
                        {{ match.was_winner ? 'Victoria' : 'Derrota' }}
                      </span>
                    </td>
                    <td class="p-4 text-size-4 font-semibold" :class="match.elo_change >= 0 ? 'text-green-400' : 'text-red-400'">
                      {{ match.elo_change >= 0 ? '+' : '' }}{{ match.elo_change }}
                    </td>
                    <td class="p-4 text-size-4 text-foreground">{{ match.elo_after }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
  </PageLayout>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: ['admin']
})

const route = useRoute()
const playerId = route.params.id as string

const { loading, playerRankingDetails, fetchPlayerRankingDetails } = useAdminRankings()

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

onMounted(() => {
  if (playerId) {
    fetchPlayerRankingDetails(playerId)
  }
})
</script>
