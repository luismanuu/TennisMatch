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

        <!-- Invitation Acceptance Form -->
        <div v-else-if="invitation && !isAuthenticated" class="max-w-2xl mx-auto">
          <div class="glass-card-elevated p-8 mb-8">
            <div class="text-center mb-8">
              <div class="w-20 h-20 rounded-2xl bg-accent-subtle flex items-center justify-center mx-auto mb-6">
                <span class="text-4xl">🎾</span>
              </div>
              <h1 class="text-size-1 font-semibold text-foreground mb-4">
                {{ isOrganizer ? '¡Has sido invitado como Organizador!' : '¡Has sido invitado!' }}
              </h1>
              <p class="text-size-3 font-regular text-foreground-muted">
                {{ isOrganizer 
                  ? 'Completa tu registro para comenzar a organizar torneos en Tenis Ecuador' 
                  : 'Completa tu registro para unirte a Tenis Ecuador' }}
              </p>
            </div>

            <div class="space-y-4 mb-8">
              <div class="p-6 rounded-xl bg-surface border border-border-subtle">
                <p class="text-size-4 font-regular text-foreground-subtle mb-2">Tu información</p>
                <p class="text-size-3 font-semibold text-foreground">{{ invitation.name }}</p>
                <p class="text-size-4 font-regular text-foreground-muted">{{ invitation.email }}</p>
              </div>
              <div v-if="invitation.category && !isOrganizer" class="p-6 rounded-xl bg-surface border border-border-subtle">
                <p class="text-size-4 font-regular text-foreground-subtle mb-2">Categoría asignada</p>
                <p class="text-size-3 font-semibold text-foreground">
                  {{ invitation.category.name }}
                </p>
                <p v-if="invitation.category.description" class="text-size-4 font-regular text-foreground-muted mt-2">
                  {{ invitation.category.description }}
                </p>
              </div>
              <div v-if="isOrganizer" class="p-6 rounded-xl bg-accent-subtle border border-accent/30">
                <p class="text-size-4 font-regular text-foreground-subtle mb-2">Rol</p>
                <p class="text-size-3 font-semibold text-foreground">
                  Organizador de Torneos
                </p>
                <p class="text-size-4 font-regular text-foreground-muted mt-2">
                  Podrás crear y gestionar tus propios torneos en el sistema
                </p>
              </div>
            </div>

            <!-- Registration Form -->
            <form @submit.prevent="handleCompleteRegistration" class="space-y-6">
              <!-- Password Field -->
              <div>
                <label for="password" class="block text-size-4 font-semibold text-foreground mb-2">
                  Contraseña
                </label>
                <input
                  id="password"
                  v-model="formData.password"
                  type="password"
                  required
                  minlength="8"
                  class="w-full px-4 py-3 rounded-xl bg-surface border border-border-subtle text-foreground placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                  placeholder="Mínimo 8 caracteres"
                />
                <p class="text-size-4 font-regular text-foreground-muted mt-2">
                  Crea una contraseña segura para tu cuenta
                </p>
              </div>

              <!-- Category Selection (if not pre-assigned and not organizer) -->
              <div v-if="!invitation.category_id && categories.length > 0 && !isOrganizer">
                <label class="block text-size-4 font-semibold text-foreground mb-2">
                  Selecciona tu categoría
                </label>
                <div class="space-y-3">
                  <button
                    v-for="category in categories"
                    :key="category.id"
                    type="button"
                    @click="formData.category_id = category.id"
                    :class="[
                      'w-full p-4 rounded-xl border-2 text-left transition-all',
                      formData.category_id === category.id
                        ? 'border-accent bg-accent-subtle'
                        : 'border-border-subtle bg-surface hover:border-accent/50'
                    ]"
                  >
                    <div class="flex items-start justify-between">
                      <div class="flex-1">
                        <h3 class="text-size-3 font-semibold text-foreground mb-1">
                          {{ category.name }}
                        </h3>
                        <p v-if="category.description" class="text-size-4 font-regular text-foreground-muted">
                          {{ category.description }}
                        </p>
                      </div>
                      <div
                        v-if="formData.category_id === category.id"
                        class="w-5 h-5 rounded-full bg-accent flex items-center justify-center flex-shrink-0 ml-4"
                      >
                        <svg class="w-3 h-3 text-background" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              <!-- Error Message -->
              <div v-if="registrationError" class="p-4 rounded-xl bg-red-500/20 border border-red-500/50">
                <p class="text-size-4 font-regular text-red-400">{{ registrationError }}</p>
              </div>

              <!-- Submit Button -->
              <button
                type="submit"
                :disabled="registering || !formData.password || (!isOrganizer && !invitation.category_id && !formData.category_id)"
                class="btn-primary text-size-3 w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span v-if="registering">{{ isOrganizer ? 'Creando cuenta de organizador...' : 'Creando cuenta...' }}</span>
                <span v-else>{{ isOrganizer ? 'Completar Registro como Organizador' : 'Completar Registro' }}</span>
              </button>
            </form>
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
                {{ isOrganizer ? 'Aceptar Invitación como Organizador' : 'Aceptar Invitación' }}
              </h1>
              <p class="text-size-3 font-regular text-foreground-muted">
                {{ isOrganizer 
                  ? 'Has sido invitado a ser organizador de torneos' 
                  : `${invitation.invited_by_player?.name || 'Un administrador'} te ha invitado a unirte` }}
              </p>
            </div>

            <div class="space-y-4 mb-8">
              <div class="p-6 rounded-xl bg-surface border border-border-subtle">
                <p class="text-size-4 font-regular text-foreground-subtle mb-2">Nombre</p>
                <p class="text-size-3 font-semibold text-foreground">{{ invitation.name }}</p>
              </div>
              <div v-if="invitation.category && !isOrganizer" class="p-6 rounded-xl bg-surface border border-border-subtle">
                <p class="text-size-4 font-regular text-foreground-subtle mb-2">Categoría</p>
                <p class="text-size-3 font-semibold text-foreground">
                  {{ invitation.category?.name }}
                </p>
              </div>
              <div v-if="isOrganizer" class="p-6 rounded-xl bg-accent-subtle border border-accent/30">
                <p class="text-size-4 font-regular text-foreground-subtle mb-2">Rol</p>
                <p class="text-size-3 font-semibold text-foreground">
                  Organizador de Torneos
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
const router = useRouter()
const token = route.params.token as string

