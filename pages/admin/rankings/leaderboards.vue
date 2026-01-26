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
            <Icon name="heroicons:trophy" class="w-4 h-4 text-accent" />
            <span class="text-size-4 font-semibold text-accent">Leaderboards</span>
          </div>
          <h1 class="text-size-1 font-semibold text-foreground mb-4">Vista de Leaderboards</h1>
          <p class="text-size-3 font-regular text-foreground-muted">Explora y compara leaderboards con diferentes filtros</p>
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
          <NuxtLink to="/admin/rankings/leaderboards" class="btn-primary text-size-4">
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
        <div class="glass-card-elevated p-4 sm:p-6 mb-8">
          <h2 class="text-size-2 font-semibold text-foreground mb-4">Filtros</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label class="block text-size-4 font-semibold text-foreground mb-2">Ciudad</label>
              <select v-model="filters.city_id" @change="loadLeaderboard(true)" class="w-full px-4 py-2 rounded-lg bg-surface border-2 border-border text-foreground focus:border-accent focus:outline-none">
                <option value="">Todas las ciudades</option>
                <option v-for="city in cities" :key="city.id" :value="city.id">{{ city.name }}</option>
              </select>
            </div>
            <div>
              <label class="block text-size-4 font-semibold text-foreground mb-2">Categoría</label>
              <select v-model="filters.category_id" @change="loadLeaderboard(true)" class="w-full px-4 py-2 rounded-lg bg-surface border-2 border-border text-foreground focus:border-accent focus:outline-none">
                <option value="">Todas las categorías</option>
                <option v-for="category in categories" :key="category.id" :value="category.id">{{ category.name }}</option>
              </select>
            </div>
            <div>
              <label class="block text-size-4 font-semibold text-foreground mb-2">Tier</label>
              <select v-model="filters.tier" @change="loadLeaderboard(true)" class="w-full px-4 py-2 rounded-lg bg-surface border-2 border-border text-foreground focus:border-accent focus:outline-none">
                <option value="">Todos los tiers</option>
                <option value="Bronze">Bronze</option>
                <option value="Silver">Silver</option>
                <option value="Gold">Gold</option>
                <option value="Platinum">Platinum</option>
                <option value="Diamond">Diamond</option>
                <option value="Master">Master</option>
                <option value="Grandmaster">Grandmaster</option>
              </select>
            </div>
            <div>
              <label class="block text-size-4 font-semibold text-foreground mb-2">Búsqueda</label>
              <input
                v-model="filters.search"
                type="text"
                placeholder="Buscar por nombre..."
                @input="debouncedSearch"
                class="w-full px-4 py-2 rounded-lg bg-surface border-2 border-border text-foreground focus:border-accent focus:outline-none"
              />
            </div>
          </div>
          <div class="flex flex-col sm:flex-row gap-4 mt-4">
            <button @click="loadLeaderboard(true)" class="btn-primary text-size-4">
              <Icon name="heroicons:magnifying-glass" class="w-4 h-4 mr-2" />
              Aplicar Filtros
            </button>
            <button @click="exportLeaderboard('csv')" class="btn-secondary text-size-4">
              <Icon name="heroicons:arrow-down-tray" class="w-4 h-4 mr-2" />
              Exportar CSV
            </button>
            <button @click="exportLeaderboard('json')" class="btn-secondary text-size-4">
              <Icon name="heroicons:arrow-down-tray" class="w-4 h-4 mr-2" />
              Exportar JSON
            </button>
            <button @click="clearFilters" class="btn-secondary text-size-4">
              <Icon name="heroicons:x-mark" class="w-4 h-4 mr-2" />
              Limpiar
            </button>
          </div>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="glass-card-elevated p-12 text-center">
          <Icon name="heroicons:arrow-path" class="w-8 h-8 text-accent animate-spin mx-auto mb-4" />
          <p class="text-size-3 text-foreground-muted">Cargando leaderboard...</p>
        </div>

        <!-- No Data -->
        <div v-else-if="!loading && leaderboards.length === 0" class="glass-card-elevated p-12 text-center">
          <Icon name="heroicons:trophy" class="w-16 h-16 text-foreground-muted mx-auto mb-4 opacity-50" />
          <h2 class="text-size-2 font-semibold text-foreground mb-2">No hay jugadores en el leaderboard</h2>
          <p class="text-size-4 text-foreground-muted mb-6">
            No se encontraron jugadores con los filtros aplicados. Intenta ajustar los filtros o verifica que haya jugadores activos.
          </p>
          <button @click="clearFilters" class="btn-primary text-size-4">
            <Icon name="heroicons:x-mark" class="w-4 h-4 mr-2" />
            Limpiar Filtros
          </button>
        </div>

        <!-- Leaderboard Table -->
        <div v-else class="glass-card-elevated overflow-hidden">
          <AdminLeaderboardTable
            :data="leaderboards"
            :columns="tableColumns"
            :loading="loading"
            :pagination="true"
            :page-size="pageSize"
            :current-page="currentPage"
            :total="leaderboardTotal"
            @page-change="handlePageChange"
          >
            <template #cell-rating_tier="{ row }">
              <span 
                class="px-2 py-1 rounded text-size-4 font-semibold"
                :style="{ color: getTierColor(row.rating_tier), backgroundColor: getTierColor(row.rating_tier) + '20' }"
              >
                {{ row.rating_tier }}
              </span>
            </template>
            <template #cell-city="{ row }">
              {{ row.city?.name || 'N/A' }}
            </template>
            <template #cell-category="{ row }">
              {{ row.category?.name || 'N/A' }}
            </template>
            <template #actions="{ row }">
              <NuxtLink 
                :to="`/admin/rankings/players/${row.id}`"
                class="btn-primary text-size-4 !py-2 !px-4"
              >
                Ver Detalles
              </NuxtLink>
            </template>
          </AdminLeaderboardTable>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: ['admin']
})

