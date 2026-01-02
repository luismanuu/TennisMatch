<template>
  <div class="min-h-screen">
    <!-- Navigation -->
    <AppNavigation />

    <div class="h-16"></div>

    <div class="section-padding">
      <div class="container-medium px-6">
        <!-- Header -->
        <div class="text-center mb-12">
          <h1 class="text-size-1 font-semibold text-foreground mb-4">
            Programar Partido
          </h1>
          <p class="text-size-3 font-regular text-foreground-muted">
            Programa un nuevo partido con un oponente
          </p>
        </div>

        <!-- Form -->
        <div class="glass-card-elevated p-8 max-w-2xl mx-auto">
          <form @submit.prevent="handleSubmit" class="space-y-6">
            <!-- Opponent Type Selection -->
            <div>
              <label class="block text-size-4 font-semibold text-foreground mb-4">
                Tipo de Oponente
              </label>
              <div class="flex gap-4">
                <button
                  type="button"
                  @click="opponentType = 'registered'"
                  :class="[
                    'flex-1 px-4 py-3 rounded-xl border-2 transition-all',
                    opponentType === 'registered'
                      ? 'border-accent bg-accent-subtle/50 text-foreground'
                      : 'border-border-subtle bg-surface text-foreground-muted hover:border-accent/50'
                  ]"
                >
                  Jugador Registrado
                </button>
                <button
                  type="button"
                  @click="opponentType = 'new'"
                  :class="[
                    'flex-1 px-4 py-3 rounded-xl border-2 transition-all',
                    opponentType === 'new'
                      ? 'border-accent bg-accent-subtle/50 text-foreground'
                      : 'border-border-subtle bg-surface text-foreground-muted hover:border-accent/50'
                  ]"
                >
                  Nuevo Jugador
                </button>
              </div>
            </div>

            <!-- Registered Player Selection -->
            <div v-if="opponentType === 'registered'">
              <label for="opponent" class="block text-size-4 font-semibold text-foreground mb-2">
                Buscar Oponente
              </label>
              <input
                id="opponent"
                v-model="searchQuery"
                type="text"
                @input="handleSearch"
                @focus="showSearchResults = true"
                class="w-full px-4 py-3 rounded-xl bg-surface border border-border-subtle text-foreground placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                placeholder="Buscar por nombre..."
                required
              />
              <!-- Search Results -->
              <div v-if="showSearchResults && searchResults.length > 0" class="mt-2 border border-border-subtle rounded-xl bg-surface max-h-60 overflow-y-auto">
                <button
                  v-for="result in searchResults"
                  :key="result.id"
                  type="button"
                  @click="selectOpponent(result)"
                  class="w-full px-4 py-3 text-left hover:bg-accent-subtle/50 transition-colors border-b border-border-subtle last:border-b-0"
                >
                  <p class="text-size-3 font-semibold text-foreground">{{ result.name }}</p>
                  <p v-if="result.category" class="text-size-4 font-regular text-foreground-muted">{{ result.category.name }}</p>
                </button>
              </div>
              <div v-if="selectedOpponent" class="mt-2 p-3 rounded-xl bg-accent-subtle/50 border border-accent/30">
                <p class="text-size-3 font-semibold text-foreground">Oponente seleccionado:</p>
                <p class="text-size-4 font-regular text-foreground-muted">{{ selectedOpponent.name }}</p>
              </div>
            </div>

            <!-- New Player Form -->
            <div v-if="opponentType === 'new'" class="space-y-4">
              <div>
                <label for="opponent-name" class="block text-size-4 font-semibold text-foreground mb-2">
                  Nombre del Oponente
                </label>
                <input
                  id="opponent-name"
                  v-model="newOpponent.name"
                  type="text"
                  required
                  class="w-full px-4 py-3 rounded-xl bg-surface border border-border-subtle text-foreground placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                  placeholder="Nombre completo"
                />
              </div>
              <div>
                <label for="opponent-email" class="block text-size-4 font-semibold text-foreground mb-2">
                  Email del Oponente
                </label>
                <input
                  id="opponent-email"
                  v-model="newOpponent.email"
                  type="email"
                  required
                  class="w-full px-4 py-3 rounded-xl bg-surface border border-border-subtle text-foreground placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                  placeholder="email@ejemplo.com"
                />
                <p class="text-size-4 font-regular text-foreground-muted mt-2">
                  Se enviará una invitación por email para que se registre
                </p>
              </div>
              <div>
                <label for="opponent-category" class="block text-size-4 font-semibold text-foreground mb-2">
                  Categoría del Oponente
                </label>
                <select
                  id="opponent-category"
                  v-model="newOpponent.category_id"
                  required
                  :disabled="categoriesLoading"
                  class="w-full px-4 py-3 rounded-xl bg-surface border border-border-subtle text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="" disabled>Selecciona una categoría</option>
                  <option
                    v-for="category in categories"
                    :key="category.id"
                    :value="category.id"
                  >
                    {{ category.name }}
                    <template v-if="category.description"> - {{ category.description }}</template>
                  </option>
                </select>
              </div>
            </div>

            <!-- Match Details -->
            <div class="pt-4 border-t border-border-subtle space-y-4">
              <div>
                <label for="scheduled_at" class="block text-size-4 font-semibold text-foreground mb-2">
                  Fecha y Hora Programada
                </label>
                <input
                  id="scheduled_at"
                  v-model="formData.scheduled_at"
                  type="datetime-local"
                  :min="minDateTime"
                  required
                  class="w-full px-4 py-3 rounded-xl bg-surface border border-border-subtle text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                />
                <p v-if="isDateInPast" class="text-size-4 font-regular text-red-400 mt-2">
                  No puedes programar un partido en el pasado
                </p>
              </div>

              <div>
                <label for="location" class="block text-size-4 font-semibold text-foreground mb-2">
                  Ubicación (Opcional)
                </label>
                <input
                  id="location"
                  v-model="formData.location"
                  type="text"
                  class="w-full px-4 py-3 rounded-xl bg-surface border border-border-subtle text-foreground placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                  placeholder="Ej: Club de Tenis Quito"
                />
              </div>
            </div>

            <!-- Error Message -->
            <div v-if="error || formError" class="p-4 rounded-xl bg-red-500/20 border border-red-500/50">
              <p class="text-size-4 font-regular text-red-400">{{ error?.message || formError }}</p>
            </div>

            <!-- Success Message -->
            <div v-if="success" class="p-4 rounded-xl bg-green-500/20 border border-green-500/50">
              <p class="text-size-4 font-regular text-green-400">Partido programado exitosamente</p>
            </div>

            <!-- Actions -->
            <div class="flex gap-4 pt-4">
              <button
                type="submit"
                :disabled="loading || categoriesLoading || submitting"
                class="btn-primary text-size-3 flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span v-if="submitting">Programando...</span>
                <span v-else>Programar Partido</span>
              </button>
              <NuxtLink
                to="/matches"
                class="btn-secondary text-size-3 px-6"
              >
                Cancelar
              </NuxtLink>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PlayerSearchResult, Category } from '~/types'

