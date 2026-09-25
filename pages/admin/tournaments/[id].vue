<template>
  <PageLayout container-size="medium">
        <!-- Header -->
        <div class="page-heading">
          <NuxtLink to="/admin/tournaments" class="text-link">
            <Icon name="heroicons:arrow-left" class="w-5 h-5" aria-hidden="true" />
            Volver a Torneos
          </NuxtLink>
          <div class="heading-row">
            <div>
              <h1>{{ tournament?.name || 'Cargando...' }}</h1>
              <p class="meta">
                {{ tournament?.category?.name || 'Abierto a todos' }} • {{ tournament ? formatDate(tournament.start_date) : '' }}
              </p>
            </div>
            <div class="flex gap-3">
              <button
                v-if="tournament && tournament.registrations && tournament.registrations.length >= tournament.min_players && !tournament.groups?.length"
                @click="handleGenerateBrackets"
                :disabled="generating"
                class="btn-primary"
              >
                <span v-if="!generating">Generar Brackets</span>
                <span v-else class="flex items-center gap-2">
                  <Icon name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
                  Generando...
                </span>
              </button>
            </div>
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="panel loading-state" aria-busy="true">
          <Icon name="heroicons:arrow-path" class="loading-spinner animate-spin" aria-hidden="true" />
          <p class="loading-text">Cargando torneo…</p>
        </div>

        <!-- Tournament Details -->
        <div v-else-if="tournament" class="space-y-8">
          <!-- Tournament Info -->
          <div class="panel">
            <h2 class="panel-title">Información del Torneo</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-size-4 mb-6">
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
                <span class="text-foreground-muted">Registro:</span>
                <span class="ml-2 text-foreground">{{ tournament.registration_open ? 'Abierto' : 'Cerrado' }}</span>
              </div>
              <div>
                <span class="text-foreground-muted">Categoría:</span>
                <span class="ml-2 text-foreground">
                  {{ tournament.category?.name || 'Abierto a todos' }}
                  <span v-if="!tournament.category_id" class="ml-2 px-2 py-1 rounded-full bg-accent-subtle/30 text-accent text-size-5 font-semibold">
                    Sin restricción
                  </span>
                </span>
              </div>
              <div>
                <span class="text-foreground-muted">Fecha de Inicio:</span>
                <span class="ml-2 text-foreground">{{ formatDate(tournament.start_date) }}</span>
              </div>
              <div v-if="tournament.end_date">
                <span class="text-foreground-muted">Fecha de Fin:</span>
                <span class="ml-2 text-foreground">{{ formatDate(tournament.end_date) }}</span>
              </div>
              <div v-if="tournament.location">
                <span class="text-foreground-muted">Ubicación:</span>
                <span class="ml-2 text-foreground">{{ tournament.location }}</span>
              </div>
              <div>
                <span class="text-foreground-muted">Jugadores Registrados:</span>
                <span class="ml-2 text-foreground">{{ tournament.registrations?.length || 0 }} / {{ tournament.max_players || '∞' }}</span>
              </div>
              <div>
                <span class="text-foreground-muted">Tamaño de Grupo:</span>
                <span class="ml-2 text-foreground">{{ tournament.group_size }}</span>
              </div>
              <div>
                <span class="text-foreground-muted">Avanzan por Grupo:</span>
                <span class="ml-2 text-foreground">{{ tournament.players_per_group_advance }}</span>
              </div>
              <div v-if="tournament.organizer">
                <span class="text-foreground-muted">Organizador:</span>
                <span class="ml-2 text-foreground">{{ tournament.organizer.name }}</span>
              </div>
            </div>
            <div v-if="tournament.description" class="mt-4 pt-4 border-t border-border-subtle">
              <p class="text-foreground-muted text-size-4 mb-2">Descripción:</p>
              <p class="text-foreground text-size-4">{{ tournament.description }}</p>
            </div>
            <div v-if="tournament.rules" class="mt-4 pt-4 border-t border-border-subtle">
              <p class="text-foreground-muted text-size-4 mb-2">Reglas:</p>
              <p class="text-foreground text-size-4 whitespace-pre-line">{{ tournament.rules }}</p>
            </div>
          </div>

          <!-- Tournament Statistics -->
          <div class="panel">
            <h2 class="panel-title">Estadísticas del Torneo</h2>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div class="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
                <div class="flex items-center gap-2 mb-2">
                  <Icon name="heroicons:user-group" class="w-5 h-5 text-blue-400" />
                  <p class="text-size-4 text-foreground-muted">Grupos</p>
                </div>
                <p class="text-size-2 font-bold text-blue-400">{{ tournament.groups?.length || 0 }}</p>
              </div>
              <div class="p-4 rounded-xl bg-green-500/10 border border-green-500/30">
                <div class="flex items-center gap-2 mb-2">
                  <Icon name="heroicons:calendar" class="w-5 h-5 text-green-400" />
                  <p class="text-size-4 text-foreground-muted">Partidos Totales</p>
                </div>
                <p class="text-size-2 font-bold text-green-400">{{ tournamentStats.totalMatches || 0 }}</p>
              </div>
              <div class="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30">
                <div class="flex items-center gap-2 mb-2">
                  <Icon name="heroicons:check-circle" class="w-5 h-5 text-purple-400" />
                  <p class="text-size-4 text-foreground-muted">Completados</p>
                </div>
                <p class="text-size-2 font-bold text-purple-400">{{ tournamentStats.completedMatches || 0 }}</p>
              </div>
              <div class="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
                <div class="flex items-center gap-2 mb-2">
                  <Icon name="heroicons:clock" class="w-5 h-5 text-yellow-400" />
                  <p class="text-size-4 text-foreground-muted">Pendientes</p>
                </div>
                <p class="text-size-2 font-bold text-yellow-400">{{ tournamentStats.pendingMatches || 0 }}</p>
              </div>
            </div>
            <div class="mt-4 pt-4 border-t border-border-subtle">
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p class="text-size-4 text-foreground-muted mb-1">Tasa de Finalización</p>
                  <p class="text-size-2 font-bold text-foreground">{{ tournamentStats.completionRate || 0 }}%</p>
                </div>
                <div>
                  <p class="text-size-4 text-foreground-muted mb-1">Partidos Programados</p>
                  <p class="text-size-2 font-bold text-foreground">{{ tournamentStats.scheduledMatches || 0 }}</p>
                </div>
                <div>
                  <p class="text-size-4 text-foreground-muted mb-1">Partidos Sin Programar</p>
                  <p class="text-size-2 font-bold text-foreground">{{ tournamentStats.unscheduledMatches || 0 }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Registered Players -->
          <div class="panel">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-size-2 font-semibold text-foreground">Jugadores Registrados</h2>
              <button
                @click="showRegisterForm = !showRegisterForm"
                class="btn-primary"
              >
                Registrar Jugador
              </button>
            </div>
            <div v-if="showRegisterForm" class="mb-4 p-4 bg-surface rounded-xl border border-border-subtle">
              <input
                v-model="playerSearch"
                type="text"
                placeholder="Buscar jugador..."
                class="form-input"
              />
              <div v-if="searchResults.length > 0" class="max-h-48 overflow-y-auto space-y-2">
                <button
                  v-for="player in searchResults"
                  :key="player.id"
                  @click="handleRegisterPlayer(player.id)"
                  class="btn-secondary w-full"
                >
                  {{ player.name }}
                </button>
              </div>
            </div>
            <div v-if="tournament.registrations && tournament.registrations.length > 0" class="space-y-2">
              <div
                v-for="reg in tournament.registrations"
                :key="reg.id"
                class="flex items-center justify-between p-3 rounded-xl bg-surface border border-border-subtle"
              >
                <span class="text-size-4 text-foreground">{{ reg.player?.name }}</span>
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
              No hay jugadores registrados
            </div>
          </div>

          <!-- Groups Information -->
          <div v-if="tournament.groups && tournament.groups.length > 0" class="panel">
            <h2 class="panel-title">Grupos del Torneo</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div
                v-for="group in tournament.groups"
                :key="group.id"
                class="p-4 rounded-xl bg-surface border border-border-subtle hover:border-accent/50 transition-colors"
              >
                <h3 class="text-size-3 font-semibold text-foreground mb-3">{{ group.group_name }}</h3>
                <div class="space-y-2">
                  <div
                    v-for="groupPlayer in group.players"
                    :key="groupPlayer.id"
                    class="flex items-center justify-between p-2 rounded-lg bg-background"
                  >
                    <span class="text-size-4 text-foreground">{{ groupPlayer.player?.name }}</span>
                    <span class="text-size-5 text-foreground-muted">#{{ groupPlayer.seed_position }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Tournament Matches -->
          <div v-if="tournamentStats.totalMatches > 0" class="panel">
            <h2 class="panel-title">Partidos del Torneo</h2>
            <div class="space-y-3">
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div class="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
                  <p class="text-size-4 text-foreground-muted mb-1">Total</p>
                  <p class="text-size-2 font-bold text-blue-400">{{ tournamentStats.totalMatches }}</p>
                </div>
                <div class="p-4 rounded-xl bg-green-500/10 border border-green-500/30">
                  <p class="text-size-4 text-foreground-muted mb-1">Completados</p>
                  <p class="text-size-2 font-bold text-green-400">{{ tournamentStats.completedMatches }}</p>
                </div>
                <div class="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
                  <p class="text-size-4 text-foreground-muted mb-1">Pendientes</p>
                  <p class="text-size-2 font-bold text-yellow-400">{{ tournamentStats.pendingMatches }}</p>
                </div>
              </div>
              <NuxtLink
                :to="`/admin/tournaments/${tournamentId}/matches`"
                class="btn-primary"
              >
                <Icon name="heroicons:eye" class="w-4 h-4" />
                <span>Ver Todos los Partidos</span>
              </NuxtLink>
            </div>
          </div>

          <!-- Bracket Visualization -->
          <div v-if="tournament.groups && tournament.groups.length > 0" class="panel">
            <h2 class="panel-title">Brackets</h2>
            <TournamentBracket :tournament-id="tournament.id" />
          </div>

          <!-- Rounds and Deadlines -->
          <div v-if="tournament.rounds && tournament.rounds.length > 0" class="panel">
            <h2 class="panel-title">Rondas y Fechas Límite</h2>
            <div class="space-y-4">
              <div
                v-for="round in tournament.rounds"
                :key="round.id"
                class="p-4 rounded-xl bg-surface border border-border-subtle"
              >
                <div class="flex items-center justify-between mb-2">
                  <div>
                    <h3 class="text-size-3 font-semibold text-foreground">{{ round.round_name }}</h3>
                    <p class="text-size-4 text-foreground-muted">
                      {{ round.bracket_type === 'group' ? 'Fase de Grupos' : round.bracket_type === 'main' ? 'Bracket Main' : 'Bracket Back' }}
                    </p>
                  </div>
                  <span
                    :class="[
                      'px-3 py-1 rounded-full text-size-4 font-semibold',
                      round.status === 'active' ? 'bg-green-500/20 text-green-400' :
                      round.status === 'completed' ? 'bg-gray-500/20 text-gray-400' :
                      'bg-blue-500/20 text-blue-400'
                    ]"
                  >
                    {{ round.status === 'active' ? 'Activa' : round.status === 'completed' ? 'Completada' : 'Próxima' }}
                  </span>
                </div>
                <div v-if="round.deadline" class="mt-2">
                  <p class="text-size-4 text-foreground-muted">Fecha Límite:</p>
                  <p class="text-size-3 font-semibold text-foreground">{{ formatDate(round.deadline) }}</p>
                </div>
                <div v-else class="mt-2">
                  <p class="text-size-4 text-foreground-muted">Sin fecha límite establecida</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Deadline Management -->
          <div v-if="tournament.groups && tournament.groups.length > 0" class="panel">
            <h2 class="panel-title">Gestionar Fechas Límite</h2>
            <div class="space-y-4">
              <div>
                <label class="form-label">Fecha Límite Fase de Grupos</label>
                <input
                  v-model="groupDeadline"
                  type="datetime-local"
                  :min="minDateTime"
                  class="form-input"
                />
                <p v-if="isGroupDeadlineInPast" class="text-size-4 font-regular text-red-400 mt-2">
                  No puedes establecer una fecha límite en el pasado
                </p>
                <button
                  @click="handleSetGroupDeadline"
                  class="btn-primary"
                >
                  Establecer Fecha Límite
                </button>
              </div>
            </div>
          </div>
        </div>
  </PageLayout>
