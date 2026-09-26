<template>
  <div class="page-container">
    <header class="nav-island">
      <NuxtLink to="/" class="brand" aria-label="Tenis Ecuador, inicio">
        <BrandMark />
        <span>Tenis <strong>Ecuador</strong></span>
      </NuxtLink>
      <button type="button" class="text-link ml-auto px-2" @click="handleSkip">Omitir</button>
    </header>

    <main id="main" class="te-page te-page--narrow onboarding">
        <!-- Step 1: Welcome -->
        <div v-if="currentStep === 1" class="max-w-2xl mx-auto text-center">
          <div class="onboarding__mark" aria-hidden="true"><BrandMark :size="40" /></div>
          <h1 class="text-size-1 font-semibold text-foreground mb-4">
            ¡Bienvenido a Tenis Ecuador!
          </h1>
          <p class="text-size-3 font-regular text-foreground-muted mb-8">
            Estamos emocionados de tenerte aquí. Completa tu perfil para comenzar a competir y seguir tu progreso.
          </p>
          <button @click="currentStep = 2" class="btn-primary text-size-3">
            Comenzar
            <svg class="w-5 h-5 ml-2 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        </div>

        <!-- Step 2: Phone Number -->
        <div v-else-if="currentStep === 2" class="max-w-2xl mx-auto">
          <div class="text-center mb-8">
            <h1 class="text-size-1 font-semibold text-foreground mb-4">
              Tu número de teléfono
            </h1>
            <p class="text-size-3 font-regular text-foreground-muted">
              Opcional - Nos ayuda a contactarte para partidos y eventos
            </p>
          </div>

          <div class="panel">
            <div class="mb-6">
              <label for="phone_number" class="block text-size-4 font-semibold text-foreground mb-2">
                Teléfono
              </label>
              <input
                id="phone_number"
                v-model="formData.phone_number"
                type="tel"
                class="form-input"
                placeholder="+593 99 999 9999"
              />
              <p class="text-size-4 font-regular text-foreground-muted mt-2">
                Puedes omitir este paso si prefieres
              </p>
            </div>

            <div class="flex gap-4 pt-4">
              <button
                @click="currentStep = 3"
                class="btn-primary text-size-3 flex-1"
              >
                Continuar
                <svg class="w-5 h-5 ml-2 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
              <button
                @click="currentStep = 1"
                class="btn-secondary text-size-3 px-6"
              >
                Atrás
              </button>
            </div>
          </div>
        </div>

        <!-- Step 3: City Selection -->
        <div v-else-if="currentStep === 3" class="max-w-2xl mx-auto">
          <div class="text-center mb-8">
            <h1 class="text-size-1 font-semibold text-foreground mb-4">
              ¿En qué ciudad juegas?
            </h1>
            <p class="text-size-3 font-regular text-foreground-muted">
              Necesitamos tu ciudad para el sistema de ranking y matchmaking
            </p>
          </div>

          <div class="panel">
            <div v-if="citiesLoading" class="mb-6">
              <div class="flex items-center justify-center py-8">
                <Icon name="heroicons:arrow-path" class="w-6 h-6 text-accent animate-spin" />
                <span class="ml-3 text-size-4 font-regular text-foreground-muted">Cargando ciudades...</span>
              </div>
            </div>
            <div v-else class="mb-6">
              <label for="city" class="block text-size-4 font-semibold text-foreground mb-2">
                Ciudad
              </label>
              <select
                id="city"
                v-model="formData.city_id"
                required
                :disabled="citiesLoading"
                class="form-select"
              >
                <option value="" disabled>Selecciona tu ciudad</option>
                <option
                  v-for="city in cities"
                  :key="city.id"
                  :value="city.id"
                >
                  {{ city.name }}
                </option>
              </select>
              <p class="text-size-4 font-regular text-foreground-muted mt-2">
                Este campo es obligatorio para participar en el ranking
              </p>
            </div>

            <div class="flex gap-4 pt-4">
              <button
                @click="currentStep = 4"
                :disabled="!formData.city_id || citiesLoading"
                class="btn-primary text-size-3 flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continuar
                <svg class="w-5 h-5 ml-2 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
              <button
                @click="currentStep = 2"
                class="btn-secondary text-size-3 px-6"
              >
                Atrás
              </button>
            </div>
          </div>
        </div>

        <!-- Step 4: Category Selection -->
        <div v-else-if="currentStep === 4" class="max-w-2xl mx-auto">
          <div class="text-center mb-8">
            <h1 class="text-size-1 font-semibold text-foreground mb-4">
              Selecciona tu categoría
            </h1>
            <p class="text-size-3 font-regular text-foreground-muted">
              Esto nos ayuda a emparejarte con jugadores de tu nivel
            </p>
          </div>

          <form
            v-if="showQuestionnaire"
            class="panel level-quiz mb-6"
            aria-labelledby="level-quiz-title"
            @submit.prevent="requestSuggestion"
          >
            <h2 id="level-quiz-title" class="text-size-2 font-semibold text-foreground mb-2">¿Te ayudamos a elegir?</h2>
            <p class="text-size-4 text-foreground-muted mb-6">
              Responde cuatro preguntas y te sugerimos una categoría. Tú decides cuál usar.
            </p>
            <fieldset v-for="question in LEVEL_QUESTIONS" :key="question.id" class="level-quiz__group">
              <legend class="text-size-4 font-semibold text-foreground mb-3">{{ question.label }}</legend>
              <div class="level-quiz__options">
                <label v-for="option in question.options" :key="option.id" class="level-quiz__option">
                  <input v-model="levelAnswers[question.id]" type="radio" :name="question.id" :value="option.id" />
                  <span>{{ option.label }}</span>
                </label>
              </div>
            </fieldset>
            <label for="self_description" class="block text-size-4 font-semibold text-foreground mb-2">
              ¿Algo más sobre tu juego? <span class="font-regular text-foreground-muted">(opcional)</span>
            </label>
            <textarea
              id="self_description"
              v-model="levelAnswers.self_description"
              class="form-textarea mb-6"
              :maxlength="SELF_DESCRIPTION_MAX"
              rows="3"
              placeholder="Por ejemplo: jugué en el colegio y ahora juego dos veces por semana"
            />
            <div class="flex flex-wrap gap-4">
              <button type="submit" class="btn-primary text-size-3 flex-1" :disabled="!questionnaireComplete || suggestionLoading">
                {{ suggestionLoading ? 'Buscando tu categoría…' : 'Ver sugerencia' }}
              </button>
              <button type="button" class="btn-secondary text-size-3" @click="questionnaireDismissed = true">
                Prefiero elegir yo
              </button>
            </div>
          </form>

          <p v-if="suggestionMissed" class="text-size-4 text-foreground-muted mb-6" role="status">
            No pudimos sugerirte una categoría esta vez. Elige abajo la que mejor te describa.
          </p>

          <div v-if="suggestion" class="panel level-suggestion mb-6" role="status">
            <p class="eyebrow mb-1">Nuestra sugerencia</p>
            <p class="text-size-2 font-semibold text-foreground mb-1">{{ suggestion.name }}</p>
            <p v-if="suggestion.runner_up" class="text-size-4 text-foreground-muted mb-4">
              También podrías encajar en {{ suggestion.runner_up.name }}.
            </p>
            <p class="text-size-4 text-foreground-muted mb-4">
              Es solo una sugerencia: confírmala o elige otra categoría abajo.
            </p>
            <button
              type="button"
              class="btn-secondary text-size-4"
              :aria-pressed="formData.category_id === suggestion.category_id"
              @click="selectCategory(suggestion.category_id)"
            >
              {{ formData.category_id === suggestion.category_id ? 'Categoría seleccionada' : 'Usar esta categoría' }}
            </button>
          </div>

          <div v-if="categoriesLoading" class="panel text-center">
            <Icon name="heroicons:arrow-path" class="w-8 h-8 text-accent animate-spin" aria-hidden="true" />
            <p class="text-size-4 font-regular text-foreground-muted mt-4">Cargando categorías...</p>
          </div>

          <div v-else-if="categories.length === 0" class="panel">
            <p class="text-size-4 font-regular text-foreground-muted text-center">
              No hay categorías disponibles en este momento.
            </p>
          </div>

          <div v-else class="space-y-4">
            <button
              v-for="category in categories"
              :key="category.id"
              @click="selectCategory(category.id)"
              :class="[
                'w-full p-6 rounded-xl border text-left transition-all',
                formData.category_id === category.id
                  ? 'border-accent bg-accent-subtle'
                  : 'border-border-subtle bg-surface hover:border-accent/50'
              ]"
            >
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <h3 class="text-size-2 font-semibold text-foreground mb-2">
                    {{ category.name }}
                    <span v-if="suggestion?.category_id === category.id" class="badge badge-accent ml-2 align-middle">Sugerida</span>
                  </h3>
                  <p v-if="category.description" class="text-size-4 font-regular text-foreground-muted">
                    {{ category.description }}
                  </p>
                </div>
                <div
                  v-if="formData.category_id === category.id"
                  class="w-6 h-6 rounded-full bg-accent flex items-center justify-center flex-shrink-0 ml-4"
                >
                  <svg class="w-4 h-4 text-background" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
            </button>

            <div class="flex gap-4 pt-4">
              <button
                @click="handleComplete"
                :disabled="!formData.category_id || loading"
                class="btn-primary text-size-3 flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span v-if="loading">Creando perfil...</span>
                <span v-else>Completar Perfil</span>
              </button>
              <button
                @click="currentStep = 3"
                class="btn-secondary text-size-3 px-6"
              >
                Atrás
              </button>
            </div>
          </div>
        </div>

        <!-- Step 5: Complete -->
        <div v-else-if="currentStep === 5" class="max-w-2xl mx-auto text-center">
          <div class="w-24 h-24 rounded-2xl bg-green-500/20 flex items-center justify-center mx-auto mb-8">
            <Icon name="heroicons:check-circle" class="w-12 h-12 text-success" aria-hidden="true" />
          </div>
          <h1 class="text-size-1 font-semibold text-foreground mb-4">
            ¡Perfil completado!
          </h1>
          <p class="text-size-3 font-regular text-foreground-muted mb-8">
            Ya estás listo para comenzar a competir y seguir tu progreso.
          </p>
          <NuxtLink to="/" class="btn-primary text-size-3 inline-flex items-center">
            Ir al inicio
            <svg class="w-5 h-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </NuxtLink>
        </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { LEVEL_QUESTIONS, SELF_DESCRIPTION_MAX, type LevelSuggestion } from '~/utils/level-questionnaire'

