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
        <div class="mb-8 animate-fade-up">
          <NuxtLink to="/tournaments" class="inline-flex items-center gap-2 text-size-4 text-foreground-muted hover:text-accent mb-4 transition-colors">
            <Icon name="heroicons:arrow-left" class="w-4 h-4" />
            <span>Volver a Torneos</span>
          </NuxtLink>
          <div>
            <h1 v-if="tournament" class="text-size-1 font-semibold text-foreground mb-2">{{ tournament.name }}</h1>
            <div v-else class="w-80 h-10 bg-surface rounded animate-pulse mb-2"></div>
            <p v-if="tournament" class="text-size-3 font-regular text-foreground-muted">
              {{ tournament.category?.name || 'Abierto a todos' }} • {{ formatDate(tournament.start_date) }}
            </p>
            <p v-else class="text-size-3 font-regular text-foreground-muted">
              <span class="inline-block w-64 h-5 bg-surface rounded animate-pulse"></span>
            </p>
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="glass-card-elevated p-12 text-center animate-fade-in-scale">
          <Icon name="heroicons:arrow-path" class="w-12 h-12 text-accent mx-auto mb-4 animate-spin" />
          <p class="text-size-3 font-regular text-foreground-muted">Cargando torneo...</p>
        </div>

        <!-- Tournament Details -->
        <div v-else-if="tournament" class="space-y-8">
          <!-- Tournament Info -->
          <div class="glass-card-elevated p-6 animate-fade-up">
            <h2 class="text-size-2 font-semibold text-foreground mb-4">Información del Torneo</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-size-4 mb-4">
              <div>
                <span class="text-foreground-muted">Estado:</span>
                <span
                  :class="[
                    'ml-2 px-3 py-1 rounded-full text-size-4 font-semibold',
                    tournament.status === 'upcoming' ? 'bg-blue-500/20 text-blue-400' :
                    tournament.status === 'active' ? 'bg-green-500/20 text-green-400' :
                    'bg-gray-500/20 text-gray-400'
                  ]"
                >
                  {{ tournament.status === 'upcoming' ? 'Próximo' : tournament.status === 'active' ? 'Activo' : 'Completado' }}
                </span>
              </div>
              <div>
                <span class="text-foreground-muted">Fase Actual:</span>
                <span
                  :class="[
                    'ml-2 px-3 py-1 rounded-full text-size-4 font-semibold',
                    tournament.current_phase === 'registration' ? 'bg-purple-500/20 text-purple-400' :
                    tournament.current_phase === 'group_stage' ? 'bg-blue-500/20 text-blue-400' :
                    tournament.current_phase === 'playoffs' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-green-500/20 text-green-400'
                  ]"
                >
                  {{ getPhaseLabel(tournament.current_phase) }}
                </span>
              </div>
              <div>
                <span class="text-foreground-muted">Tipo de Torneo:</span>
                <span class="ml-2 text-foreground">{{ getTournamentTypeLabel(tournament.tournament_type) }}</span>
              </div>
              <div>
                <span class="text-foreground-muted">Jugadores Registrados:</span>
                <span class="ml-2 text-foreground">{{ tournament.registrations?.length || 0 }}</span>
              </div>
            </div>
            <div v-if="tournament.description" class="mt-4">
              <p class="text-size-4 text-foreground">{{ tournament.description }}</p>
            </div>
            <div v-if="tournament.organizer" class="mt-4 flex items-center gap-2 text-size-4 text-foreground-muted">
              <Icon name="heroicons:user" class="w-4 h-4" />
              <span>Organizado por: {{ tournament.organizer.name }}</span>
            </div>
          </div>

          <!-- Registration -->
          <div v-if="tournament.status === 'upcoming' && tournament.registration_open" class="glass-card-elevated p-6 animate-fade-up animate-delay-1">
            <h2 class="text-size-2 font-semibold text-foreground mb-4">Registro</h2>
            
            <!-- Already Registered Message -->
            <div v-if="isRegistered && !isOnWaitlist" class="p-4 rounded-xl bg-green-500/10 border-2 border-green-500/20">
              <div class="flex items-start gap-3">
                <Icon name="heroicons:check-circle" class="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" />
                <div class="flex-1">
                  <p class="text-size-3 font-semibold text-foreground mb-2">
                    Ya estás registrado en este torneo
                  </p>
                  <p class="text-size-4 font-regular text-foreground-muted mb-3">
                    Si deseas cancelar tu registro, por favor comunícate con el organizador del torneo.
                  </p>
                  <div v-if="tournament.organizer" class="p-3 rounded-lg bg-surface border border-border-subtle">
                    <p class="text-size-4 font-semibold text-foreground mb-1">Organizador:</p>
                    <p class="text-size-4 font-regular text-foreground">{{ tournament.organizer.name }}</p>
                  </div>
                  <div v-else-if="tournament.created_by_player" class="p-3 rounded-lg bg-surface border border-border-subtle">
                    <p class="text-size-4 font-semibold text-foreground mb-1">Organizador:</p>
                    <p class="text-size-4 font-regular text-foreground">{{ tournament.created_by_player.name }}</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- On Waitlist Message -->
            <div v-if="isOnWaitlist" class="p-4 rounded-xl bg-yellow-500/10 border-2 border-yellow-500/20">
              <div class="flex items-start gap-3">
                <Icon name="heroicons:clock" class="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div class="flex-1">
                  <p class="text-size-3 font-semibold text-foreground mb-2">
                    Estás en la lista de espera
                  </p>
                  <p class="text-size-4 font-regular text-foreground-muted mb-3">
                    Cuando haya espacio disponible o confirmes tu participación, el organizador te confirmará en el torneo.
                  </p>
                  <div v-if="tournament.organizer" class="p-3 rounded-lg bg-surface border border-border-subtle">
                    <p class="text-size-4 font-semibold text-foreground mb-1">Organizador:</p>
                    <p class="text-size-4 font-regular text-foreground">{{ tournament.organizer.name }}</p>
                  </div>
                  <div v-else-if="tournament.created_by_player" class="p-3 rounded-lg bg-surface border border-border-subtle">
                    <p class="text-size-4 font-semibold text-foreground mb-1">Organizador:</p>
                    <p class="text-size-4 font-regular text-foreground">{{ tournament.created_by_player.name }}</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Register Buttons -->
            <div v-else class="space-y-3">
              <button
                @click="handleRegister(false)"
                :disabled="registering"
                class="w-full px-6 py-3 rounded-xl bg-accent text-foreground text-size-4 font-semibold hover-lift transition-all disabled:opacity-50"
              >
                <span v-if="!registering" class="flex items-center justify-center gap-2">
                  <Icon name="heroicons:check-circle" class="w-5 h-5" />
                  Registrarse en el Torneo
                </span>
                <span v-else class="flex items-center justify-center gap-2">
                  <Icon name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
                  Registrando...
                </span>
              </button>
              <button
                @click="handleRegister(true)"
                :disabled="registering"
                class="w-full px-6 py-3 rounded-xl bg-surface border-2 border-border-subtle text-foreground text-size-4 font-semibold hover:border-accent hover:text-accent transition-all disabled:opacity-50"
              >
                <span v-if="!registering" class="flex items-center justify-center gap-2">
                  <Icon name="heroicons:clock" class="w-5 h-5" />
                  Entrar en Lista de Espera
                </span>
                <span v-else class="flex items-center justify-center gap-2">
                  <Icon name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
                  Agregando...
                </span>
              </button>
              <p class="text-size-5 text-foreground-muted text-center">
                Si no estás seguro de poder participar, puedes entrar en lista de espera y confirmar más tarde
              </p>
            </div>
          </div>

          <!-- Registered Players -->
          <div class="glass-card-elevated p-6 animate-fade-up animate-delay-2">
            <button
              @click="showRegisteredPlayers = !showRegisteredPlayers"
              class="flex items-center gap-2 text-size-2 font-semibold text-foreground hover:text-accent transition-colors mb-4"
            >
              <Icon 
                :name="showRegisteredPlayers ? 'heroicons:chevron-down' : 'heroicons:chevron-right'" 
                class="w-5 h-5 transition-transform"
              />
              <span>Jugadores Registrados ({{ filteredRegistrations.length }})</span>
            </button>
            <div v-show="showRegisteredPlayers">
              <!-- Filters -->
              <div class="mb-6 p-4 bg-surface rounded-xl border-2 border-border-subtle">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label class="block text-size-4 font-semibold text-foreground mb-2">Buscar por Nombre</label>
                    <input
                      v-model="playerFilters.search"
                      type="text"
                      placeholder="Nombre del jugador..."
                      class="w-full px-4 py-2 rounded-xl bg-background border-2 border-border-subtle text-foreground text-size-4 focus:border-accent focus:outline-none"
                    />
                  </div>
                  <div>
                    <label class="block text-size-4 font-semibold text-foreground mb-2">Filtrar por Categoría</label>
                    <select
                      v-model="playerFilters.category"
                      class="w-full px-4 py-2 rounded-xl bg-background border-2 border-border-subtle text-foreground text-size-4 focus:border-accent focus:outline-none"
                    >
                      <option value="">Todas las categorías</option>
                      <option
                        v-for="cat in uniqueCategories"
                        :key="cat"
                        :value="cat"
                      >
                        {{ cat }}
                      </option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-size-4 font-semibold text-foreground mb-2">Filtrar por Estado</label>
                    <select
                      v-model="playerFilters.status"
                      class="w-full px-4 py-2 rounded-xl bg-background border-2 border-border-subtle text-foreground text-size-4 focus:border-accent focus:outline-none"
                    >
                      <option value="">Todos los estados</option>
                      <option value="confirmed">Confirmado</option>
                      <option value="waitlisted">Lista de espera</option>
                      <option value="withdrawn">Retirado</option>
                    </select>
                  </div>
                </div>
                <div class="mt-4 flex justify-end">
                  <button
                    @click="clearPlayerFilters"
                    class="px-4 py-2 rounded-xl bg-surface border-2 border-border-subtle text-foreground-muted text-size-4 font-semibold hover:border-red-500/50 hover:text-red-400 transition-all"
                  >
                    Limpiar Filtros
                  </button>
                </div>
              </div>

              <!-- Players List -->
              <div v-if="paginatedRegistrations.length > 0" class="space-y-2">
                <div
                  v-for="reg in paginatedRegistrations"
                  :key="reg.id"
                  class="flex items-center justify-between p-3 rounded-xl bg-surface border-2 border-border-subtle"
                >
                  <div class="flex items-center gap-3">
                    <span class="text-size-4 text-foreground font-semibold">{{ reg.player?.name }}</span>
                    <span
                      v-if="reg.player?.category"
                      class="px-2 py-1 rounded-full text-size-5 font-semibold bg-accent-subtle/30 text-accent border border-accent/30"
                    >
                      {{ reg.player.category.name }}
                    </span>
                  </div>
                  <span
                    :class="[
                      'px-3 py-1 rounded-full text-size-4 font-semibold',
                      reg.status === 'confirmed' ? 'bg-green-500/20 text-green-400' :
                      reg.status === 'waitlisted' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/20 text-red-400'
                    ]"
                  >
                    {{ reg.status === 'confirmed' ? 'Confirmado' : reg.status === 'waitlisted' ? 'Lista de espera' : 'Retirado' }}
                  </span>
                </div>
              </div>
              <div v-else class="text-center py-8 text-foreground-muted">
                <Icon name="heroicons:magnifying-glass" class="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p class="text-size-3 font-semibold text-foreground mb-2">No se encontraron jugadores</p>
                <p class="text-size-4 text-foreground-muted">Ajusta los filtros para ver más resultados</p>
              </div>

              <!-- Pagination -->
              <div v-if="filteredRegistrations.length > playersPerPage" class="mt-6 flex items-center justify-between">
                <div class="text-size-4 text-foreground-muted">
                  Mostrando {{ (currentPage - 1) * playersPerPage + 1 }} - {{ Math.min(currentPage * playersPerPage, filteredRegistrations.length) }} de {{ filteredRegistrations.length }} jugadores
                </div>
                <div class="flex items-center gap-2">
                  <button
                    @click="currentPage = Math.max(1, currentPage - 1)"
                    :disabled="currentPage === 1"
                    class="px-4 py-2 rounded-xl bg-surface border-2 border-border-subtle text-foreground text-size-4 font-semibold hover:border-accent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Icon name="heroicons:chevron-left" class="w-4 h-4" />
                  </button>
                  <span class="px-4 py-2 text-size-4 font-semibold text-foreground">
                    Página {{ currentPage }} de {{ totalPages }}
                  </span>
                  <button
                    @click="currentPage = Math.min(totalPages, currentPage + 1)"
                    :disabled="currentPage === totalPages"
                    class="px-4 py-2 rounded-xl bg-surface border-2 border-border-subtle text-foreground text-size-4 font-semibold hover:border-accent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Icon name="heroicons:chevron-right" class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Phase Deadlines -->
          <div v-if="tournament.rounds && tournament.rounds.length > 0" class="glass-card-elevated p-6 animate-fade-up animate-delay-2">
            <h2 class="text-size-2 font-semibold text-foreground mb-4">Fechas Límite de las Fases</h2>
            <div class="space-y-3">
              <div
                v-for="round in sortedRounds"
                :key="round.id"
                class="flex items-center justify-between p-4 rounded-xl bg-surface border-2 border-border-subtle"
              >
                <div class="flex items-center gap-3">
                  <Icon 
                    :name="getRoundIcon(round.bracket_type)" 
                    :class="[
                      'w-5 h-5',
                      round.bracket_type === 'group' ? 'text-blue-400' :
                      round.bracket_type === 'main' ? 'text-accent' :
                      'text-accent-secondary'
                    ]"
                  />
                  <div>
                    <p class="text-size-3 font-semibold text-foreground">{{ round.round_name }}</p>
                    <p class="text-size-4 text-foreground-muted">
                      {{ getBracketTypeLabel(round.bracket_type) }}
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <Icon name="heroicons:clock" class="w-4 h-4 text-foreground-muted" />
                  <span class="text-size-3 font-semibold text-foreground">
                    {{ formatDeadline(round.deadline) }}
                  </span>
                  <span
                    v-if="isDeadlineApproaching(round.deadline)"
                    class="ml-2 px-2 py-1 rounded-full text-size-4 font-semibold bg-yellow-500/20 text-yellow-400"
                  >
                    Próximo
                  </span>
                  <span
                    v-if="isDeadlinePassed(round.deadline)"
                    class="ml-2 px-2 py-1 rounded-full text-size-4 font-semibold bg-red-500/20 text-red-400"
                  >
                    Vencido
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Bracket Visualization -->
          <div v-if="tournament.groups && tournament.groups.length > 0" class="glass-card-elevated p-6 animate-fade-up animate-delay-3">
            <h2 class="text-size-2 font-semibold text-foreground mb-4">Brackets</h2>
            <TournamentBracket :tournament-id="tournament.id" :player-id="player?.id" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Tournament } from '~/types'

