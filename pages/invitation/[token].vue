<template>
  <PageLayout container-size="medium">
    <div v-if="loading" class="panel text-center max-w-2xl mx-auto">
      <Icon name="heroicons:arrow-path" class="w-8 h-8 text-accent animate-spin" aria-hidden="true" />
      <p class="text-size-4 font-regular text-foreground-muted mt-4">Cargando invitación...</p>
    </div>

    <div v-else-if="!invitation" class="panel text-center max-w-2xl mx-auto">
      <div class="w-20 h-20 rounded-2xl bg-danger-subtle flex items-center justify-center mx-auto mb-6">
        <Icon name="heroicons:exclamation-triangle" class="w-10 h-10 text-danger" aria-hidden="true" />
      </div>
      <h2 class="panel-title">Invitación no válida</h2>
      <p class="text-size-4 font-regular text-foreground-muted mb-8">La invitación no existe, ya se usó o venció.</p>
      <NuxtLink to="/" class="btn-primary text-size-3">Volver al inicio</NuxtLink>
    </div>

    <div v-else class="max-w-2xl mx-auto">
      <div class="panel">
        <div class="text-center mb-8">
          <div class="w-20 h-20 rounded-2xl bg-accent-subtle flex items-center justify-center mx-auto mb-6">
            <BrandMark :size="40" />
          </div>
          <h1 class="text-size-1 font-semibold text-foreground mb-4">
            {{ isAuthenticated ? 'Acepta tu invitación' : '¡Te invitaron!' }}
          </h1>
          <p class="text-size-3 font-regular text-foreground-muted">
            {{ invitation.invited_by_player?.name || 'Un jugador' }} te invitó a unirte a Tenis Ecuador
          </p>
        </div>

        <div class="space-y-4 mb-8">
          <div class="p-6 rounded-xl bg-surface border border-border-subtle">
            <p class="text-size-4 font-regular text-foreground-subtle mb-2">Tu información</p>
            <p class="text-size-3 font-semibold text-foreground">{{ invitation.name }}</p>
            <p class="text-size-4 font-regular text-foreground-muted">{{ invitation.email }}</p>
          </div>
          <div v-if="invitation.category" class="p-6 rounded-xl bg-surface border border-border-subtle">
            <p class="text-size-4 font-regular text-foreground-subtle mb-2">Categoría asignada</p>
            <p class="text-size-3 font-semibold text-foreground">{{ invitation.category.name }}</p>
            <p v-if="invitation.category.description" class="text-size-4 font-regular text-foreground-muted mt-2">
              {{ invitation.category.description }}
            </p>
          </div>
        </div>

        <template v-if="!isAuthenticated">
          <AuthForm
            mode="sign-up"
            :initial-email="invitation.email"
            :initial-name="invitation.name"
            email-locked
            :invitation-token="token"
            submit-label="Crear cuenta y aceptar"
            @success="onSignedUp"
          />
          <p class="auth-footer">
            ¿Ya tienes cuenta?
            <NuxtLink
              :to="{ path: '/sign-in', query: { email: invitation.email, invitation_token: token } }"
              class="auth-link"
            >
              Inicia sesión
            </NuxtLink>
          </p>
        </template>

        <template v-else>
          <p v-if="acceptError" class="form-error mb-6" role="alert">{{ acceptError }}</p>
          <p v-if="accepted" class="text-size-4 text-accent mb-6" role="status">Invitación aceptada. Te llevamos a tu perfil…</p>
          <div class="text-center">
            <button type="button" class="btn-primary text-size-3" :disabled="accepting || accepted" @click="accept">
              {{ accepting ? 'Aceptando…' : 'Aceptar invitación' }}
            </button>
          </div>
        </template>
      </div>
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
import type { PendingPlayer } from '~/types'

definePageMeta({ middleware: [] })

const route = useRoute()
const token = route.params.token as string
const { isAuthenticated } = useAuthState()
const { getInvitation, acceptInvitation } = usePendingPlayers()

const loading = ref(true)
const invitation = ref<PendingPlayer | null>(null)
const accepting = ref(false)
const accepted = ref(false)
const acceptError = ref('')

async function accept() {
  accepting.value = true
  acceptError.value = ''
  try {
    await acceptInvitation(token)
    accepted.value = true
    await navigateTo('/profile', { replace: true })
  } catch (err: any) {
    acceptError.value = err?.data?.statusMessage || err?.data?.message || 'No pudimos aceptar la invitación. Inténtalo de nuevo.'
  } finally {
    accepting.value = false
  }
}

async function onSignedUp({ needsVerification, email }: { needsVerification: boolean; email: string }) {
  if (needsVerification) {
    await navigateTo({ path: VERIFY_EMAIL_PAGE, query: { email, invitation_token: token } })
    return
  }
  await accept()
}

onMounted(async () => {
  try {
    invitation.value = await getInvitation(token)
  } catch {
    invitation.value = null
  } finally {
    loading.value = false
  }
})
</script>
