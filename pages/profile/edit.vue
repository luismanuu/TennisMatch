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

    <div class="h-16"></div>

    <div class="section-padding relative z-10">
      <div class="container-medium px-6">
        <!-- Header -->
        <div class="text-center mb-12 animate-fade-up">
          <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-subtle/30 border border-accent/30 backdrop-blur-sm mb-6">
            <Icon name="heroicons:pencil" class="w-4 h-4 text-accent" />
            <span class="text-size-4 font-semibold text-accent">Editar Perfil</span>
          </div>
          <h1 class="text-size-1 font-semibold text-foreground mb-4">
            Actualiza tu Información
          </h1>
          <p class="text-size-3 font-regular text-foreground-muted">
            Mantén tu perfil actualizado para una mejor experiencia
          </p>
        </div>

        <!-- Form -->
        <div class="glass-card-elevated p-8 md:p-10 max-w-2xl mx-auto animate-fade-up animate-delay-1 hover-lift">
          <form @submit.prevent="handleSubmit" class="space-y-6">
            <!-- Name Field -->
            <div>
              <label for="name" class="flex items-center gap-2 text-size-4 font-semibold text-foreground mb-3">
                <Icon name="heroicons:user" class="w-5 h-5 text-foreground-muted" />
                Nombre
              </label>
              <input
                id="name"
                v-model="formData.name"
                type="text"
                required
                class="w-full px-4 py-3 rounded-xl bg-surface border-2 border-border-subtle text-foreground placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all"
                placeholder="Tu nombre completo"
              />
              <p class="text-size-4 font-regular text-foreground-muted mt-2 flex items-center gap-2">
                <Icon name="heroicons:information-circle" class="w-4 h-4" />
                Este nombre se sincronizará con tu cuenta de Clerk
              </p>
            </div>

            <!-- Phone Number Field -->
            <div>
              <label for="phone_number" class="flex items-center gap-2 text-size-4 font-semibold text-foreground mb-3">
                <Icon name="heroicons:phone" class="w-5 h-5 text-foreground-muted" />
                Teléfono
              </label>
              <input
                id="phone_number"
                v-model="formData.phone_number"
                type="tel"
                class="w-full px-4 py-3 rounded-xl bg-surface border-2 border-border-subtle text-foreground placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all"
                placeholder="+593 99 999 9999"
              />
              <p class="text-size-4 font-regular text-foreground-muted mt-2 flex items-center gap-2">
                <Icon name="heroicons:information-circle" class="w-4 h-4" />
                Opcional - Formato internacional recomendado
              </p>
            </div>

            <!-- City Field -->
            <div>
              <label for="city" class="flex items-center gap-2 text-size-4 font-semibold text-foreground mb-3">
                <Icon name="heroicons:map-pin" class="w-5 h-5 text-foreground-muted" />
                Ciudad
              </label>
              <select
                id="city"
                v-model="formData.city_id"
                required
                :disabled="citiesLoading"
                class="w-full px-4 py-3 rounded-xl bg-surface border-2 border-border-subtle text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
              <p class="text-size-4 font-regular text-foreground-muted mt-2 flex items-center gap-2">
                <Icon name="heroicons:information-circle" class="w-4 h-4" />
                Requerido para el sistema de ranking y matchmaking
              </p>
            </div>

            <!-- Category Field -->
            <div>
              <label for="category" class="flex items-center gap-2 text-size-4 font-semibold text-foreground mb-3">
                <Icon name="heroicons:star" class="w-5 h-5 text-foreground-muted" />
                Categoría
              </label>
              <select
                id="category"
                v-model="formData.category_id"
                required
                :disabled="categoriesLoading"
                class="w-full px-4 py-3 rounded-xl bg-surface border-2 border-border-subtle text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
              <div v-if="selectedCategory?.description" class="mt-3 p-3 rounded-xl bg-accent-subtle/30 border border-accent/30">
                <p class="text-size-4 font-regular text-foreground-muted">
                  {{ selectedCategory.description }}
                </p>
              </div>
            </div>

            <!-- Email (Read-only) -->
            <div>
              <label class="flex items-center gap-2 text-size-4 font-semibold text-foreground mb-3">
                <Icon name="heroicons:envelope" class="w-5 h-5 text-foreground-muted" />
                Email
              </label>
              <input
                type="email"
                :value="user?.primaryEmailAddress?.emailAddress"
                disabled
                class="w-full px-4 py-3 rounded-xl bg-surface border-2 border-border-subtle text-foreground-muted opacity-50 cursor-not-allowed"
              />
              <p class="text-size-4 font-regular text-foreground-muted mt-2 flex items-center gap-2">
                <Icon name="heroicons:lock-closed" class="w-4 h-4" />
                El email no se puede modificar desde aquí
              </p>
            </div>

            <!-- Error Message -->
            <div v-if="error" class="p-4 rounded-xl bg-red-500/20 border border-red-500/50 flex items-center gap-3">
              <Icon name="heroicons:exclamation-circle" class="w-5 h-5 text-red-400 flex-shrink-0" />
              <p class="text-size-4 font-regular text-red-400">{{ error.message }}</p>
            </div>

            <!-- Success Message -->
            <div v-if="success" class="p-4 rounded-xl bg-green-500/20 border border-green-500/50 flex items-center gap-3">
              <Icon name="heroicons:check-circle" class="w-5 h-5 text-green-400 flex-shrink-0" />
              <p class="text-size-4 font-regular text-green-400">Perfil actualizado exitosamente</p>
            </div>

            <!-- Actions -->
            <div class="flex gap-4 pt-4">
              <button
                type="submit"
                :disabled="loading || categoriesLoading || citiesLoading"
                class="btn-primary text-size-3 flex-1 justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Icon v-if="loading" name="heroicons:arrow-path" class="w-5 h-5 mr-2 animate-spin" />
                <Icon v-else name="heroicons:check" class="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                <span v-if="loading">Guardando...</span>
                <span v-else>Guardar Cambios</span>
              </button>
              <NuxtLink
                to="/profile"
                class="btn-secondary text-size-3 px-6 justify-center"
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
import type { Category } from '~/types'

