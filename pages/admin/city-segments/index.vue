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
          <NuxtLink to="/admin" class="inline-flex items-center gap-2 text-foreground-muted hover:text-accent transition-colors mb-4">
            <Icon name="heroicons:arrow-left" class="w-5 h-5" />
            <span class="text-size-4">Volver al Panel de Admin</span>
          </NuxtLink>
          <div class="flex items-center gap-3 mb-2">
            <div class="w-12 h-12 rounded-xl bg-accent-subtle flex items-center justify-center">
              <Icon name="heroicons:map" class="w-6 h-6 text-accent" />
            </div>
            <div>
              <h1 class="text-size-1 font-semibold text-foreground">Regiones de Matchmaking</h1>
              <p class="text-size-4 font-regular text-foreground-muted">
                Configura grupos de ciudades para el sistema de matchmaking
              </p>
            </div>
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="glass-card-elevated p-12 text-center animate-fade-in-scale">
          <div class="w-16 h-16 rounded-full bg-accent-subtle flex items-center justify-center mx-auto mb-6">
            <Icon name="heroicons:arrow-path" class="w-8 h-8 text-accent animate-spin" />
          </div>
          <p class="text-size-3 font-regular text-foreground-muted">Cargando regiones...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="glass-card-elevated p-10 max-w-md mx-auto animate-fade-in-scale">
          <div class="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
            <Icon name="heroicons:exclamation-triangle" class="w-10 h-10 text-red-400" />
          </div>
          <h3 class="text-size-2 font-semibold text-foreground mb-3 text-center">Error</h3>
          <p class="text-size-4 font-regular text-foreground-muted mb-6 text-center">{{ error }}</p>
          <button @click="loadData" class="btn-primary text-size-3 w-full justify-center group">
            <Icon name="heroicons:arrow-path" class="w-5 h-5 mr-2 group-hover:rotate-180 transition-transform duration-500" />
            Reintentar
          </button>
        </div>

        <template v-else>
          <!-- Create/Edit Segment Form -->
          <div class="glass-card-elevated p-6 mb-8 animate-fade-up">
            <h2 class="text-size-2 font-semibold text-foreground mb-4">
              {{ editingSegmentId ? 'Editar Región' : 'Crear Nueva Región' }}
            </h2>
            <form @submit.prevent="editingSegmentId ? handleUpdateSegment() : handleCreateSegment()" class="space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-size-4 font-semibold text-foreground mb-2">
                    Nombre *
                  </label>
                  <input
                    v-model="segmentForm.name"
                    type="text"
                    required
                    class="w-full px-4 py-2 rounded-lg bg-surface border-2 border-border text-foreground focus:border-accent focus:outline-none"
                    placeholder="ej. Área Metropolitana de Guayaquil"
                  />
                </div>
                <div>
                  <label class="block text-size-4 font-semibold text-foreground mb-2">
                    Descripción
                  </label>
                  <input
                    v-model="segmentForm.description"
                    type="text"
                    class="w-full px-4 py-2 rounded-lg bg-surface border-2 border-border text-foreground focus:border-accent focus:outline-none"
                    placeholder="Descripción opcional"
                  />
                </div>
              </div>
              
              <!-- City Selection (only for new segments) -->
              <div v-if="!editingSegmentId">
                <label class="block text-size-4 font-semibold text-foreground mb-2">
                  Ciudades (opcional)
                </label>
                <div class="flex flex-wrap gap-2 p-4 bg-surface rounded-lg border-2 border-border">
                  <label 
                    v-for="city in allCities" 
                    :key="city.id"
                    class="flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-all"
                    :class="selectedCityIds.includes(city.id) 
                      ? 'bg-accent-subtle border-accent text-foreground' 
                      : 'bg-surface border-border-subtle text-foreground-muted hover:border-accent/50'"
                  >
                    <input
                      type="checkbox"
                      :value="city.id"
                      v-model="selectedCityIds"
                      class="hidden"
                    />
                    <Icon 
                      :name="selectedCityIds.includes(city.id) ? 'heroicons:check-circle' : 'heroicons:plus-circle'" 
                      class="w-4 h-4"
                    />
                    <span class="text-size-4">{{ city.name }}</span>
                  </label>
                </div>
              </div>
              
              <div class="flex items-center gap-4">
                <button
                  type="submit"
                  :disabled="formLoading || !segmentForm.name"
                  class="btn-primary text-size-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Icon v-if="formLoading" name="heroicons:arrow-path" class="w-4 h-4 mr-2 animate-spin" />
                  <span v-if="formLoading">{{ editingSegmentId ? 'Guardando...' : 'Creando...' }}</span>
                  <span v-else>{{ editingSegmentId ? 'Guardar Cambios' : 'Crear Región' }}</span>
                </button>
                <button
                  type="button"
                  @click="resetForm"
                  class="btn-secondary text-size-4"
                >
                  {{ editingSegmentId ? 'Cancelar' : 'Limpiar' }}
                </button>
              </div>
            </form>
          </div>

          <!-- Segments List -->
          <div v-if="segments.length > 0" class="space-y-6 animate-fade-up animate-delay-1">
            <div 
              v-for="segment in segments" 
              :key="segment.id"
              class="glass-card-elevated p-6 hover-lift"
            >
              <div class="flex items-start justify-between mb-4">
                <div>
                  <h3 class="text-size-2 font-semibold text-foreground mb-1">{{ segment.name }}</h3>
                  <p v-if="segment.description" class="text-size-4 text-foreground-muted">
                    {{ segment.description }}
                  </p>
                </div>
                <div class="flex gap-2">
                  <button
                    @click="handleEditSegment(segment)"
                    class="btn-secondary text-size-4 !py-2 !px-4"
                  >
                    <Icon name="heroicons:pencil" class="w-4 h-4 mr-1" />
                    Editar
                  </button>
                  <button
                    @click="handleDeleteSegment(segment.id, segment.name)"
                    :disabled="deletingIds.has(segment.id)"
                    class="btn-danger text-size-4 !py-2 !px-4 disabled:opacity-50"
                  >
                    <Icon v-if="deletingIds.has(segment.id)" name="heroicons:arrow-path" class="w-4 h-4 mr-1 animate-spin" />
                    <Icon v-else name="heroicons:trash" class="w-4 h-4 mr-1" />
                    Eliminar
                  </button>
                </div>
              </div>
              
              <!-- Cities in this segment -->
              <div>
                <div class="flex items-center justify-between mb-3">
                  <h4 class="text-size-3 font-semibold text-foreground">
                    Ciudades ({{ segment.cities?.length || 0 }})
                  </h4>
                  <button
                    @click="openAddCitiesModal(segment)"
                    class="text-size-4 text-accent hover:underline flex items-center gap-1"
                  >
                    <Icon name="heroicons:plus" class="w-4 h-4" />
                    Agregar ciudades
                  </button>
                </div>
                
                <div v-if="segment.cities && segment.cities.length > 0" class="flex flex-wrap gap-2">
                  <div 
                    v-for="city in segment.cities" 
                    :key="city.id"
                    class="flex items-center gap-2 px-3 py-2 bg-surface rounded-lg border-2 border-border-subtle"
                  >
                    <Icon name="heroicons:building-office-2" class="w-4 h-4 text-accent" />
                    <span class="text-size-4 text-foreground">{{ city.name }}</span>
                    <button
                      @click="handleRemoveCity(segment.id, city.id, city.name, segment.name)"
                      :disabled="removingCityIds.has(`${segment.id}-${city.id}`)"
                      class="text-red-400 hover:text-red-300 transition-colors"
                    >
                      <Icon 
                        v-if="removingCityIds.has(`${segment.id}-${city.id}`)" 
                        name="heroicons:arrow-path" 
                        class="w-4 h-4 animate-spin" 
                      />
                      <Icon v-else name="heroicons:x-mark" class="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p v-else class="text-size-4 text-foreground-muted italic">
                  No hay ciudades asignadas a esta región
                </p>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else class="glass-card-elevated p-12 text-center max-w-md mx-auto animate-fade-in-scale">
            <div class="w-24 h-24 rounded-2xl bg-gradient-to-br from-accent-subtle to-accent-subtle/50 border-2 border-accent/30 flex items-center justify-center mx-auto mb-6">
              <Icon name="heroicons:map" class="w-12 h-12 text-accent" />
            </div>
            <h3 class="text-size-2 font-semibold text-foreground mb-4">No hay regiones</h3>
            <p class="text-size-4 font-regular text-foreground-muted leading-relaxed">
              Crea tu primera región de matchmaking para agrupar ciudades cercanas.
            </p>
          </div>
        </template>

        <!-- Add Cities Modal -->
        <Teleport to="body">
          <div 
            v-if="addCitiesModal.show" 
            class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            @click.self="closeAddCitiesModal"
          >
            <div class="glass-card-elevated p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-size-2 font-semibold text-foreground">
                  Agregar ciudades a "{{ addCitiesModal.segmentName }}"
                </h3>
                <button @click="closeAddCitiesModal" class="text-foreground-muted hover:text-foreground">
                  <Icon name="heroicons:x-mark" class="w-6 h-6" />
                </button>
              </div>
              
              <div class="space-y-2 mb-6">
                <label 
                  v-for="city in availableCitiesForModal" 
                  :key="city.id"
                  class="flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all"
                  :class="modalSelectedCityIds.includes(city.id) 
                    ? 'bg-accent-subtle border-accent' 
                    : 'bg-surface border-border-subtle hover:border-accent/50'"
                >
                  <input
                    type="checkbox"
                    :value="city.id"
                    v-model="modalSelectedCityIds"
                    class="w-5 h-5 rounded border-border text-accent focus:ring-accent"
                  />
                  <span class="text-size-4 text-foreground">{{ city.name }}</span>
                </label>
                
                <p v-if="availableCitiesForModal.length === 0" class="text-size-4 text-foreground-muted text-center py-4">
                  Todas las ciudades ya están asignadas a esta región
                </p>
              </div>
              
              <div class="flex justify-end gap-3">
                <button @click="closeAddCitiesModal" class="btn-secondary text-size-4">
                  Cancelar
                </button>
                <button 
                  @click="handleAddCitiesToSegment"
                  :disabled="modalSelectedCityIds.length === 0 || addingCities"
                  class="btn-primary text-size-4 disabled:opacity-50"
                >
                  <Icon v-if="addingCities" name="heroicons:arrow-path" class="w-4 h-4 mr-2 animate-spin" />
                  Agregar {{ modalSelectedCityIds.length }} ciudad(es)
                </button>
              </div>
            </div>
          </div>
        </Teleport>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CitySegment, City } from '~/types'

