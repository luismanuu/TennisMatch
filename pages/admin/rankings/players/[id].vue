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
        <!-- Header -->
        <div class="mb-8">
          <NuxtLink to="/admin/rankings" class="btn-secondary text-size-4 mb-4 inline-flex">
            <Icon name="heroicons:arrow-left" class="w-4 h-4 mr-2" />
            Volver a Rankings
          </NuxtLink>
          <div v-if="playerRankingDetails?.player" class="glass-card-elevated p-6">
            <div class="flex items-center justify-between">
              <div>
                <h1 class="text-size-1 font-semibold text-foreground mb-2">{{ playerRankingDetails.player.name }}</h1>
                <div class="flex items-center gap-4">
                  <span class="text-size-3 font-bold text-accent">{{ playerRankingDetails.player.elo }} ELO</span>
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
        <div v-if="loading" class="glass-card-elevated p-12 text-center">
          <Icon name="heroicons:arrow-path" class="w-8 h-8 text-accent animate-spin mx-auto mb-4" />
          <p class="text-size-3 text-foreground-muted">Cargando detalles...</p>
        </div>

        <!-- Content -->
        <div v-else-if="playerRankingDetails" class="space-y-8">
          <!-- Overview Cards -->
          <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div class="glass-card-elevated p-6">
              <h3 class="text-size-3 font-semibold text-foreground-muted mb-2">Partidos Totales</h3>
              <p class="text-size-1 font-bold text-foreground">{{ playerRankingDetails.player.total_matches_played }}</p>
            </div>
            <div class="glass-card-elevated p-6">
              <h3 class="text-size-3 font-semibold text-foreground-muted mb-2">Racha de Victoria</h3>
              <p class="text-size-1 font-bold text-green-400">{{ playerRankingDetails.player.win_streak }}</p>
            </div>
            <div class="glass-card-elevated p-6">
              <h3 class="text-size-3 font-semibold text-foreground-muted mb-2">Racha de Derrota</h3>
              <p class="text-size-1 font-bold text-red-400">{{ playerRankingDetails.player.loss_streak }}</p>
            </div>
            <div class="glass-card-elevated p-6">
              <h3 class="text-size-3 font-semibold text-foreground-muted mb-2">Partidos este Mes</h3>
              <p class="text-size-1 font-bold text-foreground">{{ playerRankingDetails.player.matches_this_month }}</p>
            </div>
          </div>

          <!-- Placement Status -->
          <div v-if="playerRankingDetails.player.is_in_placement" class="glass-card-elevated p-6">
            <h2 class="text-size-2 font-semibold text-foreground mb-4">Estado de Placement</h2>
            <AdminPlacementMatchStatus
              :completed="playerRankingDetails.player.placement_matches_completed"
              :total="3"
              :history="playerRankingDetails.rating_history?.filter((h: any) => h.is_placement_match) || []"
            />
          </div>

          <!-- Decay Status -->
          <div v-if="playerRankingDetails.decay_status" class="glass-card-elevated p-6">
            <h2 class="text-size-2 font-semibold text-foreground mb-4">Estado de Decay</h2>
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
                    {{ playerRankingDetails.decay_status.will_decay ? `-${playerRankingDetails.decay_status.estimated_decay}` : '0' }} ELO
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- ELO Progression Chart -->
          <div v-if="playerRankingDetails.elo_progression && playerRankingDetails.elo_progression.length > 0" class="glass-card-elevated p-6">
            <h2 class="text-size-2 font-semibold text-foreground mb-6">Progresión de ELO</h2>
            <EloHistoryChart :history-data="playerRankingDetails.elo_progression.map((e: any) => ({
              id: e.date,
              elo_before: e.elo - e.change,
              elo_after: e.elo,
              created_at: e.date
            }))" />
          </div>

          <!-- Recent Match Impact -->
          <div v-if="playerRankingDetails.recent_match_impact && playerRankingDetails.recent_match_impact.length > 0" class="glass-card-elevated p-6">
            <h2 class="text-size-2 font-semibold text-foreground mb-6">Impacto de Partidos Recientes</h2>
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead class="bg-surface border-b border-border-subtle">
                  <tr>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">Fecha</th>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">Oponente</th>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">Resultado</th>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">Cambio ELO</th>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">ELO Después</th>
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
      </div>
    </div>
  </div>
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
  return date.toLocaleDateString('es-ES', {
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
