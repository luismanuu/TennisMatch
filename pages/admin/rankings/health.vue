<template>
  <PageLayout container-size="medium">
        <PageHeader title="Health Check del Sistema de Rankings" subtitle="Monitoreo de la salud del sistema de rankings" back-to="/admin/rankings" back-label="Volver a rankings" />

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
          <NuxtLink to="/admin/rankings/placement" class="btn-secondary text-size-4">
            <Icon name="heroicons:clock" class="w-4 h-4" />
            Placement
          </NuxtLink>
          <NuxtLink to="/admin/rankings/decay" class="btn-secondary text-size-4">
            <Icon name="heroicons:arrow-down" class="w-4 h-4" />
            Decay
          </NuxtLink>
          <NuxtLink to="/admin/rankings/health" class="btn-primary text-size-4">
            <Icon name="heroicons:heart" class="w-4 h-4" />
            Health
          </NuxtLink>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="panel loading-state" aria-busy="true">
          <Icon name="heroicons:arrow-path" class="loading-spinner animate-spin" aria-hidden="true" />
          <p class="loading-text">Ejecutando health check…</p>
        </div>

        <!-- Health Content -->
        <div v-else-if="rankingHealth" class="space-y-8">
          <!-- Health Score -->
          <div class="panel">
            <div class="flex items-center justify-between mb-6">
              <h2 class="text-size-2 font-semibold text-foreground">Health Score</h2>
              <div 
                class="px-4 py-2 rounded-full text-size-3 font-bold"
                :class="{
                  'bg-green-500/20 text-green-400': rankingHealth.health_status === 'healthy',
                  'bg-yellow-500/20 text-yellow-400': rankingHealth.health_status === 'warning',
                  'bg-red-500/20 text-red-400': rankingHealth.health_status === 'critical'
                }"
              >
                {{ rankingHealth.health_score }}/100
              </div>
            </div>
            <div class="w-full bg-surface border border-border-subtle rounded-full h-4 overflow-hidden">
              <div 
                class="h-full transition-all duration-300"
                :class="{
                  'bg-green-500': rankingHealth.health_score >= 80,
                  'bg-yellow-500': rankingHealth.health_score >= 60 && rankingHealth.health_score < 80,
                  'bg-red-500': rankingHealth.health_score < 60
                }"
                :style="{ width: `${rankingHealth.health_score}%` }"
              />
            </div>
          </div>

          <!-- Consistency Checks -->
          <div class="panel">
            <h2 class="text-size-3 md:text-size-2 font-semibold text-foreground mb-4 md:mb-6">Consistencia de Ratings</h2>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-6">
              <div class="p-4 rounded-xl bg-surface border border-border-subtle">
                <p class="text-size-4 text-foreground-muted mb-1">Verificados</p>
                <p class="text-size-2 font-bold text-foreground">{{ rankingHealth.consistency_checks.total_checked }}</p>
              </div>
              <div class="p-4 rounded-xl bg-surface border border-border-subtle">
                <p class="text-size-4 text-foreground-muted mb-1">Inconsistentes</p>
                <p class="text-size-2 font-bold text-red-400">{{ rankingHealth.consistency_checks.inconsistent }}</p>
              </div>
              <div class="p-4 rounded-xl bg-surface border border-border-subtle">
                <p class="text-size-4 text-foreground-muted mb-1">Tasa de Consistencia</p>
                <p class="text-size-2 font-bold text-foreground">
                  {{ ((rankingHealth.consistency_checks.total_checked - rankingHealth.consistency_checks.inconsistent) / rankingHealth.consistency_checks.total_checked * 100).toFixed(1) }}%
                </p>
              </div>
            </div>
            <div v-if="rankingHealth.consistency_checks.issues.length > 0" class="space-y-2">
              <p class="text-size-4 font-semibold text-foreground mb-2">Jugadores con Inconsistencias:</p>
              <div 
                v-for="issue in rankingHealth.consistency_checks.issues.slice(0, 10)" 
                :key="issue.player_id"
                class="p-3 rounded-lg bg-red-500/10 border border-red-500/30"
              >
                <p class="text-size-4 font-semibold text-foreground">{{ issue.player_name }}</p>
                <p class="text-size-5 text-foreground-muted">
                  SR Esperado: {{ issue.expected_elo }}, SR Actual: {{ issue.actual_elo }}, Diferencia: {{ issue.difference }}
                </p>
              </div>
            </div>
          </div>

          <!-- Unusual Changes -->
          <div class="panel">
            <h2 class="panel-title">Cambios Inusuales de SR</h2>
            <div class="mb-4">
              <p class="text-size-4 text-foreground-muted">Total: {{ rankingHealth.unusual_elo_changes.total }} cambios inusuales en los últimos 7 días</p>
            </div>
            <div v-if="rankingHealth.unusual_elo_changes.changes.length > 0" class="space-y-2">
              <div 
                v-for="change in rankingHealth.unusual_elo_changes.changes" 
                :key="change.player_id + change.date"
                class="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30"
              >
                <p class="text-size-4 font-semibold text-foreground">{{ change.player_name }}</p>
                <p class="text-size-5 text-foreground-muted">
                  Cambio: {{ change.elo_change >= 0 ? '+' : '' }}{{ change.elo_change }} SR el {{ formatDate(change.date) }}
                </p>
              </div>
            </div>
          </div>

          <!-- Placement Stats -->
          <div class="panel">
            <h2 class="text-size-3 md:text-size-2 font-semibold text-foreground mb-4 md:mb-6">Estadísticas de Placement</h2>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              <div class="p-4 rounded-xl bg-surface border border-border-subtle">
                <p class="text-size-4 text-foreground-muted mb-1">Total</p>
                <p class="text-size-2 font-bold text-foreground">{{ rankingHealth.placement_match_stats.total_in_placement }}</p>
              </div>
              <div class="p-4 rounded-xl bg-surface border border-border-subtle">
                <p class="text-size-4 text-foreground-muted mb-1">0/3</p>
                <p class="text-size-2 font-bold text-foreground">{{ rankingHealth.placement_match_stats.completed_0 }}</p>
              </div>
              <div class="p-4 rounded-xl bg-surface border border-border-subtle">
                <p class="text-size-4 text-foreground-muted mb-1">1/3</p>
                <p class="text-size-2 font-bold text-foreground">{{ rankingHealth.placement_match_stats.completed_1 }}</p>
              </div>
              <div class="p-4 rounded-xl bg-surface border border-border-subtle">
                <p class="text-size-4 text-foreground-muted mb-1">Tasa de Completación</p>
                <p class="text-size-2 font-bold text-foreground">{{ rankingHealth.placement_match_stats.completion_rate }}%</p>
              </div>
            </div>
          </div>

          <!-- Decay Stats -->
          <div class="panel">
            <h2 class="text-size-3 md:text-size-2 font-semibold text-foreground mb-4 md:mb-6">Estadísticas de Decay</h2>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              <div class="p-4 rounded-xl bg-surface border border-border-subtle">
                <p class="text-size-4 text-foreground-muted mb-1">Elegibles</p>
                <p class="text-size-2 font-bold text-foreground">{{ rankingHealth.decay_stats.players_eligible }}</p>
              </div>
              <div class="p-4 rounded-xl bg-surface border border-border-subtle">
                <p class="text-size-4 text-foreground-muted mb-1">En Riesgo</p>
                <p class="text-size-2 font-bold text-red-400">{{ rankingHealth.decay_stats.players_at_risk }}</p>
              </div>
              <div class="p-4 rounded-xl bg-surface border border-border-subtle">
                <p class="text-size-4 text-foreground-muted mb-1">Exentos</p>
                <p class="text-size-2 font-bold text-foreground">{{ rankingHealth.decay_stats.players_exempt }}</p>
              </div>
              <div class="p-4 rounded-xl bg-surface border border-border-subtle">
                <p class="text-size-4 text-foreground-muted mb-1">Última Verificación</p>
                <p class="text-size-2 font-bold text-foreground">
                  {{ rankingHealth.decay_stats.last_decay_check ? formatDate(rankingHealth.decay_stats.last_decay_check) : 'N/A' }}
                </p>
              </div>
            </div>
          </div>

          <!-- Rating Errors -->
          <div class="panel">
            <h2 class="panel-title">Errores de Cálculo</h2>
            <div class="mb-4">
              <p class="text-size-4 text-foreground-muted">Total: {{ rankingHealth.rating_calculation_errors.total }} errores encontrados</p>
            </div>
            <div v-if="rankingHealth.rating_calculation_errors.errors.length > 0" class="space-y-2">
              <div 
                v-for="error in rankingHealth.rating_calculation_errors.errors" 
                :key="error.match_id"
                class="p-3 rounded-lg bg-red-500/10 border border-red-500/30"
              >
                <p class="text-size-4 font-semibold text-foreground">Match ID: {{ error.match_id }}</p>
                <p class="text-size-5 text-foreground-muted">{{ error.issue }} - {{ formatDate(error.date) }}</p>
              </div>
            </div>
          </div>

          <!-- Recommendations -->
          <div class="panel">
            <h2 class="panel-title">Recomendaciones</h2>
            <div class="space-y-3">
              <div 
                v-for="(recommendation, index) in rankingHealth.recommendations" 
                :key="index"
                class="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30"
              >
                <div class="flex items-start gap-3">
                  <Icon name="heroicons:information-circle" class="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <p class="text-size-4 text-foreground">{{ recommendation }}</p>
                </div>
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

const { loading, rankingHealth, fetchRankingHealth } = useAdminRankings()

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
  fetchRankingHealth()
})
</script>
