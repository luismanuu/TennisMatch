<template>
  <PageLayout>
    <TournamentsComingSoonHero v-if="isPlayerView" />

    <template v-else>
      <PageHeader title="Torneos" subtitle="Explora los torneos y sus inscripciones." />

      <div class="chips" role="group" aria-label="Filtrar torneos">
        <button v-for="tab in tabs" :key="tab.value" type="button" class="chip" :aria-pressed="activeTab === tab.value" @click="activeTab = tab.value">
          <Icon :name="tab.icon" class="w-4 h-4" aria-hidden="true" />
          {{ tab.label }}
        </button>
      </div>

      <form class="panel filters" @submit.prevent="loadTournaments()">
        <div>
          <label for="t-search" class="form-label">Buscar</label>
          <input id="t-search" v-model="filters.search" type="search" placeholder="Nombre del torneo" class="form-input">
        </div>
        <div>
          <label for="t-cat" class="form-label">Categoría</label>
          <select id="t-cat" v-model="filters.category_id" class="form-select">
            <option value="">Todas</option>
            <option value="open">Abiertos a todos</option>
            <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
          </select>
        </div>
        <button type="submit" class="btn-secondary filters__submit">Filtrar</button>
      </form>

      <div v-if="loading" class="panel loading-state" aria-busy="true">
        <Icon name="heroicons:arrow-path" class="loading-spinner animate-spin" aria-hidden="true" />
        <p class="loading-text">Cargando torneos…</p>
      </div>

      <div v-else-if="filteredTournaments.length > 0" class="list-surface">
        <NuxtLink v-for="tournament in filteredTournaments" :key="tournament.id" :to="`/tournaments/${tournament.id}`" class="list-row t-row">
          <span class="avatar" aria-hidden="true"><Icon name="heroicons:trophy" class="w-5 h-5 text-accent" /></span>
          <span class="row-copy">
            <strong>{{ tournament.name }}</strong>
            <span class="meta">{{ tournament.category?.name || 'Abierto a todos' }} · {{ formatDate(tournament.start_date) }}</span>
            <span class="meta">{{ getConfirmedRegistrationsCount(tournament) }} registrados<template v-if="tournament.organizer"> · Organiza {{ tournament.organizer.name }}</template></span>
          </span>
          <span class="status-badge" :class="tournament.status === 'upcoming' ? 'status-badge-upcoming' : tournament.status === 'active' ? 'status-badge-active' : 'status-badge-completed'">
            {{ tournament.status === 'upcoming' ? 'Próximo' : tournament.status === 'active' ? 'Activo' : 'Completado' }}
          </span>
          <Icon name="heroicons:chevron-right" class="w-5 h-5 text-foreground-muted" aria-hidden="true" />
        </NuxtLink>
      </div>

      <div v-else class="panel empty-state">
        <Icon name="heroicons:trophy" class="empty-state-icon" aria-hidden="true" />
        <h2 class="empty-state-title">No hay torneos</h2>
        <p class="empty-state-description">No encontramos torneos con estos filtros.</p>
      </div>
    </template>
  </PageLayout>
</template>

<script setup lang="ts">
import type { Tournament } from '~/types'

// Role checks for gating
const { isAdmin } = useAdmin()
const { isOrganizer } = useOrganizer()

// Determine if user is staff (admin or organizer)
const isStaff = computed(() => isAdmin.value || isOrganizer.value)
const isPlayerView = computed(() => !isStaff.value)

const { tournaments, loading, fetchTournaments, fetchPastTournaments } = useTournaments()
const { categories, fetchCategories } = useCategories()

const activeTab = ref<'all' | 'upcoming' | 'active' | 'past'>('all')
const filters = ref({
  search: '',
  category_id: ''
})

const filteredTournaments = computed(() => {
  let filtered = tournaments.value

  if (filters.value.search) {
    filtered = filtered.filter(t => 
      t.name.toLowerCase().includes(filters.value.search.toLowerCase())
    )
  }

  if (filters.value.category_id) {
    if (filters.value.category_id === 'open') {
      filtered = filtered.filter(t => !t.category_id)
    } else {
      filtered = filtered.filter(t => t.category_id === filters.value.category_id)
    }
  }

  return filtered
})

const formatDate = (dateString: string) => {
  // Use Ecuador timezone for display
  return new Date(dateString).toLocaleDateString('es-ES', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

const getConfirmedRegistrationsCount = (tournament: Tournament) => {
  if (!tournament.registrations || tournament.registrations.length === 0) return 0
  // Count only confirmed registrations that haven't been withdrawn
  return tournament.registrations.filter(
    (reg: any) => reg.status === 'confirmed' && !reg.withdrawn_at
  ).length
}

const loadTournaments = async () => {
  try {
    // Handle "open" filter (tournaments without category)
    let categoryFilter: string | null | undefined = filters.value.category_id || undefined
    if (categoryFilter === 'open') {
      categoryFilter = null // Pass null to filter for tournaments without category
    }
    
    if (activeTab.value === 'past') {
      await fetchPastTournaments({
        category_id: categoryFilter,
        search: filters.value.search || undefined
      })
    } else if (activeTab.value === 'all') {
      // Load all tournaments including completed ones
      // First get upcoming and active (this updates tournaments.value)
      const activeData = await fetchTournaments({
        status: undefined, // Don't filter by status to get both upcoming and active
        category_id: categoryFilter,
        search: filters.value.search || undefined
      })
      // Save the active data before fetchPastTournaments overwrites it
      const activeTournaments = [...activeData]
      // Then get completed tournaments (this will overwrite tournaments.value)
      const completedData = await fetchPastTournaments({
        category_id: categoryFilter,
        search: filters.value.search || undefined
      })
      // Combine both lists
      tournaments.value = [...activeTournaments, ...completedData]
    } else {
      await fetchTournaments({
        status: activeTab.value,
        category_id: categoryFilter,
        search: filters.value.search || undefined
      })
    }
  } catch (err) {
    console.error('Error loading tournaments:', err)
  }
}

watch(activeTab, () => {
  if (isStaff.value) {
    loadTournaments()
  }
})

onMounted(async () => {
  // Only load data if user is staff (admin/organizer)
  if (isStaff.value) {
    await fetchCategories()
    await loadTournaments()
  }
})

const tabs = [
  { value: 'all', label: 'Todos', icon: 'heroicons:sparkles' },
  { value: 'upcoming', label: 'Próximos', icon: 'heroicons:calendar' },
  { value: 'active', label: 'Activos', icon: 'heroicons:play' },
  { value: 'past', label: 'Completados', icon: 'heroicons:check-circle' }
] as const
</script>


<style scoped>
.chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.chip { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 8px 14px; border-radius: 999px; border: 1px solid var(--edge); background: transparent; color: var(--foreground-muted); font-size: 14px; font-weight: 600; }
.chip[aria-pressed="true"] { background: var(--accent); border-color: transparent; color: var(--accent-foreground); }
.filters { display: grid; grid-template-columns: 2fr 1fr auto; gap: 16px; align-items: end; margin-bottom: 24px; }
.filters .form-label { margin-bottom: 6px; }
.t-row { flex-wrap: wrap; }
@media (max-width: 767px) { .filters { grid-template-columns: 1fr; } }
</style>