const route = useRoute()
const tournamentId = route.params.id as string

const { currentTournament, loading, getTournament, registerForTournament } = useTournaments()
const { userId } = useAuthState()
const { player, fetchPlayer } = usePlayer()

const tournament = computed(() => currentTournament.value)
const registering = ref(false)
const showRegisteredPlayers = ref(false)

// Player filters and pagination
const playerFilters = ref({
  search: '',
  category: '',
  status: ''
})
const currentPage = ref(1)
const playersPerPage = 10

// Check if current player is registered in this tournament
const isRegistered = computed(() => {
  if (!tournament.value || !player.value) return false
  return tournament.value.registrations?.some(
    (reg: any) => reg.player?.id === player.value?.id && reg.status !== 'withdrawn'
  ) || false
})

// Check if current player is on waitlist
const isOnWaitlist = computed(() => {
  if (!tournament.value || !player.value) return false
  return tournament.value.registrations?.some(
    (reg: any) => reg.player?.id === player.value?.id && reg.status === 'waitlisted'
  ) || false
})

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getPhaseLabel = (phase: string | undefined) => {
  if (!phase) return 'Registro'
  const labels: Record<string, string> = {
    registration: 'Registro',
    group_stage: 'Fase de Grupos',
    playoffs: 'Playoffs',
    completed: 'Completado'
  }
  return labels[phase] || phase
}

