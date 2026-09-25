<template>
  <PageLayout>
        <PageHeader title="Mis torneos" subtitle="Crea y gestiona los torneos que organizas.">
          <template #actions>
            <button type="button" class="btn-primary" :aria-expanded="showCreateForm" @click="showCreateForm = !showCreateForm">
              <Icon :name="showCreateForm ? 'heroicons:x-mark' : 'heroicons:plus'" class="w-5 h-5" aria-hidden="true" />
              {{ showCreateForm ? 'Cerrar formulario' : 'Nuevo torneo' }}
            </button>
          </template>
        </PageHeader>

        <!-- Create Tournament Form -->
        <div v-if="showCreateForm" class="panel mb-8">
          <h2 class="panel-title">Crear Nuevo Torneo</h2>
          <form @submit.prevent="handleCreateTournament" class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label class="block text-size-4 font-semibold text-foreground mb-2">Nombre del Torneo</label>
                <input
                  v-model="tournamentForm.name"
                  type="text"
                  required
                  class="form-input"
                  placeholder="Ej: Torneo Primavera 2024"
                />
              </div>
              <div>
                <label class="block text-size-4 font-semibold text-foreground mb-2">
                  Categoría <span class="text-foreground-muted text-size-5">(Opcional)</span>
                </label>
                <select
                  v-model="tournamentForm.category_id"
                  class="form-select"
                >
                  <option value="">Abierto a todos (sin categoría)</option>
                  <option v-for="cat in categories" :key="cat.id" :value="cat.id">
                    {{ cat.name }}
                  </option>
                </select>
                <p class="text-size-5 text-foreground-muted mt-2">
                  Si no seleccionas una categoría, el torneo estará abierto a jugadores de todas las categorías
                </p>
              </div>
              <div>
                <label class="block text-size-4 font-semibold text-foreground mb-2">Fecha de Inicio</label>
                <input
                  v-model="tournamentForm.start_date"
                  type="datetime-local"
                  :min="minDateTime"
                  required
                  class="form-input"
                />
                <p v-if="isStartDateInPast" class="field-error mt-2">
                  No puedes crear un torneo con fecha de inicio en el pasado
                </p>
              </div>
              <div>
                <label class="block text-size-4 font-semibold text-foreground mb-2">Fecha de Fin (Opcional)</label>
                <input
                  v-model="tournamentForm.end_date"
                  type="datetime-local"
                  :min="tournamentForm.start_date || minDateTime"
                  class="form-input"
                />
                <p v-if="isEndDateInPast" class="field-error mt-2">
                  La fecha de fin no puede ser anterior a la fecha de inicio
                </p>
              </div>
              <div>
                <label class="block text-size-4 font-semibold text-foreground mb-2">Tipo de Torneo</label>
                <select
                  v-model="tournamentForm.tournament_type"
                  class="form-select"
                >
                  <option value="groups_playoffs">Grupos + Playoffs (Default)</option>
                  <option value="single_elimination">Eliminación Simple</option>
                  <option value="double_elimination">Eliminación Doble</option>
                  <option value="round_robin">Round Robin</option>
                </select>
                <p class="text-size-5 text-foreground-muted mt-2">
                  <strong>Grupos + Playoffs:</strong> Fase de grupos seguida de brackets de playoffs (principal y consolación)
                </p>
              </div>
              <div>
                <label class="block text-size-4 font-semibold text-foreground mb-2">Tamaño de Grupo</label>
                <input
                  v-model.number="tournamentForm.group_size"
                  type="number"
                  min="2"
                  required
                  class="form-input"
                />
              </div>
              <div>
                <label class="block text-size-4 font-semibold text-foreground mb-2">Jugadores que Avanzan por Grupo</label>
                <input
                  v-model.number="tournamentForm.players_per_group_advance"
                  type="number"
                  min="1"
                  required
                  class="form-input"
                />
              </div>
              <div>
                <label class="block text-size-4 font-semibold text-foreground mb-2">Mínimo de Jugadores</label>
                <input
                  v-model.number="tournamentForm.min_players"
                  type="number"
                  min="4"
                  required
                  class="form-input"
                />
              </div>
              <div>
                <label class="block text-size-4 font-semibold text-foreground mb-2">Máximo de Jugadores (Opcional)</label>
                <input
                  v-model.number="tournamentForm.max_players"
                  type="number"
                  min="4"
                  class="form-input"
                />
              </div>
            </div>
            
            <!-- Points Configuration Section -->
            <div class="border-t-2 border-border-subtle pt-6 mt-6">
              <h3 class="text-size-3 font-semibold text-foreground mb-4">Configuración de Puntos</h3>
              <p class="text-size-5 text-foreground-muted mb-4">
                Los puntos se usan como desempate cuando los jugadores tienen el mismo número de victorias. Los puntos se acumulan en todas las etapas del torneo.
              </p>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label class="block text-size-4 font-semibold text-foreground mb-2">
                    Puntos por Victoria - Fase de Grupos
                  </label>
                  <input
                    v-model.number="tournamentForm.points_config.group_stage"
                    type="number"
                    min="1"
                    class="form-input"
                    placeholder="3 (por defecto)"
                  />
                  <p class="text-size-5 text-foreground-muted mt-2">
                    Puntos otorgados por cada victoria en la fase de grupos
                  </p>
                </div>
                <div>
                  <label class="block text-size-4 font-semibold text-foreground mb-2">
                    Puntos por Victoria - Playoffs
                  </label>
                  <input
                    v-model.number="tournamentForm.points_config.playoffs"
                    type="number"
                    min="1"
                    class="form-input"
                    placeholder="5 (por defecto)"
                  />
                  <p class="text-size-5 text-foreground-muted mt-2">
                    Puntos otorgados por cada victoria en playoffs (cuartos, semis, final)
                  </p>
                </div>
              </div>
            </div>
            
            <div>
              <label class="block text-size-4 font-semibold text-foreground mb-2">Descripción (Opcional)</label>
              <textarea
                v-model="tournamentForm.description"
                rows="3"
                class="form-textarea"
                placeholder="Descripción del torneo..."
              />
            </div>
            <div class="flex items-center gap-4">
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  v-model="tournamentForm.registration_open"
                  type="checkbox"
                  class="w-5 h-5 rounded border border-border-subtle text-accent focus:ring-accent"
                />
                <span class="text-size-4 font-regular text-foreground">Registro abierto</span>
              </label>
            </div>
            <div class="flex gap-4">
              <button
                type="submit"
                :disabled="creating"
                class="btn-primary"
              >
                <span v-if="!creating">Crear Torneo</span>
                <span v-else class="flex items-center gap-2">
                  <Icon name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
                  Creando...
                </span>
              </button>
              <button
                type="button"
                @click="showCreateForm = false; resetForm()"
                class="px-6 py-3 rounded-xl bg-surface border border-border-subtle text-foreground text-size-4 font-semibold transition-all"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="panel loading-state" aria-busy="true">
          <Icon name="heroicons:arrow-path" class="loading-spinner animate-spin" aria-hidden="true" />
          <p class="loading-text">Cargando torneos…</p>
        </div>

        <div v-else-if="tournaments.length > 0" class="list-surface">
          <NuxtLink v-for="tournament in tournaments" :key="tournament.id" :to="`/organizer/tournaments/${tournament.id}`" class="list-row t-row">
            <span class="avatar" aria-hidden="true"><Icon name="heroicons:trophy" class="w-5 h-5 text-accent" /></span>
            <span class="row-copy">
              <strong>{{ tournament.name }}</strong>
              <span class="meta">{{ tournament.category?.name || 'Abierto a todos' }} · {{ formatDate(tournament.start_date) }}</span>
              <span class="meta">{{ tournament.registrations?.length || 0 }} registrados · {{ tournament.groups?.length || 0 }} grupos</span>
            </span>
            <span class="status-badge" :class="tournament.status === 'upcoming' ? 'status-badge-upcoming' : tournament.status === 'active' ? 'status-badge-active' : 'status-badge-completed'">
              {{ tournament.status === 'upcoming' ? 'Próximo' : tournament.status === 'active' ? 'Activo' : 'Completado' }}
            </span>
            <Icon name="heroicons:chevron-right" class="w-5 h-5 text-foreground-muted" aria-hidden="true" />
          </NuxtLink>
        </div>

        <!-- Empty State -->
        <div v-else class="panel empty-state">
          <Icon name="heroicons:trophy" class="empty-state-icon" aria-hidden="true" />
          <h3 class="empty-state-title">No hay torneos</h3>
          <p class="text-size-4 font-regular text-foreground-muted mb-6">
            Crea tu primer torneo para comenzar
          </p>
          <button
            @click="showCreateForm = true"
            class="btn-primary"
          >
            Crear Torneo
          </button>
        </div>
  </PageLayout>