const { loading, leaderboards, leaderboardTotal, leaderboardPage, leaderboardPageSize, fetchLeaderboards } = useAdminRankings()
const { cities, fetchCities } = useCities()
const { categories, fetchCategories } = useCategories()

const filters = ref({
  city_id: '',
  category_id: '',
  tier: '',
  search: ''
})

const pageSize = computed(() => leaderboardPageSize.value)
const currentPage = computed(() => leaderboardPage.value)

const tableColumns = [
  { key: 'rank', label: 'Rank', sortable: true },
  { key: 'name', label: 'Nombre', sortable: true },
  { key: 'elo', label: 'SR', sortable: true },
  { key: 'rating_tier', label: 'Tier', sortable: true },
  { key: 'total_matches_played', label: 'Partidos', sortable: true },
  { key: 'win_streak', label: 'Racha', sortable: true },
  { key: 'city', label: 'Ciudad', sortable: false },
  { key: 'category', label: 'Categoría', sortable: false }
]

const loadLeaderboard = async (resetPage: boolean = false) => {
  try {
    const page = resetPage ? 1 : currentPage.value
    await fetchLeaderboards({
      ...filters.value,
      limit: pageSize.value || 100,
      offset: (page - 1) * (pageSize.value || 100)
    })
  } catch (err) {
    console.error('Error loading leaderboard:', err)
  }
}

const handlePageChange = async (page: number) => {
  await fetchLeaderboards({
    ...filters.value,
    limit: pageSize.value || 100,
    offset: (page - 1) * (pageSize.value || 100)
  })
}

const clearFilters = () => {
  filters.value = {
    city_id: '',
    category_id: '',
    tier: '',
    search: ''
  }
  // Reset to page 1 when clearing filters
  loadLeaderboard(true)
}

const exportLeaderboard = async (format: 'csv' | 'json') => {
  try {
    const params = new URLSearchParams()
    params.append('clerk_id', useAuthState().userId.value || '')
    params.append('export', format)
    if (filters.value.city_id) params.append('city_id', filters.value.city_id)
    if (filters.value.category_id) params.append('category_id', filters.value.category_id)
    if (filters.value.tier) params.append('tier', filters.value.tier)
    if (filters.value.search) params.append('search', filters.value.search)
    
    const response = await fetch(`/api/admin/rankings/leaderboards?${params.toString()}`)
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leaderboard-${Date.now()}.${format}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  } catch (err) {
    console.error('Error exporting leaderboard:', err)
  }
}

let searchTimeout: ReturnType<typeof setTimeout> | null = null
const debouncedSearch = () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    loadLeaderboard(true) // Reset to page 1 on search
  }, 500)
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

onMounted(async () => {
  await Promise.all([
    fetchCities(),
    fetchCategories()
  ])
  // Load leaderboard with default limit of 100
  await loadLeaderboard(true)
})
</script>