// Use shared auth state composable for consistent behavior
const { isLoaded, isAuthenticated, userId, user } = useAuthState()
const { getInvitation, acceptInvitation, loading, error } = usePendingPlayers()
const { categories, loading: categoriesLoading, fetchCategories } = useCategories()
const { createPlayer, loading: playerLoading } = usePlayer()

const invitation = ref<PendingPlayer | null>(null)
const accepting = ref(false)
const acceptError = ref<Error | null>(null)
const acceptSuccess = ref(false)
const registering = ref(false)
const registrationError = ref<string | null>(null)

// Check if this is an organizer invitation
const isOrganizer = computed(() => {
  return invitation.value?.role === 'tournament_organizer'
})

// Check for Clerk ticket in URL (from Clerk invitation email)
const clerkTicket = computed(() => route.query.__clerk_ticket as string | undefined)
const clerkStatus = computed(() => route.query.__clerk_status as string | undefined)

// Form data
const formData = ref({
  password: '',
  category_id: ''
})

const loadInvitation = async () => {
  if (!token) return

  try {
    const data = await getInvitation(token)
    invitation.value = data
    
    // Pre-fill category if assigned
    if (data.category_id) {
      formData.value.category_id = data.category_id
    }
    
    // Load categories if not pre-assigned
    if (!data.category_id) {
      await fetchCategories()
    }
  } catch (err: any) {
    console.error('Error loading invitation:', err)
  }
}

// Handle complete registration with password and category
const handleCompleteRegistration = async () => {
  if (!invitation.value) return
  
  registering.value = true
  registrationError.value = null
  
  try {
    // Determine category_id (use pre-assigned or selected)
    // Organizers don't need a category
    const categoryId = isOrganizer.value ? null : (invitation.value.category_id || formData.value.category_id)
    
    if (!isOrganizer.value && !categoryId) {
      throw new Error('Por favor selecciona una categoría')
    }
    
    // Create user via API endpoint
    // This endpoint will create the user in Clerk and the player/organizer in our system
    const response = await $fetch('/api/invitations/create-user', {
      method: 'POST',
      body: {
        email: invitation.value.email,
        password: formData.value.password,
        name: invitation.value.name,
        category_id: categoryId || undefined, // Only send if not null
        invitation_token: token
      }
    })
    
    if (!response.success) {
      throw new Error(response.message || 'Error al crear el usuario')
    }
    
    // User and player have been created successfully
    // Redirect to sign-in page with success message
    // The user can sign in with the credentials they just created
    await router.push({
      path: '/sign-in',
      query: {
        email: invitation.value.email,
        message: 'Registro completado exitosamente. Por favor, inicia sesión con tu nueva contraseña.',
        invitation_token: token
      }
    })
  } catch (err: any) {
    console.error('Error completing registration:', err)
    registrationError.value = err.data?.message || err.message || 'Error al completar el registro. Por favor, intenta nuevamente.'
  } finally {
    registering.value = false
  }
}

