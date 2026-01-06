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
          <NuxtLink :to="`/admin/tournaments/${tournamentId}`" class="inline-flex items-center gap-2 text-size-4 text-foreground-muted hover:text-accent mb-4 transition-colors">
            <Icon name="heroicons:arrow-left" class="w-4 h-4" />
            <span>Volver al Torneo</span>
          </NuxtLink>
          <h1 class="text-size-1 font-semibold text-foreground mb-2">Partidos del Torneo</h1>
          <p class="text-size-3 font-regular text-foreground-muted">
            {{ tournament?.name || 'Cargando...' }}
          </p>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="glass-card-elevated p-12 text-center animate-fade-in-scale">
          <Icon name="heroicons:arrow-path" class="w-12 h-12 text-accent mx-auto mb-4 animate-spin" />
          <p class="text-size-3 font-regular text-foreground-muted">Cargando partidos...</p>
        </div>

        <!-- Matches List -->
        <div v-else class="space-y-6">
          <!-- Filters -->
          <div class="glass-card-elevated p-4 animate-fade-up">
            <div class="flex flex-wrap gap-4">
              <select
                v-model="filterBracket"
                class="px-4 py-2 rounded-xl bg-surface border-2 border-border-subtle text-foreground text-size-4 focus:border-accent focus:outline-none"
              >
                <option value="">Todos los Brackets</option>
                <option value="group">Fase de Grupos</option>
                <option value="main">Bracket Main</option>
                <option value="backdraw">Bracket Back</option>
              </select>
              <select
                v-model="filterStatus"
                class="px-4 py-2 rounded-xl bg-surface border-2 border-border-subtle text-foreground text-size-4 focus:border-accent focus:outline-none"
              >
                <option value="">Todos los Estados</option>
                <option value="scheduled">Programados</option>
                <option value="active">En Curso</option>
                <option value="completed">Completados</option>
                <option value="cancelled">Cancelados</option>
              </select>
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Buscar por jugador..."
                class="flex-1 min-w-64 px-4 py-2 rounded-xl bg-surface border-2 border-border-subtle text-foreground text-size-4 focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          <!-- Statistics -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-up animate-delay-1">
            <div class="glass-card-elevated p-4">
              <p class="text-size-4 text-foreground-muted mb-1">Total</p>
              <p class="text-size-2 font-bold text-foreground">{{ filteredMatches.length }}</p>
            </div>
            <div class="glass-card-elevated p-4">
              <p class="text-size-4 text-foreground-muted mb-1">Completados</p>
              <p class="text-size-2 font-bold text-green-400">{{ completedCount }}</p>
            </div>
            <div class="glass-card-elevated p-4">
              <p class="text-size-4 text-foreground-muted mb-1">Programados</p>
              <p class="text-size-2 font-bold text-blue-400">{{ scheduledCount }}</p>
            </div>
            <div class="glass-card-elevated p-4">
              <p class="text-size-4 text-foreground-muted mb-1">Sin Programar</p>
              <p class="text-size-2 font-bold text-yellow-400">{{ unscheduledCount }}</p>
            </div>
          </div>

          <!-- Matches Table -->
          <div class="glass-card-elevated overflow-hidden animate-fade-up animate-delay-2">
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead class="bg-surface border-b border-border-subtle">
                  <tr>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">Bracket</th>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">Ronda</th>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">Jugador 1</th>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">Jugador 2</th>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">Estado</th>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">Fecha</th>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">Resultado</th>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="tm in filteredMatches"
                    :key="tm.id"
                    class="border-b border-border-subtle hover:bg-surface/50 transition-colors"
                  >
                    <td class="p-4">
                      <span
                        :class="[
                          'px-3 py-1 rounded-full text-size-4 font-semibold',
                          tm.bracket_type === 'group' ? 'bg-blue-500/20 text-blue-400' :
                          tm.bracket_type === 'main' ? 'bg-green-500/20 text-green-400' :
                          'bg-purple-500/20 text-purple-400'
                        ]"
                      >
                        {{ tm.bracket_type === 'group' ? 'Grupos' : tm.bracket_type === 'main' ? 'Principal' : 'Consolación' }}
                      </span>
                    </td>
                    <td class="p-4 text-size-4 text-foreground">
                      {{ tm.round_number === 1 && tm.bracket_type === 'group' ? 'Fase de Grupos' : `Ronda ${tm.round_number}` }}
                      <span v-if="tm.bracket_position" class="text-foreground-muted"> ({{ tm.bracket_position }})</span>
                    </td>
                    <td class="p-4 text-size-4 text-foreground">
                      {{ getPlayerName(tm.match?.player1_id) }}
                    </td>
                    <td class="p-4 text-size-4 text-foreground">
                      {{ tm.is_bye ? 'BYE' : getPlayerName(tm.match?.player2_id) }}
                    </td>
                    <td class="p-4">
                      <span
                        :class="[
                          'px-3 py-1 rounded-full text-size-4 font-semibold',
                          tm.match?.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                          tm.match?.status === 'active' ? 'bg-yellow-500/20 text-yellow-400' :
                          tm.match?.status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                          'bg-blue-500/20 text-blue-400'
                        ]"
                      >
                        {{ tm.match?.status === 'completed' ? 'Completado' :
                            tm.match?.status === 'active' ? 'En Curso' :
                            tm.match?.status === 'cancelled' ? 'Cancelado' : 'Programado' }}
                      </span>
                    </td>
                    <td class="p-4 text-size-4 text-foreground">
                      {{ tm.match?.scheduled_at ? formatDate(tm.match.scheduled_at) : 'Sin programar' }}
                    </td>
                    <td class="p-4 text-size-4 text-foreground">
                      {{ tm.match?.score || '-' }}
                    </td>
                    <td class="p-4">
                      <NuxtLink
                        v-if="tm.match"
                        :to="`/matches/${tm.match.id}`"
                        class="px-3 py-1 rounded-xl bg-accent text-foreground text-size-4 font-semibold hover-lift transition-all inline-block"
                      >
                        Ver
                      </NuxtLink>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-if="filteredMatches.length === 0" class="p-12 text-center">
              <Icon name="heroicons:calendar-x-mark" class="w-16 h-16 text-foreground-muted mx-auto mb-4 opacity-50" />
              <p class="text-size-3 font-semibold text-foreground mb-2">No hay partidos</p>
              <p class="text-size-4 text-foreground-muted">No se encontraron partidos con los filtros seleccionados</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TournamentMatch } from '~/types'

