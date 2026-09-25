<template>
  <PageLayout container-size="narrow">
    <PageHeader
      title="Programar partido"
      subtitle="Elige rival, fecha y cancha."
      back-to="/matches"
      back-label="Volver a tus partidos"
    />

    <form class="panel schedule-form" @submit.prevent="handleSubmit">
      <p class="status-pill" :class="(isFromMatchmaking || isCompetitive) ? 'is-competitive' : ''">
        <Icon :name="(isFromMatchmaking || isCompetitive) ? 'heroicons:trophy' : 'heroicons:heart'" class="w-4 h-4" aria-hidden="true" />
        {{ (isFromMatchmaking || isCompetitive) ? 'Partido competitivo' : 'Partido amistoso' }}
      </p>

      <fieldset class="group">
        <legend class="group__title">Rival</legend>
        <div class="segmented" role="group" aria-label="Tipo de rival">
          <button type="button" :aria-pressed="opponentType === 'registered'" @click="opponentType = 'registered'">Jugador registrado</button>
          <button type="button" :aria-pressed="opponentType === 'new'" @click="opponentType = 'new'">Nuevo jugador</button>
        </div>

        <div v-if="opponentType === 'registered'" class="field">
          <label for="opponent" class="form-label">Buscar rival</label>
          <input
            id="opponent"
            v-model="searchQuery"
            type="search"
            class="form-input"
            placeholder="Buscar por nombre"
            autocomplete="off"
            required
            @input="handleSearch"
            @focus="showSearchResults = true"
          >
          <div v-if="showSearchResults && searchResults.length > 0" class="list-surface results">
            <button v-for="result in searchResults" :key="result.id" type="button" class="list-row w-full text-left" @click="selectOpponent(result)">
              <span class="row-copy"><strong>{{ result.name }}</strong><span v-if="result.category" class="meta">{{ result.category.name }}</span></span>
              <Icon name="heroicons:plus-circle" class="w-5 h-5 text-accent" aria-hidden="true" />
            </button>
          </div>
          <p v-if="selectedOpponent" class="selected">
            <Icon name="heroicons:check-circle" class="w-5 h-5 text-accent" aria-hidden="true" />
            Rival: <strong>{{ selectedOpponent.name }}</strong>
          </p>
        </div>

        <div v-if="opponentType === 'new'" class="group__fields">
          <div class="field">
            <label for="opponent-name" class="form-label">Nombre</label>
            <input id="opponent-name" v-model="newOpponent.name" type="text" required autocomplete="off" class="form-input" placeholder="Nombre completo">
          </div>
          <div class="field">
            <label for="opponent-email" class="form-label">Email</label>
            <input id="opponent-email" v-model="newOpponent.email" type="email" required autocomplete="off" class="form-input" placeholder="email@ejemplo.com" aria-describedby="opponent-email-hint">
            <p id="opponent-email-hint" class="meta">Le enviaremos una invitación para que se registre.</p>
          </div>
          <div class="field">
            <label for="opponent-category" class="form-label">Categoría</label>
            <select id="opponent-category" v-model="newOpponent.category_id" required :disabled="categoriesLoading" class="form-select">
              <option value="" disabled>{{ categoriesLoading ? 'Cargando categorías…' : 'Selecciona una categoría' }}</option>
              <option v-for="category in categories" :key="category.id" :value="category.id">
                {{ category.name }}<template v-if="category.description"> - {{ category.description }}</template>
              </option>
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset class="group">
        <legend class="group__title">Cuándo y dónde</legend>
        <div class="group__fields group__fields--two">
          <div class="field">
            <label for="scheduled_at" class="form-label">Fecha y hora</label>
            <input id="scheduled_at" v-model="formData.scheduled_at" type="datetime-local" :min="minDateTime" required class="form-input">
            <p v-if="isDateInPast" class="field-error" role="alert">No puedes programar un partido en el pasado.</p>
          </div>
          <div class="field">
            <label for="location" class="form-label">Cancha <span class="meta inline">(opcional)</span></label>
            <input id="location" v-model="formData.location" type="text" class="form-input" placeholder="Ej: Club de Tenis Quito">
          </div>
        </div>
      </fieldset>

      <fieldset class="group">
        <legend class="group__title">Tipo de partido</legend>
        <p v-if="isFromMatchmaking" class="action-card meta">
          Este partido afectará tu SR y contará para la colocación. Los partidos desde la búsqueda de rivales siempre son competitivos.
        </p>
        <div v-else class="choice-grid" role="group" aria-label="Tipo de partido">
          <button type="button" class="choice" :aria-pressed="isCompetitive" @click="isCompetitive = true">
            <Icon name="heroicons:trophy" class="w-5 h-5" aria-hidden="true" />
            <strong>Competitivo</strong>
            <span class="meta">Afecta tu SR y cuenta para la colocación.</span>
          </button>
          <button type="button" class="choice" :aria-pressed="!isCompetitive" @click="isCompetitive = false">
            <Icon name="heroicons:heart" class="w-5 h-5" aria-hidden="true" />
            <strong>Amistoso</strong>
            <span class="meta">No afecta tu SR ni el ranking.</span>
          </button>
        </div>
      </fieldset>

      <p v-if="error || formError" class="form-error" role="alert">{{ formError || error?.message || 'Error al procesar la solicitud' }}</p>
      <p v-if="success" class="form-ok" role="status">Partido programado.</p>

      <div class="quick-actions">
        <button type="submit" class="btn-primary" :disabled="loading || categoriesLoading || submitting">
          <Icon :name="submitting ? 'heroicons:arrow-path' : 'heroicons:calendar'" class="w-5 h-5" :class="{ 'animate-spin': submitting }" aria-hidden="true" />
          {{ submitting ? 'Programando…' : 'Programar partido' }}
        </button>
        <NuxtLink to="/matches" class="text-link">Cancelar</NuxtLink>
      </div>
    </form>
  </PageLayout>