definePageMeta({
  middleware: 'auth'
})

// Use shared auth state composable for consistent behavior
const { isLoaded, userId, user } = useAuthState()
const { player, fetchPlayer } = usePlayer()
const { categories, loading: categoriesLoading, fetchCategories } = useCategories()
const { createMatch, loading, error } = useMatches()
const { createPendingPlayer, loading: pendingLoading } = usePendingPlayers()
const { searchPlayers, results: searchResults, clearResults } = usePlayerSearch()

const opponentType = ref<'registered' | 'new'>('registered')
const searchQuery = ref('')
const showSearchResults = ref(false)
const selectedOpponent = ref<PlayerSearchResult | null>(null)
const submitting = ref(false)
const success = ref(false)
const formError = ref<string | null>(null)

const newOpponent = ref({
  name: '',
  email: '',
  category_id: ''
})

const formData = ref({
  scheduled_at: '',
  location: ''
})

// Get current date/time in datetime-local format (YYYY-MM-DDTHH:mm)
const minDateTime = computed(() => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
})

// Check if selected date is in the past
const isDateInPast = computed(() => {
  if (!formData.value.scheduled_at) return false
  const selectedDate = new Date(formData.value.scheduled_at)
  const now = new Date()
  return selectedDate < now
})

const handleSearch = async () => {
  if (searchQuery.value.trim().length >= 2) {
    // Exclude current player from search results
    const excludeId = player.value?.id
    await searchPlayers(searchQuery.value, excludeId)
    showSearchResults.value = true
  } else {
    clearResults()
    showSearchResults.value = false
  }
}