</template>

<script setup lang="ts">
import type { Tournament, PlayerSearchResult } from '~/types'
import { getCurrentEcuadorDatetimeLocal } from '~/composables/useTimezone'

definePageMeta({
  middleware: ['admin']
})

const route = useRoute()
const tournamentId = route.params.id as string

const { currentTournament, loading, getTournament, generateBrackets, registerPlayer, setGroupDeadline } = useTournaments()
const { searchPlayers } = usePlayerSearch()

const tournament = computed(() => currentTournament.value)
const generating = ref(false)
const showRegisterForm = ref(false)
const playerSearch = ref('')
const searchResults = ref<PlayerSearchResult[]>([])
const groupDeadline = ref('')
const tournamentStats = ref({
  totalMatches: 0,
  completedMatches: 0,
  pendingMatches: 0,
  scheduledMatches: 0,
  unscheduledMatches: 0,
  completionRate: 0
})

// Get current date/time in datetime-local format (YYYY-MM-DDTHH:mm) using Ecuador timezone
const minDateTime = computed(() => {
  return getCurrentEcuadorDatetimeLocal()
})

// Check if selected group deadline is in the past
const isGroupDeadlineInPast = computed(() => {
  if (!groupDeadline.value) return false
  const selectedDate = new Date(groupDeadline.value)
  const now = new Date()
  return selectedDate < now
})

