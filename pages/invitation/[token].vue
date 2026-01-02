<template>
  <div class="min-h-screen">
    <!-- Navigation -->
    <AppNavigation />

    <div class="h-16"></div>

    <div class="section-padding">
      <div class="container-medium px-6">
        <!-- Loading State -->
        <div v-if="loading" class="glass-card-elevated p-12 text-center max-w-2xl mx-auto">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
          <p class="text-size-4 font-regular text-foreground-muted mt-4">Cargando invitación...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error || !invitation" class="glass-card-elevated p-12 text-center max-w-2xl mx-auto">
          <div class="w-20 h-20 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto mb-6">
            <span class="text-4xl">⚠️</span>
          </div>
          <h2 class="text-size-2 font-semibold text-foreground mb-4">Invitación no válida</h2>
          <p class="text-size-4 font-regular text-foreground-muted mb-8">
            {{ error?.message || 'La invitación no existe o ha expirado' }}
          </p>
          <NuxtLink to="/" class="btn-primary text-size-3">
            Volver al inicio
          </NuxtLink>
        </div>

        <!-- Invitation Details -->
        <div v-else-if="invitation && !isAuthenticated" class="max-w-2xl mx-auto">
          <div class="glass-card-elevated p-8 mb-8">
            <div class="text-center mb-8">
              <div class="w-20 h-20 rounded-2xl bg-accent-subtle flex items-center justify-center mx-auto mb-6">
                <span class="text-4xl">🎾</span>
              </div>
              <h1 class="text-size-1 font-semibold text-foreground mb-4">
                ¡Has sido invitado!
              </h1>
              <p class="text-size-3 font-regular text-foreground-muted">
                {{ invitation.invited_by_player?.name }} te ha invitado a unirte a Tenis Ecuador
              </p>
            </div>

            <div class="space-y-4 mb-8">
              <div class="p-6 rounded-xl bg-surface border border-border-subtle">
                <p class="text-size-4 font-regular text-foreground-subtle mb-2">Tu información</p>
                <p class="text-size-3 font-semibold text-foreground">{{ invitation.name }}</p>
                <p class="text-size-4 font-regular text-foreground-muted">{{ invitation.email }}</p>
              </div>
              <div class="p-6 rounded-xl bg-surface border border-border-subtle">
                <p class="text-size-4 font-regular text-foreground-subtle mb-2">Categoría asignada</p>
                <p class="text-size-3 font-semibold text-foreground">
                  {{ invitation.category?.name }}
                </p>
                <p v-if="invitation.category?.description" class="text-size-4 font-regular text-foreground-muted mt-2">
                  {{ invitation.category.description }}
                </p>
              </div>
            </div>

            <div class="text-center">
              <p class="text-size-4 font-regular text-foreground-muted mb-6">
                Crea una cuenta para aceptar la invitación y comenzar a registrar partidos
              </p>
              <NuxtLink to="/sign-up" class="btn-primary text-size-3 inline-flex items-center">
                Crear Cuenta
                <svg class="w-5 h-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </NuxtLink>
            </div>
          </div>
        </div>

        <!-- Already Authenticated - Accept Invitation -->
        <div v-else-if="invitation && isAuthenticated" class="max-w-2xl mx-auto">
          <div class="glass-card-elevated p-8">
            <div class="text-center mb-8">
              <div class="w-20 h-20 rounded-2xl bg-accent-subtle flex items-center justify-center mx-auto mb-6">
                <span class="text-4xl">🎾</span>
              </div>
              <h1 class="text-size-1 font-semibold text-foreground mb-4">
                Aceptar Invitación
              </h1>
              <p class="text-size-3 font-regular text-foreground-muted">
                {{ invitation.invited_by_player?.name }} te ha invitado a unirte
              </p>
            </div>

            <div class="space-y-4 mb-8">
              <div class="p-6 rounded-xl bg-surface border border-border-subtle">
                <p class="text-size-4 font-regular text-foreground-subtle mb-2">Nombre</p>
                <p class="text-size-3 font-semibold text-foreground">{{ invitation.name }}</p>
              </div>
              <div class="p-6 rounded-xl bg-surface border border-border-subtle">
                <p class="text-size-4 font-regular text-foreground-subtle mb-2">Categoría</p>
                <p class="text-size-3 font-semibold text-foreground">
                  {{ invitation.category?.name }}
                </p>
              </div>
            </div>

            <!-- Error Message -->
            <div v-if="acceptError" class="p-4 rounded-xl bg-red-500/20 border border-red-500/50 mb-6">
              <p class="text-size-4 font-regular text-red-400">{{ acceptError.message }}</p>
            </div>

            <!-- Success Message -->
            <div v-if="acceptSuccess" class="p-4 rounded-xl bg-green-500/20 border border-green-500/50 mb-6">
              <p class="text-size-4 font-regular text-green-400">Invitación aceptada exitosamente</p>
            </div>

            <div class="text-center">
              <button
                @click="handleAcceptInvitation"
                :disabled="accepting"
                class="btn-primary text-size-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span v-if="accepting">Aceptando...</span>
                <span v-else>Aceptar Invitación</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PendingPlayer } from '~/types'

definePageMeta({
  middleware: []
})

const route = useRoute()
const token = route.params.token as string

// Use shared auth state composable for consistent behavior
const { isLoaded, isAuthenticated, userId, user } = useAuthState()
const { getInvitation, acceptInvitation, loading, error } = usePendingPlayers()

const invitation = ref<PendingPlayer | null>(null)
const accepting = ref(false)
const acceptError = ref<Error | null>(null)
const acceptSuccess = ref(false)

const loadInvitation = async () => {
  if (!token) return

  try {
    const data = await getInvitation(token)
    invitation.value = data
  } catch (err: any) {
    console.error('Error loading invitation:', err)
  }
}

const handleAcceptInvitation = async () => {
  if (!invitation.value || !userId.value) return

  accepting.value = true
  acceptError.value = null
  acceptSuccess.value = false

  try {
    await acceptInvitation(invitation.value.id, userId.value)
    acceptSuccess.value = true

    // Redirect to profile after a short delay
    setTimeout(() => {
      navigateTo('/profile')
    }, 1500)
  } catch (err: any) {
    acceptError.value = err
    console.error('Error accepting invitation:', err)
  } finally {
    accepting.value = false
  }
}

onMounted(async () => {
  await loadInvitation()
})
</script>

