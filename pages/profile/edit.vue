<template>
  <PageLayout container-size="narrow">
    <PageHeader
      title="Editar perfil"
      subtitle="Tu identidad en la comunidad. Ciudad y categoría definen tu ranking y tus rivales."
      back-to="/profile"
      back-label="Volver a tu perfil"
    />

    <form class="panel edit-form" @submit.prevent="handleSubmit">
      <div class="field">
        <label for="name" class="form-label">Nombre</label>
        <input id="name" v-model="formData.name" type="text" required autocomplete="name" class="form-input" placeholder="Tu nombre completo" aria-describedby="name-hint">
        <p id="name-hint" class="meta">Este nombre se sincroniza con tu cuenta.</p>
      </div>

      <div class="field">
        <label for="phone_number" class="form-label">Teléfono <span class="meta inline">(opcional)</span></label>
        <input id="phone_number" v-model="formData.phone_number" type="tel" autocomplete="tel" inputmode="tel" class="form-input" placeholder="+593 99 999 9999" aria-describedby="phone-hint">
        <p id="phone-hint" class="meta">Formato internacional recomendado. Tus rivales lo usan para coordinar por WhatsApp.</p>
      </div>

      <div class="field-row">
        <div class="field">
          <label for="city" class="form-label">Ciudad</label>
          <select id="city" v-model="formData.city_id" required :disabled="citiesLoading" class="form-select" aria-describedby="city-hint">
            <option value="" disabled>{{ citiesLoading ? 'Cargando ciudades…' : 'Selecciona tu ciudad' }}</option>
            <option v-for="city in cities" :key="city.id" :value="city.id">{{ city.name }}</option>
          </select>
          <p id="city-hint" class="meta">Requerida para el ranking y la búsqueda de rivales.</p>
        </div>

        <div class="field">
          <label for="category" class="form-label">Categoría</label>
          <select id="category" v-model="formData.category_id" required :disabled="categoriesLoading" class="form-select">
            <option value="" disabled>{{ categoriesLoading ? 'Cargando categorías…' : 'Selecciona una categoría' }}</option>
            <option v-for="category in categories" :key="category.id" :value="category.id">
              {{ category.name }}<template v-if="category.description"> - {{ category.description }}</template>
            </option>
          </select>
          <p v-if="selectedCategory?.description" class="meta">{{ selectedCategory.description }}</p>
        </div>
      </div>

      <div class="field">
        <label for="email" class="form-label">Email</label>
        <input id="email" type="email" :value="user?.primaryEmailAddress?.emailAddress" disabled class="form-input" aria-describedby="email-hint">
        <p id="email-hint" class="meta">El email se cambia desde Ajustes, en Cuenta y seguridad.</p>
      </div>

      <p v-if="error" class="form-status form-status--error" role="alert">
        <Icon name="heroicons:exclamation-circle" class="w-5 h-5 flex-shrink-0" aria-hidden="true" />
        {{ error.message }}
      </p>
      <p v-if="success" class="form-status form-status--ok" role="status">
        <Icon name="heroicons:check-circle" class="w-5 h-5 flex-shrink-0" aria-hidden="true" />
        Perfil actualizado. Te llevamos a tu perfil…
      </p>

      <div class="quick-actions">
        <button type="submit" class="btn-primary" :disabled="loading || categoriesLoading || citiesLoading">
          <Icon v-if="loading" name="heroicons:arrow-path" class="w-5 h-5 animate-spin" aria-hidden="true" />
          <Icon v-else name="heroicons:check" class="w-5 h-5" aria-hidden="true" />
          {{ loading ? 'Guardando…' : 'Guardar cambios' }}
        </button>
        <NuxtLink to="/profile" class="text-link">Cancelar</NuxtLink>
      </div>
    </form>
  </PageLayout>
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


<style scoped>
.edit-form { display: grid; gap: 24px; }
.field { display: grid; gap: 6px; align-content: start; min-width: 0; }
.field .form-label { margin-bottom: 0; }
.field-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; }
.meta.inline { display: inline; font-weight: 400; }
.form-input:disabled, .form-select:disabled { opacity: 0.6; cursor: not-allowed; }
.form-status { display: flex; align-items: flex-start; gap: 10px; padding: 12px 16px; border-radius: 14px; font-size: 15px; }
.form-status--error { background: var(--danger-subtle); color: var(--danger); }
.form-status--ok { background: var(--success-subtle); color: var(--success); }
@media (max-width: 767px) { .field-row { grid-template-columns: 1fr; gap: 24px; } }
</style>
