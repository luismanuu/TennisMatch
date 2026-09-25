<template>
  <PageLayout container-size="medium">
        <!-- Header -->
        <div class="page-heading">
          <NuxtLink to="/admin" class="text-link">
            <Icon name="heroicons:arrow-left" class="w-5 h-5" aria-hidden="true" />
            Volver al Panel de Admin
          </NuxtLink>
          <div class="flex items-center gap-3 mb-2">
            <div>
              <h1>Regiones de Matchmaking</h1>
              <p class="meta">
                Configura grupos de ciudades para el sistema de matchmaking
              </p>
            </div>
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="panel text-center">
          <div class="w-16 h-16 rounded-full bg-accent-subtle flex items-center justify-center mx-auto mb-6">
            <Icon name="heroicons:arrow-path" class="w-8 h-8 text-accent animate-spin" />
          </div>
          <p class="text-size-3 font-regular text-foreground-muted">Cargando regiones...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="panel max-w-md mx-auto">
          <div class="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
            <Icon name="heroicons:exclamation-triangle" class="w-10 h-10 text-red-400" />
          </div>
          <h3 class="text-size-2 font-semibold text-foreground mb-3 text-center">Error</h3>
          <p class="text-size-4 font-regular text-foreground-muted mb-6 text-center">{{ error }}</p>
          <button @click="loadData" class="btn-primary text-size-3 w-full justify-center group">
            <Icon name="heroicons:arrow-path" class="w-5 h-5" />
            Reintentar
          </button>
        </div>

        <template v-else>
          <!-- Create/Edit Segment Form -->
          <div class="panel mb-8">
            <h2 class="panel-title">
              {{ editingSegmentId ? 'Editar Región' : 'Crear Nueva Región' }}
            </h2>
            <form @submit.prevent="editingSegmentId ? handleUpdateSegment() : handleCreateSegment()" class="space-y-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="form-label">
                    Nombre *
                  </label>
                  <input
                    v-model="segmentForm.name"
                    type="text"
                    required
                    class="form-input"
                    placeholder="ej. Área Metropolitana de Guayaquil"
                  />
                </div>
                <div>
                  <label class="form-label">
                    Descripción
                  </label>
                  <input
                    v-model="segmentForm.description"
                    type="text"
                    class="form-input"
                    placeholder="Descripción opcional"
                  />
                </div>
              </div>
              
              <!-- City Selection (only for new segments) -->
              <div v-if="!editingSegmentId">
                <label class="form-label">
                  Ciudades (opcional)
                </label>
                <div class="flex flex-wrap gap-2 p-4 bg-surface rounded-lg border border-border">
                  <label 
                    v-for="city in allCities" 
                    :key="city.id"
                    class="flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all"
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
          <div v-if="segments.length > 0" class="space-y-6 mb-6">
            <div 
              v-for="segment in segments" 
              :key="segment.id"
              class="panel"
            >
              <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                <div class="flex-1">
                  <h3 class="text-size-2 font-semibold text-foreground mb-1">{{ segment.name }}</h3>
                  <p v-if="segment.description" class="text-size-4 text-foreground-muted">
                    {{ segment.description }}
                  </p>
                </div>
                <div class="flex flex-col sm:flex-row gap-2">
                  <button
                    @click="handleEditSegment(segment)"
                    class="btn-secondary text-size-4 !py-2 !px-4 w-full sm:w-auto"
                  >
                    <Icon name="heroicons:pencil" class="w-4 h-4 mr-1" />
                    Editar
                  </button>
                  <button
                    @click="handleDeleteSegment(segment.id, segment.name)"
                    :disabled="deletingIds.has(segment.id)"
                    class="btn-danger text-size-4 !py-2 !px-4 disabled:opacity-50 w-full sm:w-auto"
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
                    class="flex items-center gap-2 px-3 py-2 bg-surface rounded-lg border border-border-subtle"
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
            
            <!-- Pagination -->
            <PaginationControls
              v-if="segmentsTotal > segmentsPageSize"
              :current-page="segmentsPage"
              :total-pages="Math.ceil(segmentsTotal / segmentsPageSize)"
              :total="segmentsTotal"
              :page-size="segmentsPageSize"
              :loading="loading"
              @page-change="(page) => loadData(page)"
            />
          </div>

          <!-- Empty State -->
          <div v-else class="panel text-center max-w-md mx-auto">
            <div class="w-24 h-24 rounded-2xl bg-surface-elevated border border-accent/30 flex items-center justify-center mx-auto mb-6">
              <Icon name="heroicons:map" class="w-12 h-12 text-accent" />
            </div>
            <h3 class="panel-title">No hay regiones</h3>
            <p class="text-size-4 font-regular text-foreground-muted leading-relaxed">
              Crea tu primera región de matchmaking para agrupar ciudades cercanas.
            </p>
          </div>
        </template>

        <!-- Add Cities Modal -->
        <Teleport to="body">
          <div 
            v-if="addCitiesModal.show" 
            class="te-modal"
            @click.self="closeAddCitiesModal"
          >
            <div class="te-modal__panel te-modal__panel--wide">
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
                  class="flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all"
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
  </PageLayout>
</template>

<script setup lang="ts">
import type { CitySegment, City } from '~/types'
import PaginationControls from '~/components/admin/PaginationControls.vue'

definePageMeta({
  middleware: ['admin']
})

const { user } = useAuthState()
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

// Pagination
const segmentsPage = ref(1)
const segmentsPageSize = ref(50)
const segmentsTotal = ref(0)

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
const loadData = async (page?: number) => {
  if (page !== undefined) segmentsPage.value = page
  try {
    loading.value = true
    error.value = null
    
    const accountId = user.value?.id
    if (!accountId) {
      error.value = 'User not authenticated'
      return
    }
    
    // Load segments
    const offset = (segmentsPage.value - 1) * segmentsPageSize.value
    const segmentsResponse = await $fetch('/api/admin/city-segments', {
      query: { 
        limit: segmentsPageSize.value,
        offset: offset
      }
    })
    segments.value = (segmentsResponse as any).segments || []
    segmentsTotal.value = (segmentsResponse as any).total || 0
    
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
    const accountId = user.value?.id
    
    await $fetch('/api/admin/city-segments', {
      method: 'POST',
      body: {
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
    const accountId = user.value?.id
    
    await $fetch(`/api/admin/city-segments/${editingSegmentId.value}`, {
      method: 'PUT',
      body: {
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
    const accountId = user.value?.id
    
    await $fetch(`/api/admin/city-segments/${segmentId}`, {
      method: 'DELETE',
      query: {}
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
    const accountId = user.value?.id
    
    await $fetch(`/api/admin/city-segments/${addCitiesModal.value.segmentId}/cities`, {
      method: 'POST',
      body: {
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
    const accountId = user.value?.id
    
    await $fetch(`/api/admin/city-segments/${segmentId}/cities`, {
      method: 'DELETE',
      query: { city_id: cityId }
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