definePageMeta({
  middleware: 'auth'
})

const auth = useAuth()
const { isLoaded: authLoaded } = auth
const { isLoaded: userLoaded, user } = useUser()
const { player, loading, error, fetchPlayer, updatePlayer, createPlayer } = usePlayer()
const { categories, loading: categoriesLoading, fetchCategories } = useCategories()
const { cities, loading: citiesLoading, fetchCities } = useCities()

const isLoaded = computed(() => authLoaded.value && userLoaded.value)
const userId = computed(() => user.value?.id || null)

const formData = ref({
  name: '',
  phone_number: '',
  city_id: '',
  category_id: ''
})

const success = ref(false)

const selectedCategory = computed(() => {
  if (!formData.value.category_id || !categories.value) return null
  return categories.value.find(c => c.id === formData.value.category_id) || null
})

const loadData = async () => {
  if (!isLoaded.value || !userId.value) return

  // Load categories and cities
  await Promise.all([
    fetchCategories(),
    fetchCities()
  ])

  // Load player profile
  await fetchPlayer(userId.value)

  // Populate form
  if (player.value) {
    formData.value = {
      name: player.value.name,
      phone_number: player.value.phone_number || '',
      city_id: player.value.city_id || '',
      category_id: player.value.category_id || ''
    }
  } else if (user.value) {
    // If no player profile, use Clerk user data
    formData.value = {
      name: user.value.fullName || '',
      phone_number: '',
      city_id: '',
      category_id: ''
    }
  }
}

const handleSubmit = async () => {
  if (!userId.value) return

  success.value = false
  error.value = null

  try {
    if (player.value) {
      // Update existing profile
      await updatePlayer(player.value.id, userId.value, {
        name: formData.value.name,
        phone_number: formData.value.phone_number || undefined,
        city_id: formData.value.city_id,
        category_id: formData.value.category_id
      })
    } else {
      // Create new profile
      await createPlayer(userId.value, {
        name: formData.value.name,
        phone_number: formData.value.phone_number || undefined,
        city_id: formData.value.city_id,
        category_id: formData.value.category_id
      })
    }

    success.value = true
    
    // Redirect to profile page after a short delay
    setTimeout(() => {
      navigateTo('/profile')
    }, 1500)
  } catch (err: any) {
    // Error is handled by the composable
    console.error('Error updating profile:', err)
  }
}

onMounted(async () => {
  await loadData()
})

watch([isLoaded, userId], async () => {
  if (isLoaded.value && userId.value) {
    await loadData()
  }
}, { immediate: false })
</script>