definePageMeta({
  middleware: ['admin']
})

const route = useRoute()
const tournamentId = route.params.id as string

const { userId } = useAuthState()
const { currentTournament, getTournament } = useTournaments()
const { players, fetchPlayers } = useAdmin()

const tournament = computed(() => currentTournament.value)
const loading = ref(false)
const matches = ref<any[]>([])
const filterBracket = ref('')
const filterStatus = ref('')
const searchQuery = ref('')

const filteredMatches = computed(() => {
  let filtered = matches.value

  if (filterBracket.value) {
    filtered = filtered.filter(m => m.bracket_type === filterBracket.value)
  }

  if (filterStatus.value) {
    filtered = filtered.filter(m => m.match?.status === filterStatus.value)
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(m => {
      const player1Name = getPlayerName(m.match?.player1_id)?.toLowerCase() || ''
      const player2Name = getPlayerName(m.match?.player2_id)?.toLowerCase() || ''
      return player1Name.includes(query) || player2Name.includes(query)
    })
  }

  return filtered
})

const completedCount = computed(() => filteredMatches.value.filter(m => m.match?.status === 'completed').length)
const scheduledCount = computed(() => filteredMatches.value.filter(m => m.match?.scheduled_at).length)
const unscheduledCount = computed(() => filteredMatches.value.filter(m => !m.match?.scheduled_at).length)

const getPlayerName = (playerId?: string) => {
  if (!playerId) return 'N/A'
  const player = players.value.find(p => p.id === playerId)
  return player?.name || 'N/A'
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const loadMatches = async () => {
  if (!userId.value) return
  
  try {
    loading.value = true
    const data = await $fetch(`/api/admin/tournaments/${tournamentId}/matches`, {
      query: {
        clerk_id: userId.value
      }
    })
    matches.value = data || []
  } catch (err) {
    console.error('Error loading matches:', err)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await getTournament(tournamentId)
  await fetchPlayers()
  await loadMatches()
})
</script>

