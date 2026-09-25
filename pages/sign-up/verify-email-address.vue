<template>
  <div class="auth-page">
    <AuthVisual />

    <div class="auth-container">
      <NuxtLink to="/" class="auth-brand"><BrandMark :size="26" /><span class="brand-name">Tenis Ecuador</span></NuxtLink>

      <div class="auth-card">
        <div class="auth-header">
          <h1 class="auth-title">{{ title }}</h1>
          <p class="auth-subtitle">{{ subtitle }}</p>
        </div>

        <template v-if="verified">
          <NuxtLink to="/onboarding" class="btn-primary verify-action">Continuar</NuxtLink>
        </template>

        <template v-else>
          <div class="email-info-message">
            <Icon name="heroicons:envelope" class="w-5 h-5 text-accent flex-shrink-0" aria-hidden="true" />
            <p>
              <template v-if="email">Enviamos un enlace de confirmación a <strong>{{ email }}</strong>.</template>
              <template v-else>Enviamos un enlace de confirmación a tu correo.</template>
              Ábrelo para activar tu cuenta.
            </p>
          </div>

          <p v-if="status" class="verify-status" role="status">{{ status }}</p>

          <button
            v-if="email"
            type="button"
            class="btn-secondary verify-action"
            :disabled="sending"
            @click="resend"
          >
            {{ sending ? 'Enviando…' : 'Reenviar enlace' }}
          </button>
        </template>
      </div>

      <p class="auth-footer">
        ¿Ya confirmaste tu correo?
        <NuxtLink to="/sign-in" class="auth-link">Inicia sesión</NuxtLink>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: [] })

const route = useRoute()
const email = computed(() => (route.query.email as string | undefined) ?? '')
const verified = computed(() => route.query.verified === '1' && !route.query.error)
const linkError = computed(() => route.query.error as string | undefined)

const title = computed(() => (verified.value ? 'Correo confirmado' : 'Verifica tu correo'))
const subtitle = computed(() => {
  if (verified.value) return 'Tu cuenta está activa. Completa tu perfil de jugador.'
  if (linkError.value) return 'El enlace no es válido o ya venció. Pide uno nuevo.'
  return 'Te falta un paso para activar tu cuenta'
})

const sending = ref(false)
const status = ref('')

async function resend() {
  sending.value = true
  status.value = ''
  const { error } = await authClient.sendVerificationEmail({
    email: email.value,
    callbackURL: '/sign-up/verify-email-address?verified=1',
  })
  status.value = error ? 'No pudimos reenviar el enlace. Inténtalo en unos minutos.' : 'Listo, revisa tu bandeja de entrada.'
  sending.value = false
}

if (verified.value) {
  await useAuthState().refresh()
}
</script>

<style scoped>
.email-info-message { display: flex; gap: 10px; align-items: flex-start; padding: 14px 16px; border-radius: 14px; background: var(--surface); color: var(--foreground-muted); font-size: 15px; }
.email-info-message strong { color: var(--foreground); }
.verify-status { margin-top: 12px; font-size: 14px; color: var(--foreground-muted); }
.verify-action { display: inline-flex; justify-content: center; width: 100%; min-height: 44px; margin-top: 16px; }
</style>
