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
            <Icon name="heroicons:arrow-trending-up" class="w-4 h-4 text-accent" />
            <span class="text-size-4 font-semibold text-accent">Ranking Trends</span>
          </div>
          <h1 class="text-size-1 font-semibold text-foreground mb-4">Tendencias de Rankings</h1>
          <p class="text-size-3 font-regular text-foreground-muted">Análisis histórico de cambios en rankings</p>
        </div>

        <!-- Navigation -->
        <div class="mb-8 flex flex-wrap gap-4">
          <NuxtLink to="/admin/rankings" class="btn-secondary text-size-4">
            <Icon name="heroicons:chart-bar" class="w-4 h-4 mr-2" />
            Estadísticas
          </NuxtLink>
          <NuxtLink to="/admin/rankings/trends" class="btn-primary text-size-4">
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

        <!-- Filters -->
        <div class="glass-card-elevated p-4 md:p-6 mb-6 md:mb-8">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            <div>
              <label class="block text-size-4 font-semibold text-foreground mb-2">Rango de Tiempo</label>
              <select v-model="timeRange" @change="loadTrends" class="w-full px-4 py-2 rounded-lg bg-surface border-2 border-border text-foreground focus:border-accent focus:outline-none">
                <option value="7d">Últimos 7 días</option>
                <option value="30d">Últimos 30 días</option>
                <option value="90d">Últimos 90 días</option>
                <option value="1y">Último año</option>
              </select>
            </div>
            <div>
              <label class="block text-size-4 font-semibold text-foreground mb-2">Granularidad</label>
              <select v-model="granularity" @change="loadTrends" class="w-full px-4 py-2 rounded-lg bg-surface border-2 border-border text-foreground focus:border-accent focus:outline-none">
                <option value="daily">Diaria</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensual</option>
              </select>
            </div>
            <div class="flex items-end">
              <button @click="loadTrends" class="btn-primary text-size-4 w-full">
                <Icon name="heroicons:arrow-path" class="w-4 h-4 mr-2" />
                Actualizar
              </button>
            </div>
          </div>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="glass-card-elevated p-12 text-center">
          <Icon name="heroicons:arrow-path" class="w-8 h-8 text-accent animate-spin mx-auto mb-4" />
          <p class="text-size-3 text-foreground-muted">Cargando tendencias...</p>
        </div>

        <!-- Error -->
        <div v-else-if="error" class="glass-card-elevated p-10 max-w-md mx-auto">
          <Icon name="heroicons:exclamation-triangle" class="w-10 h-10 text-red-400 mx-auto mb-4" />
          <p class="text-size-4 text-foreground-muted text-center">{{ error.message }}</p>
        </div>

        <!-- Trends Content -->
        <div v-else-if="rankingTrends" class="space-y-8">
          <!-- Average ELO Over Time -->
          <div class="glass-card-elevated p-6 md:p-8">
            <h2 class="text-size-2 font-semibold text-foreground mb-6">SR Promedio en el Tiempo</h2>
            <AdminRankingTrendsChart :data="rankingTrends.trends" metric="average_elo" />
          </div>

          <!-- Tier Population Changes -->
          <div class="glass-card-elevated p-6 md:p-8">
            <h2 class="text-size-2 font-semibold text-foreground mb-6">Cambios en Población por Tier</h2>
            <div class="space-y-4">
              <div v-for="tier in ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Grandmaster']" :key="tier">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-size-4 font-semibold text-foreground">{{ tier }}</span>
                  <span class="text-size-4 text-foreground-muted">
                    {{ getCurrentTierCount(tier) }} jugadores
                  </span>
                </div>
                <AdminRankingTrendsChart 
                  :data="rankingTrends.trends.map(t => ({ date: t.date, average_elo: t.tier_population[tier] || 0 }))" 
                  :metric="'average_elo'"
                />
              </div>
            </div>
          </div>

          <!-- New Players -->
          <div class="glass-card-elevated p-6 md:p-8">
            <h2 class="text-size-2 font-semibold text-foreground mb-6">Nuevos Jugadores Entrando</h2>
            <AdminRankingTrendsChart :data="rankingTrends.trends" metric="new_players" />
          </div>

          <!-- Tier Promotions/Demotions -->
          <div class="glass-card-elevated p-6 md:p-8">
            <h2 class="text-size-2 font-semibold text-foreground mb-6">Promociones y Demociones</h2>
            <AdminRankingTrendsChart :data="rankingTrends.trends" metric="tier_promotions" />
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

const { loading, error, rankingTrends, fetchRankingTrends } = useAdminRankings()

const timeRange = ref('30d')
const granularity = ref('daily')

const loadTrends = async () => {
  try {
    await fetchRankingTrends({
      time_range: timeRange.value,
      granularity: granularity.value
    })
  } catch (err) {
    console.error('Error loading trends:', err)
  }
}

const getCurrentTierCount = (tier: string) => {
  if (!rankingTrends.value?.trends || rankingTrends.value.trends.length === 0) return 0
  const lastTrend = rankingTrends.value.trends[rankingTrends.value.trends.length - 1]
  return lastTrend.tier_population?.[tier] || 0
}

onMounted(() => {
  loadTrends()
})
</script>
