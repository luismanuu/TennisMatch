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

          <div class="flex items-center gap-4">
            <NuxtLink to="/profile" class="text-size-4 font-regular text-foreground-muted hover:text-foreground transition-colors">
              Volver al Perfil
            </NuxtLink>
          </div>
        </div>
      </div>
    </nav>

    <div class="h-16"></div>

    <div class="section-padding">
      <div class="container-medium px-6">
        <!-- Header -->
        <div class="text-center mb-12">
          <h1 class="text-size-1 font-semibold text-foreground mb-4">
            Editar Perfil
          </h1>
          <p class="text-size-3 font-regular text-foreground-muted">
            Actualiza tu información personal
          </p>
        </div>

        <!-- Form -->
        <div class="glass-card-elevated p-8 max-w-2xl mx-auto">
          <form @submit.prevent="handleSubmit" class="space-y-6">
            <!-- Name Field -->
            <div>
              <label for="name" class="block text-size-4 font-semibold text-foreground mb-2">
                Nombre
              </label>
              <input
                id="name"
                v-model="formData.name"
                type="text"
                required
                class="w-full px-4 py-3 rounded-xl bg-surface border border-border-subtle text-foreground placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                placeholder="Tu nombre completo"
              />
              <p class="text-size-4 font-regular text-foreground-muted mt-2">
                Este nombre se sincronizará con tu cuenta de Clerk
              </p>
            </div>

            <!-- Category Field -->
            <div>
              <label for="category" class="block text-size-4 font-semibold text-foreground mb-2">
                Categoría
              </label>
              <select
                id="category"
                v-model="formData.category_id"
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
              <p v-if="selectedCategory?.description" class="text-size-4 font-regular text-foreground-muted mt-2">
                {{ selectedCategory.description }}
              </p>
            </div>

            <!-- Email (Read-only) -->
            <div>
              <label class="block text-size-4 font-semibold text-foreground mb-2">
                Email
              </label>
              <input
                type="email"
                :value="user?.primaryEmailAddress?.emailAddress"
                disabled
                class="w-full px-4 py-3 rounded-xl bg-surface border border-border-subtle text-foreground-muted opacity-50 cursor-not-allowed"
              />
            </div>

            <!-- Error Message -->
            <div v-if="error" class="p-4 rounded-xl bg-red-500/20 border border-red-500/50">
              <p class="text-size-4 font-regular text-red-400">{{ error.message }}</p>
            </div>

            <!-- Success Message -->
            <div v-if="success" class="p-4 rounded-xl bg-green-500/20 border border-green-500/50">
              <p class="text-size-4 font-regular text-green-400">Perfil actualizado exitosamente</p>
            </div>

            <!-- Actions -->
            <div class="flex gap-4 pt-4">
              <button
                type="submit"
                :disabled="loading || categoriesLoading"
                class="btn-primary text-size-3 flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span v-if="loading">Guardando...</span>
                <span v-else>Guardar Cambios</span>
              </button>
              <NuxtLink
                to="/profile"
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
import type { Category } from '~/types'

definePageMeta({
  middleware: 'auth'
})

const auth = useAuth()
const { isLoaded: authLoaded } = auth
const { isLoaded: userLoaded, user } = useUser()
const { player, loading, error, fetchPlayer, updatePlayer, createPlayer } = usePlayer()
const { categories, loading: categoriesLoading, fetchCategories } = useCategories()

const isLoaded = computed(() => authLoaded.value && userLoaded.value)
const userId = computed(() => user.value?.id || null)

const formData = ref({
  name: '',
  category_id: ''
})

const success = ref(false)

const selectedCategory = computed(() => {
  if (!formData.value.category_id || !categories.value) return null
  return categories.value.find(c => c.id === formData.value.category_id) || null
})

const loadData = async () => {
  if (!isLoaded.value || !userId.value) return

  // Load categories
  await fetchCategories()

  // Load player profile
  await fetchPlayer(userId.value)

  // Populate form
  if (player.value) {
    formData.value = {
      name: player.value.name,
      category_id: player.value.category_id || ''
    }
  } else if (user.value) {
    // If no player profile, use Clerk user data
    formData.value = {
      name: user.value.fullName || '',
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
        category_id: formData.value.category_id
      })
    } else {
      // Create new profile
      await createPlayer(userId.value, {
        name: formData.value.name,
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

