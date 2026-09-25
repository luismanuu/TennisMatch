<template>
  <PageLayout container-size="medium">
        <PageHeader title="Tendencias de Rankings" subtitle="Análisis histórico de cambios en rankings" back-to="/admin/rankings" back-label="Volver a rankings" />

        <!-- Navigation -->
        <div class="mb-8 flex flex-wrap gap-4">
          <NuxtLink to="/admin/rankings" class="btn-secondary text-size-4">
            <Icon name="heroicons:chart-bar" class="w-4 h-4" />
            Estadísticas
          </NuxtLink>
          <NuxtLink to="/admin/rankings/trends" class="btn-primary text-size-4">
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
          <NuxtLink to="/admin/rankings/health" class="btn-secondary text-size-4">
            <Icon name="heroicons:heart" class="w-4 h-4" />
            Health
          </NuxtLink>
        </div>

        <!-- Filters -->
        <div class="panel mb-6 md:mb-8">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            <div>
              <label class="form-label">Rango de Tiempo</label>
              <select v-model="timeRange" @change="loadTrends" class="form-select">
                <option value="7d">Últimos 7 días</option>
                <option value="30d">Últimos 30 días</option>
                <option value="90d">Últimos 90 días</option>
                <option value="1y">Último año</option>
              </select>
            </div>
            <div>
              <label class="form-label">Granularidad</label>
              <select v-model="granularity" @change="loadTrends" class="form-select">
                <option value="daily">Diaria</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensual</option>
              </select>
            </div>
            <div class="flex items-end">
              <button @click="loadTrends" class="btn-primary text-size-4 w-full">
                <Icon name="heroicons:arrow-path" class="w-4 h-4" />
                Actualizar
              </button>
            </div>
          </div>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="panel loading-state" aria-busy="true">
          <Icon name="heroicons:arrow-path" class="loading-spinner animate-spin" aria-hidden="true" />
          <p class="loading-text">Cargando tendencias…</p>
        </div>

        <!-- Error -->
        <div v-else-if="error" class="panel max-w-md mx-auto">
          <Icon name="heroicons:exclamation-triangle" class="w-10 h-10 text-red-400 mx-auto mb-4" />
          <p class="text-size-4 text-foreground-muted text-center">{{ error.message }}</p>
        </div>

        <!-- Trends Content -->
        <div v-else-if="rankingTrends" class="space-y-8">
          <!-- Average ELO Over Time -->
          <div class="panel">
            <h2 class="panel-title">SR Promedio en el Tiempo</h2>
            <AdminRankingTrendsChart :data="rankingTrends.trends" metric="average_elo" />
          </div>

          <!-- Tier Population Changes -->
          <div class="panel">
            <h2 class="panel-title">Cambios en Población por Tier</h2>
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
          <div class="panel">
            <h2 class="panel-title">Nuevos Jugadores Entrando</h2>
            <AdminRankingTrendsChart :data="rankingTrends.trends" metric="new_players" />
          </div>

          <!-- Tier Promotions/Demotions -->
          <div class="panel">
            <h2 class="panel-title">Promociones y Demociones</h2>
            <AdminRankingTrendsChart :data="rankingTrends.trends" metric="tier_promotions" />
          </div>
        </div>
  </PageLayout>
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
