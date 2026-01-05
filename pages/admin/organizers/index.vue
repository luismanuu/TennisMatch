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
        <div class="flex items-center justify-between mb-8 animate-fade-up">
          <div>
            <NuxtLink to="/admin" class="inline-flex items-center gap-2 text-size-4 text-foreground-muted hover:text-accent mb-4 transition-colors">
              <Icon name="heroicons:arrow-left" class="w-4 h-4" />
              <span>Volver al Panel</span>
            </NuxtLink>
            <h1 class="text-size-1 font-semibold text-foreground mb-2">Gestionar Organizadores</h1>
            <p class="text-size-3 font-regular text-foreground-muted">
              Crea y administra organizadores de torneos
            </p>
          </div>
          <button
            @click="showCreateForm = !showCreateForm"
            class="glass-card-elevated px-6 py-3 rounded-xl flex items-center gap-2 text-size-4 font-semibold text-foreground hover-lift transition-all"
          >
            <Icon name="heroicons:plus" class="w-5 h-5" />
            <span>Invitar Organizador</span>
          </button>
        </div>

        <!-- Create Organizer Form -->
        <div v-if="showCreateForm" class="glass-card-elevated p-8 mb-8 animate-fade-in-scale">
          <h2 class="text-size-2 font-semibold text-foreground mb-6">Invitar Nuevo Organizador</h2>
          <form @submit.prevent="handleInviteOrganizer" class="space-y-6">
            <div>
              <label class="block text-size-4 font-semibold text-foreground mb-2">Nombre</label>
              <input
                v-model="organizerForm.name"
                type="text"
                required
                class="w-full px-4 py-3 rounded-xl bg-surface border-2 border-border-subtle text-foreground text-size-3 focus:border-accent focus:outline-none transition-colors"
                placeholder="Nombre del organizador"
              />
            </div>
            <div>
              <label class="block text-size-4 font-semibold text-foreground mb-2">Email</label>
              <input
                v-model="organizerForm.email"
                type="email"
                required
                class="w-full px-4 py-3 rounded-xl bg-surface border-2 border-border-subtle text-foreground text-size-3 focus:border-accent focus:outline-none transition-colors"
                placeholder="email@ejemplo.com"
              />
            </div>
            <div class="flex gap-4">
              <button
                type="submit"
                :disabled="inviting"
                class="px-6 py-3 rounded-xl bg-accent text-foreground text-size-4 font-semibold hover-lift transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span v-if="!inviting">Enviar Invitación</span>
                <span v-else class="flex items-center gap-2">
                  <Icon name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
                  Enviando...
                </span>
              </button>
              <button
                type="button"
                @click="showCreateForm = false; resetForm()"
                class="px-6 py-3 rounded-xl bg-surface border-2 border-border-subtle text-foreground text-size-4 font-semibold hover-lift transition-all"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="glass-card-elevated p-12 text-center animate-fade-in-scale">
          <Icon name="heroicons:arrow-path" class="w-12 h-12 text-accent mx-auto mb-4 animate-spin" />
          <p class="text-size-3 font-regular text-foreground-muted">Cargando organizadores...</p>
        </div>

        <!-- Organizers List -->
        <div v-else class="space-y-8 animate-fade-up animate-delay-1">
          <!-- Active Organizers -->
          <div v-if="organizers.length > 0">
            <h2 class="text-size-2 font-semibold text-foreground mb-4">Organizadores Activos</h2>
            <div class="space-y-4">
              <div
                v-for="organizer in organizers"
                :key="organizer.id"
                class="glass-card-elevated p-6 hover-lift transition-all"
              >
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <h3 class="text-size-2 font-semibold text-foreground mb-2">{{ organizer.name }}</h3>
                    <p class="text-size-4 font-regular text-foreground-muted mb-3">
                      {{ organizer.email }}
                    </p>
                    <div class="flex items-center gap-4 text-size-4 text-foreground-muted">
                      <span class="flex items-center gap-1">
                        <Icon name="heroicons:calendar" class="w-4 h-4" />
                        Creado: {{ formatDate(organizer.created_at) }}
                      </span>
                    </div>
                  </div>
                  <div class="flex gap-2">
                    <button
                      @click="handleDeleteOrganizer(organizer.id, organizer.name)"
                      :disabled="deletingIds.has(organizer.id)"
                      class="px-4 py-2 rounded-xl bg-red-500/20 text-red-400 text-size-4 font-semibold hover-lift transition-all disabled:opacity-50"
                    >
                      <span v-if="!deletingIds.has(organizer.id)">Eliminar</span>
                      <span v-else class="flex items-center gap-2">
                        <Icon name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
                        Eliminando...
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Pending Invitations -->
          <div v-if="pendingInvitations.length > 0">
            <h2 class="text-size-2 font-semibold text-foreground mb-4">Invitaciones Pendientes</h2>
            <div class="space-y-4">
              <div
                v-for="invitation in pendingInvitations"
                :key="invitation.id"
                class="glass-card-elevated p-6 border-2 border-yellow-500/30"
              >
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <h3 class="text-size-2 font-semibold text-foreground mb-2">{{ invitation.name }}</h3>
                    <p class="text-size-4 font-regular text-foreground-muted mb-3">
                      {{ invitation.email }}
                    </p>
                    <div class="flex items-center gap-4 text-size-4 text-foreground-muted">
                      <span class="px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-size-4 font-semibold">
                        {{ invitation.status === 'pending' ? 'Pendiente' : invitation.status }}
                      </span>
                      <span class="flex items-center gap-1">
                        <Icon name="heroicons:calendar" class="w-4 h-4" />
                        {{ formatDate(invitation.created_at) }}
                      </span>
                    </div>
                  </div>
                  <div class="flex gap-2">
                    <button
                      @click="handleResendInvitation(invitation.id)"
                      :disabled="resendingIds.has(invitation.id)"
                      class="px-4 py-2 rounded-xl bg-accent text-foreground text-size-4 font-semibold hover-lift transition-all disabled:opacity-50"
                    >
                      <span v-if="!resendingIds.has(invitation.id)">Reenviar</span>
                      <span v-else class="flex items-center gap-2">
                        <Icon name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
                        Reenviando...
                      </span>
                    </button>
                    <button
                      @click="handleDeleteInvitation(invitation.id)"
                      :disabled="deletingInvitationIds.has(invitation.id)"
                      class="px-4 py-2 rounded-xl bg-red-500/20 text-red-400 text-size-4 font-semibold hover-lift transition-all disabled:opacity-50"
                    >
                      <span v-if="!deletingInvitationIds.has(invitation.id)">Eliminar</span>
                      <span v-else class="flex items-center gap-2">
                        <Icon name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
                        Eliminando...
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-if="organizers.length === 0 && pendingInvitations.length === 0" class="glass-card-elevated p-12 text-center animate-fade-in-scale">
            <Icon name="heroicons:user-group" class="w-24 h-24 text-foreground-muted mx-auto mb-6 opacity-50" />
            <h3 class="text-size-2 font-semibold text-foreground mb-4">No hay organizadores</h3>
            <p class="text-size-4 font-regular text-foreground-muted mb-6">
              Invita tu primer organizador para comenzar
            </p>
            <button
              @click="showCreateForm = true"
              class="px-6 py-3 rounded-xl bg-accent text-foreground text-size-4 font-semibold hover-lift transition-all"
            >
              Invitar Organizador
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: ['admin']
})