const getTournamentTypeLabel = (type: string | undefined) => {
  if (!type) return 'Grupos + Playoffs'
  const labels: Record<string, string> = {
    groups_playoffs: 'Grupos + Playoffs',
    single_elimination: 'Eliminación Simple',
    double_elimination: 'Eliminación Doble',
    round_robin: 'Round Robin'
  }
  return labels[type] || type
}

const sortedRounds = computed(() => {
  if (!tournament.value?.rounds) return []
  const rounds = [...tournament.value.rounds]
  // Sort by bracket_type (group first, then main, then backdraw) and round_number
  return rounds.sort((a, b) => {
    const typeOrder: Record<string, number> = { group: 0, main: 1, backdraw: 2 }
    const typeDiff = (typeOrder[a.bracket_type] || 99) - (typeOrder[b.bracket_type] || 99)
    if (typeDiff !== 0) return typeDiff
    return (a.round_number || 0) - (b.round_number || 0)
  })
})

const getRoundIcon = (bracketType: string) => {
  const icons: Record<string, string> = {
    group: 'heroicons:user-group',
    main: 'heroicons:trophy',
    backdraw: 'heroicons:trophy-cup'
  }
  return icons[bracketType] || 'heroicons:calendar'
}

const getBracketTypeLabel = (bracketType: string) => {
  const labels: Record<string, string> = {
    group: 'Fase de Grupos',
    main: 'Bracket Principal',
    backdraw: 'Bracket de Consolación'
  }
  return labels[bracketType] || bracketType
}