definePageMeta({
  middleware: 'auth'
})

const { isLoaded, user, userId } = useAuthState()
const { loading, createPlayer } = usePlayer()
const { categories, loading: categoriesLoading, fetchCategories } = useCategories()
const { cities, loading: citiesLoading, fetchCities } = useCities()


const currentStep = ref(1)
const formData = ref({
  name: '',
  phone_number: '',
  city_id: '',
  category_id: ''
})

const selectCategory = (categoryId: string) => {
  formData.value.category_id = categoryId
}

// Jev level suggestion (feature-flagged). Advisory only: it never picks the category for the player.
const levelEnabled = ref(false)
const questionnaireDismissed = ref(false)
const suggestionLoading = ref(false)
const suggestion = ref<LevelSuggestion | null>(null)
const suggestionMissed = ref(false)
const levelAnswers = ref<Record<string, string>>({ self_description: '' })

const questionnaireComplete = computed(() => LEVEL_QUESTIONS.every((q) => Boolean(levelAnswers.value[q.id])))
const showQuestionnaire = computed(
  () => levelEnabled.value && !questionnaireDismissed.value && !suggestion.value && categories.value.length > 0,
)

const requestSuggestion = async () => {
  if (!questionnaireComplete.value) return
  suggestionLoading.value = true
  try {
    const res = await $fetch<{ suggestion: LevelSuggestion | null }>('/api/players/level-suggestion', {
      method: 'POST',
      body: levelAnswers.value,
    })
    suggestion.value = res.suggestion
  } catch {
    suggestion.value = null
  } finally {
    suggestionLoading.value = false
    questionnaireDismissed.value = true
    suggestionMissed.value = !suggestion.value
  }
}