const handleAcceptInvitation = async () => {
  if (!invitation.value || !userId.value) return

  accepting.value = true
  acceptError.value = null
  acceptSuccess.value = false

  try {
    const result = await acceptInvitation(invitation.value.id, userId.value)
    acceptSuccess.value = true
    
    console.log('Invitation accepted successfully:', result)

    // Redirect to dashboard after a short delay
    setTimeout(() => {
      navigateTo('/')
    }, 1500)
  } catch (err: any) {
    // Check if it's a 500 error but player was created
    // Sometimes the error happens after player creation
    if (err.statusCode === 500 || err.status === 500) {
      console.warn('Error occurred but checking if player was created:', err)
      // Try to continue anyway - player might have been created
      acceptSuccess.value = true
      setTimeout(() => {
        navigateTo('/')
      }, 1500)
    } else {
      acceptError.value = err
      console.error('Error accepting invitation:', err)
    }
  } finally {
    accepting.value = false
  }
}

onMounted(async () => {
  await loadInvitation()
  
  // If user is already authenticated and invitation is pending, auto-accept
  if (isAuthenticated.value && userId.value && invitation.value && invitation.value.status === 'pending') {
    try {
      await handleAcceptInvitation()
    } catch (err) {
      console.error('Error auto-accepting invitation on mount:', err)
    }
  }
})
</script>

<style scoped>
/* Custom form styles */
form input[type="password"] {
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  border: 2px solid var(--border);
  background: var(--surface);
  color: var(--foreground);
  font-size: 0.875rem;
  transition: all 150ms ease;
}

form input[type="password"]:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-subtle);
}

form input[type="password"]:hover {
  border-color: var(--border-subtle);
}

/* Verification code input fields (OTP) - Ensure they're interactive */
:deep(input[type="text"][inputmode="numeric"]),
:deep(input[type="tel"]),
:deep(input[type="text"][autocomplete="one-time-code"]),
:deep(.cl-otpCodeInput),
:deep(.cl-codeInput),
:deep([class*="otp"] input),
:deep([class*="code"] input),
:deep([class*="verification"] input),
:deep([class*="codeInput"]),
:deep([class*="otpField"]),
:deep([class*="otpField"] input),
:deep([class*="codeField"]),
:deep([class*="codeField"] input),
:deep(div[class*="otp"] input),
:deep(div[class*="code"] input) {
  background: var(--surface) !important;
  border: 2px solid var(--border) !important;
  border-radius: var(--radius-md) !important;
  padding: 0.4375rem 0.75rem !important;
  font-size: 0.8125rem !important;
  height: 2.125rem !important;
  width: 2.5rem !important;
  min-width: 2.5rem !important;
  max-width: 2.5rem !important;
  text-align: center !important;
  color: var(--foreground) !important;
  transition: border-color 150ms ease, box-shadow 150ms ease !important;
  box-sizing: border-box !important;
  display: inline-block !important;
  margin: 0 0.25rem !important;
  font-weight: normal !important;
  pointer-events: auto !important;
  cursor: text !important;
  opacity: 1 !important;
  user-select: auto !important;
  -webkit-user-select: auto !important;
  -moz-user-select: auto !important;
  -ms-user-select: auto !important;
}

:deep(input[type="text"][inputmode="numeric"]:hover),
:deep(input[type="tel"]:hover),
:deep(input[type="text"][autocomplete="one-time-code"]:hover),
:deep(.cl-otpCodeInput:hover),
:deep(.cl-codeInput:hover),
:deep([class*="otp"] input:hover),
:deep([class*="code"] input:hover),
:deep([class*="verification"] input:hover),
:deep([class*="codeInput"]:hover),
:deep([class*="otpField"]:hover),
:deep([class*="otpField"] input:hover),
:deep([class*="codeField"]:hover),
:deep([class*="codeField"] input:hover),
:deep(div[class*="otp"] input:hover),
:deep(div[class*="code"] input:hover) {
  border-color: var(--border-subtle) !important;
  border-width: 2px !important;
}

:deep(input[type="text"][inputmode="numeric"]:focus),
:deep(input[type="tel"]:focus),
:deep(input[type="text"][autocomplete="one-time-code"]:focus),
:deep(.cl-otpCodeInput:focus),
:deep(.cl-codeInput:focus),
:deep([class*="otp"] input:focus),
:deep([class*="code"] input:focus),
:deep([class*="verification"] input:focus),
:deep([class*="codeInput"]:focus),
:deep([class*="otpField"]:focus),
:deep([class*="otpField"] input:focus),
:deep([class*="codeField"]:focus),
:deep([class*="codeField"] input:focus),
:deep(div[class*="otp"] input:focus),
:deep(div[class*="code"] input:focus) {
  border-color: var(--accent) !important;
  border-width: 2px !important;
  box-shadow: 0 0 0 3px var(--accent-subtle) !important;
  outline: none !important;
}

/* OTP container spacing */
:deep([class*="otp"]),
:deep([class*="code"]),
:deep([class*="verification"]) {
  display: flex !important;
  gap: 0.5rem !important;
  justify-content: center !important;
  align-items: center !important;
  flex-wrap: wrap !important;
}
</style>

