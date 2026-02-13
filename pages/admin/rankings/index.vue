<template>
  <div class="min-h-screen bg-background relative overflow-hidden">
    <!-- Ambient Background Effects -->
    <div class="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <div class="orb orb-accent w-96 h-96 -top-48 -right-48 animate-float opacity-20"></div>
      <div class="orb orb-secondary w-80 h-80 -bottom-40 -left-40 animate-float-delayed opacity-15"></div>
      <div class="grid-pattern absolute inset-0 opacity-30"></div>
    </div>

    <!-- Navigation -->
    <AppNavigation />
    
    <!-- Spacer for fixed nav -->
    <div class="h-16"></div>

    <div class="section-padding relative z-10">
      <div class="container-medium px-6">
        <!-- Header -->
        <div class="text-center mb-12 animate-fade-up">
          <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-subtle/30 border border-accent/30 backdrop-blur-sm mb-6">
            <Icon name="heroicons:chart-bar" class="w-4 h-4 text-accent" />
            <span class="text-size-4 font-semibold text-accent">Rankings Dashboard</span>
          </div>
          <h1 class="text-size-1 font-semibold text-foreground mb-4">
            Estadísticas de Rankings
          </h1>
          <p class="text-size-3 font-regular text-foreground-muted">
            Análisis completo del sistema de rankings y leaderboards
          </p>
        </div>

        <!-- Navigation Tabs -->
        <div class="mb-8 animate-fade-up animate-delay-1">
          <div class="flex flex-wrap gap-4">
            <NuxtLink to="/admin/rankings" class="btn-primary text-size-4">
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
            <NuxtLink to="/admin/rankings/decay" class="btn-secondary text-size-4">
              <Icon name="heroicons:arrow-down" class="w-4 h-4 mr-2" />
              Decay
            </NuxtLink>
            <NuxtLink to="/admin/rankings/health" class="btn-secondary text-size-4">
              <Icon name="heroicons:heart" class="w-4 h-4 mr-2" />
              Health
            </NuxtLink>
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="glass-card-elevated p-12 text-center animate-fade-in-scale">
          <div class="w-16 h-16 rounded-full bg-accent-subtle flex items-center justify-center mx-auto mb-6">
            <Icon name="heroicons:arrow-path" class="w-8 h-8 text-accent animate-spin" />
          </div>
          <p class="text-size-3 font-regular text-foreground-muted">Cargando estadísticas...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="glass-card-elevated p-10 max-w-md mx-auto animate-fade-in-scale">
          <div class="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
            <Icon name="heroicons:exclamation-triangle" class="w-10 h-10 text-red-400" />
          </div>
          <h3 class="text-size-2 font-semibold text-foreground mb-3 text-center">Error</h3>
          <p class="text-size-4 font-regular text-foreground-muted mb-6 text-center">{{ error.message || 'Ocurrió un error' }}</p>
          <button @click="loadStats" class="btn-primary text-size-3 w-full justify-center group">
            <Icon name="heroicons:arrow-path" class="w-5 h-5 mr-2 group-hover:rotate-180 transition-transform duration-500" />
            Reintentar
          </button>
        </div>

        <!-- Statistics Content -->
        <div v-else-if="rankingStats" class="space-y-8">
          <!-- Overview Cards -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <div class="glass-card-elevated p-6 hover-lift animate-fade-up" style="animation-delay: 0.1s">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-size-3 font-semibold text-foreground-muted">Jugadores Calificados</h3>
                <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 border-2 border-blue-500/30 flex items-center justify-center">
                  <Icon name="heroicons:users" class="w-6 h-6 text-blue-400" />
                </div>
              </div>
              <p class="text-size-1 font-bold text-foreground mb-2">{{ rankingStats.total_rated_players }}</p>
              <p class="text-size-4 text-foreground-muted">{{ rankingStats.players_in_placement }} en placement</p>
            </div>

            <div class="glass-card-elevated p-6 hover-lift animate-fade-up" style="animation-delay: 0.2s">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-size-3 font-semibold text-foreground-muted">SR Promedio</h3>
                <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-accent/20 to-accent/5 border-2 border-accent/30 flex items-center justify-center">
                  <Icon name="heroicons:star" class="w-6 h-6 text-accent" />
                </div>
              </div>
              <p class="text-size-1 font-bold text-foreground mb-2">{{ rankingStats.average_elo }}</p>
              <p class="text-size-4 text-foreground-muted">Promedio global</p>
            </div>

            <div class="glass-card-elevated p-6 hover-lift animate-fade-up" style="animation-delay: 0.3s">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-size-3 font-semibold text-foreground-muted">En Placement</h3>
                <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500/20 to-yellow-500/5 border-2 border-yellow-500/30 flex items-center justify-center">
                  <Icon name="heroicons:clock" class="w-6 h-6 text-yellow-400" />
                </div>
              </div>
              <p class="text-size-1 font-bold text-foreground mb-2">{{ rankingStats.players_in_placement }}</p>
              <p class="text-size-4 text-foreground-muted">Jugadores nuevos</p>
            </div>

            <div class="glass-card-elevated p-6 hover-lift animate-fade-up" style="animation-delay: 0.4s">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-size-3 font-semibold text-foreground-muted">En Riesgo de Decay</h3>
                <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500/20 to-red-500/5 border-2 border-red-500/30 flex items-center justify-center">
                  <Icon name="heroicons:exclamation-triangle" class="w-6 h-6 text-red-400" />
                </div>
              </div>
              <p class="text-size-1 font-bold text-foreground mb-2">{{ rankingStats.players_at_decay_risk }}</p>
              <p class="text-size-4 text-foreground-muted">Inactivos este mes</p>
            </div>
          </div>

          <!-- Tier Distribution -->
          <div class="glass-card-elevated p-4 md:p-6 lg:p-8 hover-lift animate-fade-up animate-delay-2">
            <div class="flex items-center gap-3 mb-6">
              <Icon name="heroicons:chart-pie" class="w-5 h-5 md:w-6 md:h-6 text-accent" />
              <h2 class="text-size-3 md:text-size-2 font-semibold text-foreground">Distribución por Tier</h2>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mb-6">
              <div 
                v-for="(count, tier) in rankingStats.players_by_tier" 
                :key="tier"
                class="p-4 rounded-xl bg-surface border-2 border-border-subtle hover:border-accent/50 hover:bg-surface-elevated transition-all"
              >
                <div class="flex items-center justify-between mb-3">
                  <p class="text-size-2 md:text-size-1 font-semibold text-foreground">{{ tier }}</p>
                  <span 
                    class="px-3 py-1 rounded-lg text-size-4 font-semibold"
                    :style="{ color: getTierColor(String(tier)), backgroundColor: getTierColor(String(tier)) + '20' }"
                  >
                    {{ tier }}
                  </span>
                </div>
                <div class="space-y-2">
                  <div>
                    <p class="text-size-4 text-foreground-muted mb-1">Jugadores</p>
                    <p class="text-size-1 md:text-size-0 font-bold text-accent">{{ count }}</p>
                  </div>
                  <div class="flex items-center justify-between pt-2 border-t border-border-subtle">
                    <div>
                      <p class="text-size-5 text-foreground-muted mb-1">Porcentaje</p>
                      <p class="text-size-3 font-semibold text-foreground">{{ rankingStats.tier_distribution_percentages[tier] }}%</p>
                    </div>
                    <div class="text-right">
                      <p class="text-size-5 text-foreground-muted mb-1">SR Promedio</p>
                      <p class="text-size-3 font-semibold text-foreground">{{ rankingStats.average_elo_by_tier[tier] || 0 }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="rankingStats.players_by_tier && Object.keys(rankingStats.players_by_tier).length > 0">
              <TierDistributionChart :data="rankingStats.players_by_tier" />
            </div>
            <div v-else class="flex items-center justify-center h-48 text-foreground-muted">
              <div class="text-center">
                <Icon name="heroicons:chart-pie" class="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p class="text-size-3 font-semibold mb-2">No hay datos de distribución de tiers</p>
                <p class="text-size-4">Los jugadores aún no tienen suficientes partidos para generar estadísticas</p>
              </div>
            </div>
          </div>

          <!-- ELO Distribution Histogram -->
          <div class="glass-card-elevated p-4 md:p-6 lg:p-8 hover-lift animate-fade-up animate-delay-3">
            <div class="flex items-center gap-3 mb-4 md:mb-6">
              <Icon name="heroicons:chart-bar" class="w-5 h-5 md:w-6 md:h-6 text-accent" />
              <h2 class="text-size-3 md:text-size-2 font-semibold text-foreground">Distribución de SR</h2>
            </div>
            <div class="w-full">
              <EloDistributionHistogram 
                v-if="rankingStats.elo_distribution && rankingStats.elo_distribution.length > 0"
                :data="rankingStats.elo_distribution" 
              />
              <div v-else class="flex items-center justify-center h-48 md:h-64 text-foreground-muted">
                <div class="text-center px-4">
                  <Icon name="heroicons:chart-bar" class="w-10 h-10 md:w-12 md:h-12 mx-auto mb-4 opacity-50" />
                  <p class="text-size-4 md:text-size-3 font-semibold mb-2">No hay datos de distribución de SR</p>
                  <p class="text-size-5 md:text-size-4">Los jugadores aún no tienen suficientes partidos para generar estadísticas</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Activity Metrics -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            <!-- Players with Streaks -->
            <div class="glass-card-elevated p-6 hover-lift animate-fade-up animate-delay-4">
              <div class="flex items-center gap-3 mb-6">
                <Icon name="heroicons:fire" class="w-6 h-6 text-accent" />
                <h2 class="text-size-2 font-semibold text-foreground">Rachas Activas</h2>
              </div>
              <div v-if="rankingStats.players_with_streaks && (rankingStats.players_with_streaks.win_streaks > 0 || rankingStats.players_with_streaks.loss_streaks > 0)" class="space-y-4">
                <div class="p-4 rounded-xl bg-green-500/10 border-2 border-green-500/30">
                  <div class="flex items-center justify-between">
                    <span class="text-size-4 text-foreground-muted">Rachas de Victoria</span>
                    <span class="text-size-2 font-bold text-green-400">{{ rankingStats.players_with_streaks.win_streaks || 0 }}</span>
                  </div>
                </div>
                <div class="p-4 rounded-xl bg-red-500/10 border-2 border-red-500/30">
                  <div class="flex items-center justify-between">
                    <span class="text-size-4 text-foreground-muted">Rachas de Derrota</span>
                    <span class="text-size-2 font-bold text-red-400">{{ rankingStats.players_with_streaks.loss_streaks || 0 }}</span>
                  </div>
                </div>
              </div>
              <div v-else class="flex items-center justify-center h-32 text-foreground-muted">
                <div class="text-center">
                  <Icon name="heroicons:fire" class="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p class="text-size-4">No hay rachas activas</p>
                </div>
              </div>
            </div>

            <!-- Recent Ranking Changes -->
            <div class="glass-card-elevated p-6 hover-lift animate-fade-up animate-delay-5">
              <div class="flex items-center gap-3 mb-6">
                <Icon name="heroicons:arrow-trending-up" class="w-6 h-6 text-accent" />
                <h2 class="text-size-2 font-semibold text-foreground">Cambios Recientes</h2>
              </div>
              <div v-if="rankingStats.recent_ranking_changes && (rankingStats.recent_ranking_changes.last_7_days > 0 || rankingStats.recent_ranking_changes.last_30_days > 0)" class="space-y-4">
                <div class="p-4 rounded-xl bg-blue-500/10 border-2 border-blue-500/30">
                  <div class="flex items-center justify-between">
                    <span class="text-size-4 text-foreground-muted">Últimos 7 días</span>
                    <span class="text-size-2 font-bold text-blue-400">{{ rankingStats.recent_ranking_changes.last_7_days || 0 }}</span>
                  </div>
                </div>
                <div class="p-4 rounded-xl bg-purple-500/10 border-2 border-purple-500/30">
                  <div class="flex items-center justify-between">
                    <span class="text-size-4 text-foreground-muted">Últimos 30 días</span>
                    <span class="text-size-2 font-bold text-purple-400">{{ rankingStats.recent_ranking_changes.last_30_days || 0 }}</span>
                  </div>
                </div>
              </div>
              <div v-else class="flex items-center justify-center h-32 text-foreground-muted">
                <div class="text-center">
                  <Icon name="heroicons:arrow-trending-up" class="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p class="text-size-4">No hay cambios recientes</p>
                </div>
              </div>
            </div>
          </div>

          <!-- City and Category Distribution -->
          <div class="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
            <!-- City-wise Distribution -->
            <div class="glass-card-elevated p-4 md:p-6 hover-lift animate-fade-up animate-delay-6">
              <div class="flex items-center gap-3 mb-4 md:mb-6">
                <Icon name="heroicons:map" class="w-5 h-5 md:w-6 md:h-6 text-accent" />
                <h2 class="text-size-3 md:text-size-2 font-semibold text-foreground">Distribución por Ciudad</h2>
              </div>
              <div v-if="rankingStats.city_wise_tier_distribution && Object.keys(rankingStats.city_wise_tier_distribution).length > 0" class="space-y-2 md:space-y-3 max-h-96 overflow-y-auto">
                <div 
                  v-for="(tiers, city) in rankingStats.city_wise_tier_distribution" 
                  :key="city"
                  class="p-4 rounded-xl bg-surface border border-border-subtle"
                >
                  <p class="text-size-3 font-semibold text-foreground mb-3">{{ city }}</p>
                  <div class="grid grid-cols-2 gap-2">
                    <div 
                      v-for="(count, tier) in tiers" 
                      :key="tier"
                      class="text-size-4"
                    >
                      <span class="text-foreground-muted">{{ tier }}:</span>
                      <span class="font-semibold text-foreground ml-1">{{ count }}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="flex items-center justify-center h-48 text-foreground-muted">
                <div class="text-center">
                  <Icon name="heroicons:map" class="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p class="text-size-4 font-semibold mb-1">No hay datos por ciudad</p>
                  <p class="text-size-5">Los jugadores aún no tienen ciudades asignadas</p>
                </div>
              </div>
            </div>

            <!-- Category-wise Distribution -->
            <div class="glass-card-elevated p-4 md:p-6 hover-lift animate-fade-up animate-delay-7">
              <div class="flex items-center gap-3 mb-4 md:mb-6">
                <Icon name="heroicons:tag" class="w-5 h-5 md:w-6 md:h-6 text-accent" />
                <h2 class="text-size-3 md:text-size-2 font-semibold text-foreground">Distribución por Categoría</h2>
              </div>
              <div v-if="rankingStats.category_wise_tier_distribution && Object.keys(rankingStats.category_wise_tier_distribution).length > 0" class="space-y-2 md:space-y-3 max-h-96 overflow-y-auto">
                <div 
                  v-for="(tiers, category) in rankingStats.category_wise_tier_distribution" 
                  :key="category"
                  class="p-4 rounded-xl bg-surface border border-border-subtle"
                >
                  <p class="text-size-3 font-semibold text-foreground mb-3">{{ category }}</p>
                  <div class="grid grid-cols-2 gap-2">
                    <div 
                      v-for="(count, tier) in tiers" 
                      :key="tier"
                      class="text-size-4"
                    >
                      <span class="text-foreground-muted">{{ tier }}:</span>
                      <span class="font-semibold text-foreground ml-1">{{ count }}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="flex items-center justify-center h-48 text-foreground-muted">
                <div class="text-center">
                  <Icon name="heroicons:tag" class="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p class="text-size-4 font-semibold mb-1">No hay datos por categoría</p>
                  <p class="text-size-5">Los jugadores aún no tienen categorías asignadas</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import TierDistributionChart from '~/components/admin/TierDistributionChart.vue'
import EloDistributionHistogram from '~/components/admin/EloDistributionHistogram.vue'

definePageMeta({
  middleware: ['admin']
})

const { loading, error, rankingStats, fetchRankingStats } = useAdminRankings()

const loadStats = async () => {
  try {
    await fetchRankingStats()
  } catch (err) {
    console.error('Error loading ranking stats:', err)
  }
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
  loadStats()
})
</script>