definePageMeta({
  middleware: ['admin']
})

const { user } = useUser()
const toast = useToastNotifications()

// State
const loading = ref(true)
const formLoading = ref(false)
const error = ref<string | null>(null)
const segments = ref<CitySegment[]>([])
const allCities = ref<City[]>([])
const deletingIds = ref<Set<string>>(new Set())
const removingCityIds = ref<Set<string>>(new Set())
const addingCities = ref(false)

// Form state
const editingSegmentId = ref<string | null>(null)
const segmentForm = ref({
  name: '',
  description: ''
})
const selectedCityIds = ref<string[]>([])

// Add cities modal
const addCitiesModal = ref({
  show: false,
  segmentId: '',
  segmentName: '',
  existingCityIds: [] as string[]
})
const modalSelectedCityIds = ref<string[]>([])

// Computed
const availableCitiesForModal = computed(() => {
  return allCities.value.filter(
    city => !addCitiesModal.value.existingCityIds.includes(city.id)
  )
})

// Load data
const loadData = async () => {
  try {
    loading.value = true
    error.value = null
    
    const clerkId = user.value?.id
    if (!clerkId) {
      error.value = 'User not authenticated'
      return
    }
    
    // Load segments
    const segmentsResponse = await $fetch('/api/admin/city-segments', {
      query: { clerk_id: clerkId }
    })
    segments.value = (segmentsResponse as any).segments || []
    
    // Load cities
    const citiesResponse = await $fetch('/api/cities')
    allCities.value = citiesResponse as City[]
  } catch (err: any) {
    console.error('Error loading data:', err)
    error.value = err.data?.message || err.message || 'Failed to load data'
  } finally {
    loading.value = false
  }
}