const loadLevelEnabled = async () => {
  try {
    levelEnabled.value = (await $fetch<{ enabled: boolean }>('/api/players/level-suggestion')).enabled
  } catch {
    levelEnabled.value = false
  }
}

const handleComplete = async () => {
  if (!userId.value || !formData.value.category_id || !formData.value.city_id) return

  try {
    await createPlayer(userId.value, {
      name: formData.value.name || user.value?.name || 'Usuario',
      phone_number: formData.value.phone_number || undefined,
      city_id: formData.value.city_id,
      category_id: formData.value.category_id
    })
    
    currentStep.value = 5
  } catch (error) {
    console.error('Error creating profile:', error)
    // Error handling is done by the composable
  }
}

const handleSkip = () => {
  navigateTo('/')
}

onMounted(async () => {
  if (isLoaded.value && user.value) {
    formData.value.name = user.value.name || ''
    await Promise.all([
      fetchCategories(),
      fetchCities(),
      loadLevelEnabled()
    ])
  }
})

watch([isLoaded, () => user.value], async () => {
  if (isLoaded.value && user.value) {
    formData.value.name = user.value.name || ''
    await Promise.all([
      fetchCategories(),
      fetchCities(),
      loadLevelEnabled()
    ])
  }
}, { immediate: false })
</script>


<style scoped>
.onboarding { min-height: 100dvh; }
.level-quiz__group { border: 0; padding: 0; margin: 0 0 24px; }
.level-quiz__options { display: flex; flex-wrap: wrap; gap: 8px; }
.level-quiz__option { position: relative; display: inline-flex; align-items: center; min-height: 44px; padding: 10px 16px; border-radius: 999px; background: var(--lens); border: 1px solid var(--edge); color: var(--foreground); font-size: var(--font-size-4); cursor: pointer; transition: background-color 160ms ease, border-color 160ms ease; }
.level-quiz__option input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.level-quiz__option:has(input:checked) { background: var(--accent-subtle); border-color: var(--accent); color: var(--accent); }
.level-quiz__option:has(input:focus-visible) { outline: 3px solid var(--focus); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .level-quiz__option { transition: none; } }
.onboarding__mark { display: grid; place-items: center; width: 80px; height: 80px; margin: 0 auto 24px; border-radius: 50%; background: var(--accent-subtle); color: var(--accent); }
.onboarding :deep(h1) { font-size: var(--font-size-1); line-height: 1.12; letter-spacing: -0.035em; text-wrap: balance; }
</style>