const formatDate = (dateString: string) => {
  // Use Ecuador timezone for display
  return new Date(dateString).toLocaleDateString('es-ES', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const handleGenerateBrackets = async () => {
  try {
    generating.value = true
    await generateBrackets(tournamentId)
    await loadTournament()
    const toast = useToastNotifications()
    toast.success('Brackets generados exitosamente')
  } catch (err: any) {
    const toast = useToastNotifications()
    toast.error(err.data?.message || err.message || 'Error al generar brackets')
  } finally {
    generating.value = false
  }
}

const handleRegisterPlayer = async (playerId: string) => {
  try {
    await registerPlayer(tournamentId, { player_id: playerId })
    await loadTournament()
    showRegisterForm.value = false
    playerSearch.value = ''
    searchResults.value = []
    const toast = useToastNotifications()
    toast.success('Jugador registrado exitosamente')
  } catch (err: any) {
    const toast = useToastNotifications()
    toast.error(err.data?.message || err.message || 'Error al registrar jugador')
  }
}

const handleSetGroupDeadline = async () => {
  if (!groupDeadline.value) return
  try {
    await setGroupDeadline(tournamentId, groupDeadline.value)
    const toast = useToastNotifications()
    toast.success('Fecha límite establecida')
  } catch (err: any) {
    const toast = useToastNotifications()
    toast.error(err.data?.message || err.message || 'Error al establecer fecha límite')
  }
}

const loadTournament = async () => {
  try {
    await getTournament(tournamentId)
    await loadTournamentStats()
    
    // Set default group deadline to today at 00:00 if not set
    if (!groupDeadline.value && tournament.value) {
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      groupDeadline.value = `${year}-${month}-${day}T00:00`
    }
  } catch (err) {
    console.error('Error loading tournament:', err)
  }
}

const loadTournamentStats = async () => {
  if (!tournament.value) return
  
  try {
    const { userId } = useAuthState()
    if (!userId.value) return

    // Get tournament matches
    const matches = await $fetch(`/api/admin/tournaments/${tournamentId}/matches`, {
      query: {
      }
    }).catch(() => [])

    const totalMatches = matches.length || 0
    const completedMatches = matches.filter((m: any) => m.status === 'completed').length || 0
    const pendingMatches = matches.filter((m: any) => m.status === 'scheduled' || m.status === 'active').length || 0
    const scheduledMatches = matches.filter((m: any) => m.scheduled_at).length || 0
    const unscheduledMatches = matches.filter((m: any) => !m.scheduled_at).length || 0
    const completionRate = totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0

    tournamentStats.value = {
      totalMatches,
      completedMatches,
      pendingMatches,
      scheduledMatches,
      unscheduledMatches,
      completionRate
    }
  } catch (err) {
    console.error('Error loading tournament stats:', err)
  }
}

watch(playerSearch, async (search) => {
  if (search.length < 2) {
    searchResults.value = []
    return
  }
  try {
    const results = await searchPlayers(search)
    searchResults.value = results
  } catch (err) {
    console.error('Error searching players:', err)
    searchResults.value = []
  }
})

onMounted(async () => {
  await loadTournament()
})
</script>


<style scoped>
.heading-row { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 16px 24px; }
</style>