// Form handlers
const resetForm = () => {
  editingSegmentId.value = null
  segmentForm.value = { name: '', description: '' }
  selectedCityIds.value = []
}

const handleEditSegment = (segment: CitySegment) => {
  editingSegmentId.value = segment.id
  segmentForm.value = {
    name: segment.name,
    description: segment.description || ''
  }
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const handleCreateSegment = async () => {
  try {
    formLoading.value = true
    const clerkId = user.value?.id
    
    await $fetch('/api/admin/city-segments', {
      method: 'POST',
      body: {
        clerk_id: clerkId,
        name: segmentForm.value.name,
        description: segmentForm.value.description || undefined,
        city_ids: selectedCityIds.value.length > 0 ? selectedCityIds.value : undefined
      }
    })
    
    toast.success(`Región "${segmentForm.value.name}" creada exitosamente`)
    resetForm()
    await loadData()
  } catch (err: any) {
    console.error('Error creating segment:', err)
    toast.error(err.data?.message || 'Error al crear la región')
  } finally {
    formLoading.value = false
  }
}

const handleUpdateSegment = async () => {
  if (!editingSegmentId.value) return
  
  try {
    formLoading.value = true
    const clerkId = user.value?.id
    
    await $fetch(`/api/admin/city-segments/${editingSegmentId.value}`, {
      method: 'PUT',
      body: {
        clerk_id: clerkId,
        name: segmentForm.value.name,
        description: segmentForm.value.description || undefined
      }
    })
    
    toast.success('Región actualizada exitosamente')
    resetForm()
    await loadData()
  } catch (err: any) {
    console.error('Error updating segment:', err)
    toast.error(err.data?.message || 'Error al actualizar la región')
  } finally {
    formLoading.value = false
  }
}

const handleDeleteSegment = async (segmentId: string, segmentName: string) => {
  if (!confirm(`¿Estás seguro de eliminar la región "${segmentName}"?`)) {
    return
  }
  
  try {
    deletingIds.value.add(segmentId)
    const clerkId = user.value?.id
    
    await $fetch(`/api/admin/city-segments/${segmentId}`, {
      method: 'DELETE',
      query: { clerk_id: clerkId }
    })
    
    toast.success(`Región "${segmentName}" eliminada`)
    await loadData()
  } catch (err: any) {
    console.error('Error deleting segment:', err)
    toast.error(err.data?.message || 'Error al eliminar la región')
  } finally {
    deletingIds.value.delete(segmentId)
  }
}

// City management
const openAddCitiesModal = (segment: CitySegment) => {
  addCitiesModal.value = {
    show: true,
    segmentId: segment.id,
    segmentName: segment.name,
    existingCityIds: segment.cities?.map(c => c.id) || []
  }
  modalSelectedCityIds.value = []
}

const closeAddCitiesModal = () => {
  addCitiesModal.value = {
    show: false,
    segmentId: '',
    segmentName: '',
    existingCityIds: []
  }
  modalSelectedCityIds.value = []
}

const handleAddCitiesToSegment = async () => {
  if (modalSelectedCityIds.value.length === 0) return
  
  try {
    addingCities.value = true
    const clerkId = user.value?.id
    
    await $fetch(`/api/admin/city-segments/${addCitiesModal.value.segmentId}/cities`, {
      method: 'POST',
      body: {
        clerk_id: clerkId,
        city_ids: modalSelectedCityIds.value
      }
    })
    
    toast.success('Ciudades agregadas exitosamente')
    closeAddCitiesModal()
    await loadData()
  } catch (err: any) {
    console.error('Error adding cities:', err)
    toast.error(err.data?.message || 'Error al agregar ciudades')
  } finally {
    addingCities.value = false
  }
}

const handleRemoveCity = async (segmentId: string, cityId: string, cityName: string, segmentName: string) => {
  if (!confirm(`¿Eliminar "${cityName}" de la región "${segmentName}"?`)) {
    return
  }
  
  const key = `${segmentId}-${cityId}`
  try {
    removingCityIds.value.add(key)
    const clerkId = user.value?.id
    
    await $fetch(`/api/admin/city-segments/${segmentId}/cities`, {
      method: 'DELETE',
      query: { clerk_id: clerkId, city_id: cityId }
    })
    
    toast.success(`"${cityName}" eliminada de la región`)
    await loadData()
  } catch (err: any) {
    console.error('Error removing city:', err)
    toast.error(err.data?.message || 'Error al eliminar la ciudad')
  } finally {
    removingCityIds.value.delete(key)
  }
}

// Load data on mount
onMounted(() => {
  loadData()
})
</script>