const { userId } = useAuthState()
const toast = useToastNotifications()

const loading = ref(false)
const organizers = ref<any[]>([])
const pendingInvitations = ref<any[]>([])
const showCreateForm = ref(false)
const inviting = ref(false)
const deletingIds = ref<Set<string>>(new Set())
const resendingIds = ref<Set<string>>(new Set())
const deletingInvitationIds = ref<Set<string>>(new Set())

const organizerForm = ref({
  name: '',
  email: ''
})

const resetForm = () => {
  organizerForm.value = {
    name: '',
    email: ''
  }
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

const loadOrganizers = async () => {
  if (!userId.value) return

  try {
    loading.value = true
    const data = await $fetch<{ organizers: any[]; pendingInvitations: any[] }>(
      `/api/admin/organizers?clerk_id=${userId.value}`
    )
    organizers.value = data.organizers || []
    pendingInvitations.value = data.pendingInvitations || []
  } catch (err: any) {
    toast.error(err.data?.message || err.message || 'Error al cargar organizadores')
  } finally {
    loading.value = false
  }
}

const handleInviteOrganizer = async () => {
  if (!userId.value) return

  try {
    inviting.value = true
    await $fetch('/api/admin/organizers', {
      method: 'POST',
      body: {
        clerk_id: userId.value,
        ...organizerForm.value
      }
    })
    toast.success('Invitación enviada exitosamente')
    showCreateForm.value = false
    resetForm()
    await loadOrganizers()
  } catch (err: any) {
    toast.error(err.data?.message || err.message || 'Error al enviar invitación')
  } finally {
    inviting.value = false
  }
}

const handleDeleteOrganizer = async (organizerId: string, organizerName: string) => {
  if (!userId.value) return
  if (!confirm(`¿Estás seguro de que deseas eliminar a "${organizerName}"? Esta acción no se puede deshacer.`)) {
    return
  }

  try {
    deletingIds.value.add(organizerId)
    await $fetch(`/api/admin/organizers/${organizerId}`, {
      method: 'DELETE',
      query: {
        clerk_id: userId.value
      }
    })
    toast.success(`Organizador "${organizerName}" eliminado exitosamente`)
    await loadOrganizers()
  } catch (err: any) {
    toast.error(err.data?.message || err.message || 'Error al eliminar organizador')
  } finally {
    deletingIds.value.delete(organizerId)
  }
}

const handleResendInvitation = async (invitationId: string) => {
  if (!userId.value) return

  try {
    resendingIds.value.add(invitationId)
    await $fetch(`/api/admin/invitations/${invitationId}/resend`, {
      method: 'POST',
      body: {
        clerk_id: userId.value
      }
    })
    toast.success('Invitación reenviada exitosamente')
  } catch (err: any) {
    toast.error(err.data?.message || err.message || 'Error al reenviar invitación')
  } finally {
    resendingIds.value.delete(invitationId)
  }
}

const handleDeleteInvitation = async (invitationId: string) => {
  if (!userId.value) return
  if (!confirm('¿Estás seguro de que deseas eliminar esta invitación?')) {
    return
  }

  try {
    deletingInvitationIds.value.add(invitationId)
    await $fetch(`/api/admin/invitations/${invitationId}`, {
      method: 'DELETE',
      body: {
        clerk_id: userId.value
      }
    })
    toast.success('Invitación eliminada exitosamente')
    await loadOrganizers()
  } catch (err: any) {
    toast.error(err.data?.message || err.message || 'Error al eliminar invitación')
  } finally {
    deletingInvitationIds.value.delete(invitationId)
  }
}

onMounted(() => {
  loadOrganizers()
})
</script>
