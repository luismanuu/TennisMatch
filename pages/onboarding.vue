<template>
  <div class="min-h-screen">
    <!-- Navigation -->
    <nav class="fixed top-0 left-0 right-0 z-50 border-b border-border-subtle bg-background/80 backdrop-blur-xl">
      <div class="container-wide px-6">
        <div class="flex justify-between items-center h-16">
          <NuxtLink to="/" class="flex items-center gap-3 group">
            <div class="relative w-10 h-10 rounded-xl bg-accent flex items-center justify-center hover-bounce overflow-hidden">
              <span class="text-lg relative z-10">🎾</span>
              <div class="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent"></div>
            </div>
            <span class="text-size-3 font-semibold text-foreground">
              Tenis Ecuador
            </span>
          </NuxtLink>

          <button
            @click="handleSkip"
            class="text-size-4 font-regular text-foreground-muted hover:text-foreground transition-colors"
          >
            Omitir
          </button>
        </div>
      </div>
    </nav>

    <div class="h-16"></div>

    <div class="section-padding">
      <div class="container-medium px-6">
        <!-- Step 1: Welcome -->
        <div v-if="currentStep === 1" class="max-w-2xl mx-auto text-center">
          <div class="w-24 h-24 rounded-2xl bg-accent-subtle flex items-center justify-center mx-auto mb-8">
            <span class="text-5xl">👋</span>
          </div>
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

        <!-- Step 2: Category Selection -->
        <div v-else-if="currentStep === 2" class="max-w-2xl mx-auto">
          <div class="text-center mb-8">
            <h1 class="text-size-1 font-semibold text-foreground mb-4">
              Selecciona tu categoría
            </h1>
            <p class="text-size-3 font-regular text-foreground-muted">
              Esto nos ayuda a emparejarte con jugadores de tu nivel
            </p>
          </div>

          <div v-if="categoriesLoading" class="glass-card-elevated p-12 text-center">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
            <p class="text-size-4 font-regular text-foreground-muted mt-4">Cargando categorías...</p>
          </div>

          <div v-else-if="categories.length === 0" class="glass-card-elevated p-8">
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
                'w-full p-6 rounded-xl border-2 text-left transition-all',
                formData.category_id === category.id
                  ? 'border-accent bg-accent-subtle'
                  : 'border-border-subtle bg-surface hover:border-accent/50'
              ]"
            >
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <h3 class="text-size-2 font-semibold text-foreground mb-2">
                    {{ category.name }}
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
                @click="currentStep = 1"
                class="btn-secondary text-size-3 px-6"
              >
                Atrás
              </button>
            </div>
          </div>
        </div>

        <!-- Step 3: Complete -->
        <div v-else-if="currentStep === 3" class="max-w-2xl mx-auto text-center">
          <div class="w-24 h-24 rounded-2xl bg-green-500/20 flex items-center justify-center mx-auto mb-8">
            <span class="text-5xl">✅</span>
          </div>
          <h1 class="text-size-1 font-semibold text-foreground mb-4">
            ¡Perfil completado!
          </h1>
          <p class="text-size-3 font-regular text-foreground-muted mb-8">
            Ya estás listo para comenzar a competir y seguir tu progreso.
          </p>
          <NuxtLink to="/" class="btn-primary text-size-3 inline-flex items-center">
            Ir al Dashboard
            <svg class="w-5 h-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'auth'
})

const { user, isLoaded } = useClerk()
const { loading, createPlayer } = usePlayer()
const { categories, loading: categoriesLoading, fetchCategories } = useCategories()

const currentStep = ref(1)
const formData = ref({
  name: '',
  category_id: ''
})

const selectCategory = (categoryId: string) => {
  formData.value.category_id = categoryId
}

const handleComplete = async () => {
  if (!user.value?.id || !formData.value.category_id) return

  try {
    await createPlayer(user.value.id, {
      name: user.value.fullName || user.value.firstName || 'Usuario',
      category_id: formData.value.category_id
    })
    
    currentStep.value = 3
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
    formData.value.name = user.value.fullName || user.value.firstName || ''
    await fetchCategories()
  }
})

watch([isLoaded, () => user.value], async () => {
  if (isLoaded.value && user.value) {
    formData.value.name = user.value.fullName || user.value.firstName || ''
    await fetchCategories()
  }
}, { immediate: false })
</script>