</template>

<script setup lang="ts">
import type { CreateTournamentPayload } from '~/types'
import { getCurrentEcuadorDatetimeLocal } from '~/composables/useTimezone'

definePageMeta({
  middleware: ['organizer']
})

const { tournaments, loading, fetchOrganizerTournaments, createTournament } = useOrganizer()
const { categories, fetchCategories } = useCategories()

const showCreateForm = ref(false)
const creating = ref(false)

const tournamentForm = ref<CreateTournamentPayload & { registration_open: boolean }>({
  name: '',
  category_id: '',
  start_date: '',
  end_date: '',
  tournament_type: 'groups_playoffs',
  group_size: 4,
  players_per_group_advance: 2,
  min_players: 4,
  max_players: undefined,
  description: '',
  registration_open: true,
  points_config: {
    group_stage: 3,
    playoffs: 5
  }
})

// Get current date/time in datetime-local format (YYYY-MM-DDTHH:mm) using Ecuador timezone
const minDateTime = computed(() => {
  return getCurrentEcuadorDatetimeLocal()
})

// Check if selected start date is in the past
const isStartDateInPast = computed(() => {
  if (!tournamentForm.value.start_date) return false
  const selectedDate = new Date(tournamentForm.value.start_date)
  const now = new Date()
  return selectedDate < now
})