</template>

<script setup lang="ts">
import type { PlayerSearchResult, Category } from '~/types'
import { getCurrentEcuadorDatetimeLocal } from '~/composables/useTimezone'

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

const route = useRoute()
const opponentType = ref<'registered' | 'new'>('registered')
const searchQuery = ref('')
const showSearchResults = ref(false)
const selectedOpponent = ref<PlayerSearchResult | null>(null)
const submitting = ref(false)
const success = ref(false)
const formError = ref<string | null>(null)
const isCompetitive = ref(true) // Default to competitive

// Check if coming from matchmaking (has opponent query param)
const isFromMatchmaking = computed(() => !!route.query.opponent)

const newOpponent = ref({
  name: '',
  email: '',
  category_id: ''
})

const formData = ref({
  scheduled_at: '',
  location: ''
})

// Get current date/time in datetime-local format (YYYY-MM-DDTHH:mm) using Ecuador timezone
const minDateTime = computed(() => {
  return getCurrentEcuadorDatetimeLocal()
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
  
  // If coming from matchmaking, pre-select the opponent
  if (isFromMatchmaking.value && route.query.opponent) {
    const opponentId = route.query.opponent as string
    try {
      // Fetch opponent details
      const opponent = await $fetch<PlayerSearchResult>(`/api/players/${opponentId}`)
      if (opponent) {
        selectedOpponent.value = opponent
        searchQuery.value = opponent.name
        opponentType.value = 'registered'
        // Matchmaking matches are always competitive
        isCompetitive.value = true
      }
    } catch (err) {
      console.error('Failed to load opponent:', err)
    }
  }
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
      const pendingPlayer = await createPendingPlayer({
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
    // If from matchmaking, always competitive. Otherwise use user's choice
    const matchIsCompetitive = isFromMatchmaking.value ? true : isCompetitive.value
    
    // Send datetime-local as-is - backend will convert it treating it as Ecuador time
    const match = await createMatch(userId.value, {
      player1_id: player.value.id,
      player2_id: player2Id,
      pending_player2_id: pendingPlayerId,
      scheduled_at: formData.value.scheduled_at,
      location: formData.value.location || undefined,
      is_competitive: matchIsCompetitive
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
    // Show error to user - extract message from various possible locations
    let errorMessage = 'Error al registrar el partido. Por favor intenta de nuevo.'
    
    // Try to extract error message from different possible locations
    if (err?.data?.message) {
      errorMessage = err.data.message
    } else if (err?.data?.statusMessage) {
      errorMessage = err.data.statusMessage
    } else if (err?.statusMessage) {
      errorMessage = err.statusMessage
    } else if (err?.message) {
      errorMessage = err.message
    } else if (typeof err?.data === 'string') {
      errorMessage = err.data
    }
    
    formError.value = errorMessage
  } finally {
    submitting.value = false
  }
}

// Set default date to today at 00:00
onMounted(async () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  // Default to 00:00 (midnight)
  formData.value.scheduled_at = `${year}-${month}-${day}T00:00`

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


<style scoped>
.schedule-form { display: grid; gap: 28px; }
.status-pill.is-competitive { background: var(--accent-subtle); color: var(--accent); }
.schedule-form > .status-pill { justify-self: start; }
.group { border: 0; padding: 0; margin: 0; display: grid; gap: 14px; min-width: 0; }
.group__title { font-size: 18px; font-weight: 650; margin-bottom: 4px; }
.group__fields { display: grid; gap: 16px; }
.group__fields--two { grid-template-columns: 1fr 1fr; }
.field { display: grid; gap: 6px; align-content: start; position: relative; min-width: 0; }
.field-error { font-size: 14px; color: var(--danger); }
.field .form-label { margin-bottom: 0; }
.meta.inline { display: inline; font-weight: 400; }
.segmented { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 4px; border-radius: 999px; background: var(--lens); border: 1px solid var(--edge); }
.segmented button { min-height: 44px; border-radius: 999px; border: 0; background: transparent; color: var(--foreground-muted); font-weight: 600; font-size: 15px; }
.segmented button[aria-pressed="true"] { background: var(--surface); color: var(--foreground); }
.results { max-height: 260px; overflow-y: auto; margin-top: 4px; }
.selected { display: flex; align-items: center; gap: 8px; font-size: 15px; }
.choice-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.choice { display: grid; gap: 4px; justify-items: start; text-align: left; padding: 16px; border-radius: 16px; border: 1px solid var(--edge); background: transparent; color: var(--foreground); }
.choice[aria-pressed="true"] { border-color: var(--accent); background: var(--accent-subtle); }
.choice[aria-pressed="true"] > svg { color: var(--accent); }
.form-ok { padding: 12px 16px; border-radius: 14px; background: var(--success-subtle); color: var(--success); }
@media (max-width: 767px) { .group__fields--two, .choice-grid { grid-template-columns: 1fr; } }
</style>