const formatDeadline = (deadline: string) => {
  return new Date(deadline).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const isDeadlineApproaching = (deadline: string) => {
  const deadlineDate = new Date(deadline)
  const now = new Date()
  const diffHours = (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60)
  return diffHours > 0 && diffHours <= 48 // Within 48 hours
}

const isDeadlinePassed = (deadline: string) => {
  return new Date(deadline) < new Date()
}

// Filtered registrations
const filteredRegistrations = computed(() => {
  if (!tournament.value?.registrations) return []
  
  let filtered = [...tournament.value.registrations]
  
  // Filter by search
  if (playerFilters.value.search) {
    const searchTerm = playerFilters.value.search.toLowerCase()
    filtered = filtered.filter(reg => 
      reg.player?.name?.toLowerCase().includes(searchTerm)
    )
  }
  
  // Filter by category
  if (playerFilters.value.category) {
    filtered = filtered.filter(reg => 
      reg.player?.category?.name === playerFilters.value.category
    )
  }
  
  // Filter by status
  if (playerFilters.value.status) {
    filtered = filtered.filter(reg => reg.status === playerFilters.value.status)
  }
  
  return filtered
})

// Unique categories from registrations
const uniqueCategories = computed(() => {
  if (!tournament.value?.registrations) return []
  const categories = new Set<string>()
  tournament.value.registrations.forEach(reg => {
    if (reg.player?.category?.name) {
      categories.add(reg.player.category.name)
    }
  })
  return Array.from(categories).sort()
})

// Pagination
const totalPages = computed(() => {
  return Math.ceil(filteredRegistrations.value.length / playersPerPage)
})

const paginatedRegistrations = computed(() => {
  const start = (currentPage.value - 1) * playersPerPage
  const end = start + playersPerPage
  return filteredRegistrations.value.slice(start, end)
})

// Reset to page 1 when filters change
watch(() => [playerFilters.value.search, playerFilters.value.category, playerFilters.value.status], () => {
  currentPage.value = 1
})

const clearPlayerFilters = () => {
  playerFilters.value = {
    search: '',
    category: '',
    status: ''
  }
  currentPage.value = 1
}

const handleRegister = async (waitlist: boolean = false) => {
  try {
    registering.value = true
    const result = await registerForTournament(tournamentId, waitlist)
    await loadTournament()
    const toast = useToastNotifications()
    if (result.waitlisted || waitlist) {
      toast.info('Has sido agregado a la lista de espera')
    } else {
      toast.success('Te has registrado exitosamente en el torneo')
    }
  } catch (err: any) {
    const toast = useToastNotifications()
    toast.error(err.data?.message || err.message || 'Error al registrarse')
  } finally {
    registering.value = false
  }
}

const loadTournament = async () => {
  try {
    await getTournament(tournamentId)
  } catch (err) {
    console.error('Error loading tournament:', err)
  }
}

const loadPlayerProfile = async () => {
  if (!userId.value) return
  try {
    await fetchPlayer(userId.value)
  } catch (err) {
    // Silently handle errors - profile might not exist yet
  }
}

onMounted(async () => {
  await Promise.all([
    loadTournament(),
    loadPlayerProfile()
  ])
})
</script>