// Check if selected end date is before start date
const isEndDateInPast = computed(() => {
  if (!tournamentForm.value.end_date || !tournamentForm.value.start_date) return false
  const endDate = new Date(tournamentForm.value.end_date)
  const startDate = new Date(tournamentForm.value.start_date)
  return endDate < startDate
})

const resetForm = () => {
  // Set default dates to today at 00:00
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  
  tournamentForm.value = {
    name: '',
    category_id: '',
    start_date: `${year}-${month}-${day}T00:00`,
    end_date: '',
    tournament_type: 'groups_playoffs',
    group_size: 4,
    players_per_group_advance: 2,
    min_players: 4,
    max_players: undefined,
    description: '',
    registration_open: true,
    points_config: {
      group_stage: 3,
      playoffs: 5
    }
  }
}

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

const handleCreateTournament = async () => {
  try {
    creating.value = true
    await createTournament(tournamentForm.value)
    showCreateForm.value = false
    resetForm()
    await loadTournaments()
    const toast = useToastNotifications()
    toast.success('Torneo creado exitosamente')
  } catch (err: any) {
    const toast = useToastNotifications()
    toast.error(err.data?.message || err.message || 'Error al crear torneo')
  } finally {
    creating.value = false
  }
}

const loadTournaments = async () => {
  try {
    await fetchOrganizerTournaments()
  } catch (err) {
    console.error('Error loading tournaments:', err)
  }
}

onMounted(async () => {
  // Set default dates to today at 00:00
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  tournamentForm.value.start_date = `${year}-${month}-${day}T00:00`
  
  await fetchCategories()
  await loadTournaments()
})
</script>


<style scoped>
.t-row { flex-wrap: wrap; }
.field-error { font-size: 14px; color: var(--danger); }
</style>
