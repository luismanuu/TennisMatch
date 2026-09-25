<template>
  <PageLayout container-size="medium">
        <!-- Header -->
        <div class="mb-8">
          <NuxtLink :to="`/matches/${matchId}`" class="text-link mb-2">
            <Icon name="heroicons:arrow-left" class="w-4 h-4" />
            Volver al Partido
          </NuxtLink>
          <div v-if="matchImpact?.match" class="panel">
            <h1 class="text-size-1 font-semibold text-foreground mb-4">Análisis de Impacto del Partido</h1>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p class="text-size-4 text-foreground-muted mb-1">Jugador 1</p>
                <p class="text-size-3 font-semibold text-foreground">{{ matchImpact.match.player1?.name || 'N/A' }}</p>
              </div>
              <div>
                <p class="text-size-4 text-foreground-muted mb-1">Jugador 2</p>
                <p class="text-size-3 font-semibold text-foreground">{{ matchImpact.match.player2?.name || 'N/A' }}</p>
              </div>
              <div>
                <p class="text-size-4 text-foreground-muted mb-1">Ganador</p>
                <p class="text-size-3 font-semibold text-accent">
                  {{ matchImpact.match.winner_id === matchImpact.match.player1?.id ? matchImpact.match.player1?.name : matchImpact.match.player2?.name }}
                </p>
              </div>
              <div>
                <p class="text-size-4 text-foreground-muted mb-1">Fecha</p>
                <p class="text-size-3 font-semibold text-foreground">{{ formatDate(matchImpact.match.played_at) }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="panel loading-state" aria-busy="true">
          <Icon name="heroicons:arrow-path" class="loading-spinner animate-spin" aria-hidden="true" />
          <p class="loading-text">Analizando impacto…</p>
        </div>

        <!-- Impact Content -->
        <div v-else-if="matchImpact" class="space-y-8">
          <!-- Player 1 Impact -->
          <div class="panel">
            <h2 class="panel-title">
              Impacto para {{ matchImpact.match.player1?.name }}
            </h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div class="space-y-4">
                <div class="p-4 rounded-xl bg-surface border border-border-subtle">
                  <p class="text-size-4 text-foreground-muted mb-1">SR Antes</p>
                  <p class="text-size-2 font-bold text-foreground">{{ matchImpact.player1_impact.elo_before }}</p>
                </div>
                <div class="p-4 rounded-xl bg-surface border border-border-subtle">
                  <p class="text-size-4 text-foreground-muted mb-1">SR Después</p>
                  <p class="text-size-2 font-bold text-foreground">{{ matchImpact.player1_impact.elo_after }}</p>
                </div>
                <div class="p-4 rounded-xl bg-surface border border-border-subtle">
                  <p class="text-size-4 text-foreground-muted mb-1">Cambio de SR</p>
                  <p 
                    class="text-size-2 font-bold"
                    :class="matchImpact.player1_impact.elo_change >= 0 ? 'text-green-400' : 'text-red-400'"
                  >
                    {{ matchImpact.player1_impact.elo_change >= 0 ? '+' : '' }}{{ matchImpact.player1_impact.elo_change }}
                  </p>
                </div>
              </div>
              <div class="space-y-4">
                <div class="p-4 rounded-xl bg-surface border border-border-subtle">
                  <p class="text-size-4 text-foreground-muted mb-1">Rank Antes</p>
                  <p class="text-size-2 font-bold text-foreground">{{ matchImpact.player1_impact.rank_before || 'N/A' }}</p>
                </div>
                <div class="p-4 rounded-xl bg-surface border border-border-subtle">
                  <p class="text-size-4 text-foreground-muted mb-1">Rank Después</p>
                  <p class="text-size-2 font-bold text-foreground">{{ matchImpact.player1_impact.rank_after || 'N/A' }}</p>
                </div>
                <div class="p-4 rounded-xl bg-surface border border-border-subtle">
                  <p class="text-size-4 text-foreground-muted mb-1">Cambio de Rank</p>
                  <p 
                    class="text-size-2 font-bold"
                    :class="matchImpact.player1_impact.rank_change && matchImpact.player1_impact.rank_change > 0 ? 'text-green-400' : matchImpact.player1_impact.rank_change && matchImpact.player1_impact.rank_change < 0 ? 'text-red-400' : 'text-foreground'"
                  >
                    {{ matchImpact.player1_impact.rank_change ? (matchImpact.player1_impact.rank_change > 0 ? '+' : '') + matchImpact.player1_impact.rank_change : 'N/A' }}
                  </p>
                </div>
              </div>
            </div>
            <div v-if="matchImpact.player1_impact.tier_changed" class="mt-4 p-4 rounded-xl bg-accent-subtle/30 border border-accent/30">
              <p class="text-size-4 font-semibold text-foreground mb-2">Cambio de Tier</p>
              <div class="flex items-center gap-2">
                <span class="px-2 py-1 rounded text-size-4" :style="{ color: getTierColor(matchImpact.player1_impact.tier_before) }">
                  {{ matchImpact.player1_impact.tier_before }}
                </span>
                <Icon name="heroicons:arrow-right" class="w-4 h-4 text-foreground-muted" />
                <span class="px-2 py-1 rounded text-size-4" :style="{ color: getTierColor(matchImpact.player1_impact.tier_after) }">
                  {{ matchImpact.player1_impact.tier_after }}
                </span>
              </div>
            </div>
          </div>

          <!-- Player 2 Impact -->
          <div class="panel">
            <h2 class="panel-title">
              Impacto para {{ matchImpact.match.player2?.name }}
            </h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div class="space-y-4">
                <div class="p-4 rounded-xl bg-surface border border-border-subtle">
                  <p class="text-size-4 text-foreground-muted mb-1">SR Antes</p>
                  <p class="text-size-2 font-bold text-foreground">{{ matchImpact.player2_impact.elo_before }}</p>
                </div>
                <div class="p-4 rounded-xl bg-surface border border-border-subtle">
                  <p class="text-size-4 text-foreground-muted mb-1">SR Después</p>
                  <p class="text-size-2 font-bold text-foreground">{{ matchImpact.player2_impact.elo_after }}</p>
                </div>
                <div class="p-4 rounded-xl bg-surface border border-border-subtle">
                  <p class="text-size-4 text-foreground-muted mb-1">Cambio de SR</p>
                  <p 
                    class="text-size-2 font-bold"
                    :class="matchImpact.player2_impact.elo_change >= 0 ? 'text-green-400' : 'text-red-400'"
                  >
                    {{ matchImpact.player2_impact.elo_change >= 0 ? '+' : '' }}{{ matchImpact.player2_impact.elo_change }}
                  </p>
                </div>
              </div>
              <div class="space-y-4">
                <div class="p-4 rounded-xl bg-surface border border-border-subtle">
                  <p class="text-size-4 text-foreground-muted mb-1">Rank Antes</p>
                  <p class="text-size-2 font-bold text-foreground">{{ matchImpact.player2_impact.rank_before || 'N/A' }}</p>
                </div>
                <div class="p-4 rounded-xl bg-surface border border-border-subtle">
                  <p class="text-size-4 text-foreground-muted mb-1">Rank Después</p>
                  <p class="text-size-2 font-bold text-foreground">{{ matchImpact.player2_impact.rank_after || 'N/A' }}</p>
                </div>
                <div class="p-4 rounded-xl bg-surface border border-border-subtle">
                  <p class="text-size-4 text-foreground-muted mb-1">Cambio de Rank</p>
                  <p 
                    class="text-size-2 font-bold"
                    :class="matchImpact.player2_impact.rank_change && matchImpact.player2_impact.rank_change > 0 ? 'text-green-400' : matchImpact.player2_impact.rank_change && matchImpact.player2_impact.rank_change < 0 ? 'text-red-400' : 'text-foreground'"
                  >
                    {{ matchImpact.player2_impact.rank_change ? (matchImpact.player2_impact.rank_change > 0 ? '+' : '') + matchImpact.player2_impact.rank_change : 'N/A' }}
                  </p>
                </div>
              </div>
            </div>
            <div v-if="matchImpact.player2_impact.tier_changed" class="mt-4 p-4 rounded-xl bg-accent-subtle/30 border border-accent/30">
              <p class="text-size-4 font-semibold text-foreground mb-2">Cambio de Tier</p>
              <div class="flex items-center gap-2">
                <span class="px-2 py-1 rounded text-size-4" :style="{ color: getTierColor(matchImpact.player2_impact.tier_before) }">
                  {{ matchImpact.player2_impact.tier_before }}
                </span>
                <Icon name="heroicons:arrow-right" class="w-4 h-4 text-foreground-muted" />
                <span class="px-2 py-1 rounded text-size-4" :style="{ color: getTierColor(matchImpact.player2_impact.tier_after) }">
                  {{ matchImpact.player2_impact.tier_after }}
                </span>
              </div>
            </div>
          </div>

          <!-- Summary -->
          <div class="panel">
            <h2 class="panel-title">Resumen</h2>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="p-4 rounded-xl bg-surface border border-border-subtle">
                <p class="text-size-4 text-foreground-muted mb-1">Cambio Total de SR</p>
                <p class="text-size-2 font-bold text-foreground">{{ matchImpact.summary.total_elo_change }}</p>
              </div>
              <div class="p-4 rounded-xl bg-surface border border-border-subtle">
                <p class="text-size-4 text-foreground-muted mb-1">Cambios de Tier</p>
                <p class="text-size-2 font-bold text-foreground">{{ matchImpact.summary.tier_changes }}</p>
              </div>
              <div class="p-4 rounded-xl bg-surface border border-border-subtle">
                <p class="text-size-4 text-foreground-muted mb-1">Placement Matches</p>
                <p class="text-size-2 font-bold text-foreground">{{ matchImpact.summary.placement_matches }}</p>
              </div>
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
const matchId = route.params.id as string

const { loading, matchImpact, fetchMatchImpact } = useAdminRankings()

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  // Use Ecuador timezone for display
  return date.toLocaleDateString('es-ES', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getTierColor = (tier: string) => {
  const tierColors: Record<string, string> = {
    'Bronze': '#CD7F32',
    'Silver': '#C0C0C0',
    'Gold': '#FFD700',
    'Platinum': '#E5E4E2',
    'Diamond': '#B9F2FF',
    'Master': '#9932CC',
    'Grandmaster': '#FF4500'
  }
  return tierColors[tier] || '#666'
}

onMounted(() => {
  if (matchId) {
    fetchMatchImpact(matchId)
  }
})
</script>
