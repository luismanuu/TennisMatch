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
        <!-- Coming Soon Hero for Players -->
        <TournamentsComingSoonHero v-if="isPlayerView" />

        <!-- Full Tournaments UI for Staff (Admin/Organizer) -->
        <template v-else>
          <!-- Header -->
          <div class="text-center mb-12 animate-fade-up">
            <h1 class="text-size-1 font-semibold text-foreground mb-4">Torneos</h1>
            <p class="text-size-3 font-regular text-foreground-muted">
              Explora y regístrate en los torneos disponibles
            </p>
          </div>

          <!-- Tabs -->
          <div class="mb-8 animate-fade-up animate-delay-1">
          <div class="flex gap-2 overflow-x-auto pb-2 -mx-6 px-6">
            <button
              @click="activeTab = 'all'"
              :class="[
                'flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-size-4 font-semibold transition-all whitespace-nowrap',
                activeTab === 'all'
                  ? 'bg-accent-subtle/30 text-foreground border-2 border-accent/30'
                  : 'bg-surface border-2 border-border-subtle text-foreground-muted hover:border-accent/50'
              ]"
            >
              <Icon name="heroicons:sparkles" class="w-4 h-4" />
              <span>Todos</span>
            </button>
            <button
              @click="activeTab = 'upcoming'"
              :class="[
                'flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-size-4 font-semibold transition-all whitespace-nowrap',
                activeTab === 'upcoming'
                  ? 'bg-accent-subtle/30 text-foreground border-2 border-accent/30'
                  : 'bg-surface border-2 border-border-subtle text-foreground-muted hover:border-accent/50'
              ]"
            >
              <Icon name="heroicons:calendar" class="w-4 h-4" />
              <span>Próximos</span>
            </button>
            <button
              @click="activeTab = 'active'"
              :class="[
                'flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-size-4 font-semibold transition-all whitespace-nowrap',
                activeTab === 'active'
                  ? 'bg-accent-subtle/30 text-foreground border-2 border-accent/30'
                  : 'bg-surface border-2 border-border-subtle text-foreground-muted hover:border-accent/50'
              ]"
            >
              <Icon name="heroicons:play" class="w-4 h-4" />
              <span>Activos</span>
            </button>
            <button
              @click="activeTab = 'past'"
              :class="[
                'flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-size-4 font-semibold transition-all whitespace-nowrap',
                activeTab === 'past'
                  ? 'bg-accent-subtle/30 text-foreground border-2 border-accent/30'
                  : 'bg-surface border-2 border-border-subtle text-foreground-muted hover:border-accent/50'
              ]"
            >
              <Icon name="heroicons:check-circle" class="w-4 h-4" />
              <span>Completados</span>
            </button>
          </div>
        </div>

        <!-- Filters -->
        <div class="glass-card-elevated p-6 mb-8 animate-fade-up animate-delay-2">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="block text-size-4 font-semibold text-foreground mb-2">Buscar</label>
              <input
                v-model="filters.search"
                type="text"
                placeholder="Nombre del torneo..."
                class="w-full px-4 py-2 rounded-xl bg-surface border-2 border-border-subtle text-foreground text-size-4 focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label class="block text-size-4 font-semibold text-foreground mb-2">Categoría</label>
              <select
                v-model="filters.category_id"
                class="w-full px-4 py-2 rounded-xl bg-surface border-2 border-border-subtle text-foreground text-size-4 focus:border-accent focus:outline-none"
              >
                <option value="">Todas</option>
                <option value="open">Abiertos a todos</option>
                <option v-for="cat in categories" :key="cat.id" :value="cat.id">
                  {{ cat.name }}
                </option>
              </select>
            </div>
            <div class="flex items-end">
              <button
                @click="loadTournaments()"
                class="w-full px-4 py-2 rounded-xl bg-accent text-foreground text-size-4 font-semibold hover-lift transition-all"
              >
                Filtrar
              </button>
            </div>
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="glass-card-elevated p-12 text-center animate-fade-in-scale">
          <Icon name="heroicons:arrow-path" class="w-12 h-12 text-accent mx-auto mb-4 animate-spin" />
          <p class="text-size-3 font-regular text-foreground-muted">Cargando torneos...</p>
        </div>

        <!-- Tournaments List -->
        <div v-else-if="filteredTournaments.length > 0" class="space-y-4 animate-fade-up animate-delay-3">
          <div
            v-for="tournament in filteredTournaments"
            :key="tournament.id"
            class="glass-card-elevated p-6 hover-lift transition-all cursor-pointer"
            @click="navigateTo(`/tournaments/${tournament.id}`)"
          >
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="flex items-center gap-3 mb-2">
                  <h3 class="text-size-2 font-semibold text-foreground">{{ tournament.name }}</h3>
                  <span
                    :class="[
                      'px-3 py-1 rounded-full text-size-4 font-semibold',
                      tournament.status === 'upcoming' ? 'bg-blue-500/20 text-blue-400' :
                      tournament.status === 'active' ? 'bg-green-500/20 text-green-400' :
                      'bg-gray-500/20 text-gray-400'
                    ]"
                  >
                    {{ tournament.status === 'upcoming' ? 'Próximo' : tournament.status === 'active' ? 'Activo' : 'Completado' }}
                  </span>
                </div>
                <p class="text-size-4 font-regular text-foreground-muted mb-3">
                  {{ tournament.category?.name || 'Abierto a todos' }} • {{ formatDate(tournament.start_date) }}
                </p>
                <div class="flex items-center gap-4 text-size-4 text-foreground-muted">
                  <span class="flex items-center gap-1">
                    <Icon name="heroicons:users" class="w-4 h-4" />
                    {{ getConfirmedRegistrationsCount(tournament) }} registrados
                  </span>
                  <span v-if="tournament.organizer" class="flex items-center gap-1">
                    <Icon name="heroicons:user" class="w-4 h-4" />
                    {{ tournament.organizer.name }}
                  </span>
                </div>
              </div>
              <Icon name="heroicons:chevron-right" class="w-6 h-6 text-foreground-muted flex-shrink-0" />
            </div>
          </div>
        </div>

          <!-- Empty State -->
          <div v-else class="glass-card-elevated p-12 text-center animate-fade-in-scale">
            <Icon name="heroicons:trophy" class="w-24 h-24 text-foreground-muted mx-auto mb-6 opacity-50" />
            <h3 class="text-size-2 font-semibold text-foreground mb-4">No hay torneos</h3>
            <p class="text-size-4 font-regular text-foreground-muted">
              No se encontraron torneos con los filtros actuales
            </p>
          </div>
        </template>
      </div>
    </div>
  </div>
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
</script>