const selectOpponent = (opponent: PlayerSearchResult) => {
  // Prevent selecting yourself
  if (opponent.id === player.value?.id) {
    return
  }
  selectedOpponent.value = opponent
  searchQuery.value = opponent.name
  showSearchResults.value = false
}

const loadData = async () => {
  if (!isLoaded.value || !userId.value) return

  await fetchCategories()
  await fetchPlayer(userId.value)
}

const handleSubmit = async () => {
  if (!userId.value || !player.value) {
    formError.value = 'Debes tener un perfil de jugador para registrar partidos'
    return
  }

  // Validate date is not in the past
  if (!formData.value.scheduled_at) {
    formError.value = 'Debes seleccionar una fecha y hora'
    return
  }

  const selectedDate = new Date(formData.value.scheduled_at)
  const now = new Date()
  
  if (selectedDate < now) {
    formError.value = 'No puedes programar un partido en el pasado'
    return
  }

  submitting.value = true
  success.value = false
  formError.value = null

  try {
    let pendingPlayerId: string | undefined
    let player2Id: string | undefined

    if (opponentType.value === 'new') {
      // Create pending player and send invitation
      const pendingPlayer = await createPendingPlayer(userId.value, {
        name: newOpponent.value.name,
        email: newOpponent.value.email,
        category_id: newOpponent.value.category_id,
        invited_by_player_id: player.value.id
      })
      pendingPlayerId = pendingPlayer.id
    } else {
      // Use selected registered player
      if (!selectedOpponent.value) {
        formError.value = 'Debes seleccionar un oponente'
        submitting.value = false
        return
      }
      player2Id = selectedOpponent.value.id
    }

    // Create match
    const match = await createMatch(userId.value, {
      player1_id: player.value.id,
      player2_id: player2Id,
      pending_player2_id: pendingPlayerId,
      scheduled_at: formData.value.scheduled_at,
      location: formData.value.location || undefined
    })

    success.value = true

    // Reset form
    opponentType.value = 'registered'
    searchQuery.value = ''
    selectedOpponent.value = null
    newOpponent.value = { name: '', email: '', category_id: '' }
    formData.value = { scheduled_at: '', location: '' }

    // Redirect to match detail page after a short delay
    setTimeout(() => {
      navigateTo(`/matches/${match.id}`)
    }, 1500)
  } catch (err: any) {
    console.error('Error creating match:', err)
    // Show error to user
    const errorMessage = err?.message || err?.statusMessage || 'Error al registrar el partido. Por favor intenta de nuevo.'
    formError.value = errorMessage
  } finally {
    submitting.value = false
  }
}

// Set default date to today
onMounted(async () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  formData.value.scheduled_at = `${year}-${month}-${day}T${hours}:${minutes}`

  await loadData()
})

watch([isLoaded, userId], async () => {
  if (isLoaded.value && userId.value) {
    await loadData()
  }
}, { immediate: false })

// Close search results when clicking outside
onMounted(() => {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (!target.closest('#opponent') && !target.closest('.search-results')) {
      showSearchResults.value = false
    }
  })
})
</script>

