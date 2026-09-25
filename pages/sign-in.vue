<template>
  <div class="auth-page">
    <AuthVisual />

    <div class="auth-container">
      <NuxtLink to="/" class="auth-brand"><BrandMark :size="26" /><span class="brand-name">Tenis Ecuador</span></NuxtLink>

      <div class="auth-card">
        <div class="auth-header">
          <h1 class="auth-title">Bienvenido de vuelta</h1>
          <p class="auth-subtitle">Ingresa a tu cuenta para continuar</p>
        </div>

        <div v-if="notice" class="invitation-notice">
          <Icon name="heroicons:envelope-open" class="notice-icon w-5 h-5 text-accent" aria-hidden="true" />
          <p class="notice-text">{{ notice }}</p>
        </div>

        <AuthForm mode="sign-in" :initial-email="initialEmail" @success="onSuccess" />
      </div>

      <p class="auth-footer">
        ¿No tienes cuenta?
        <NuxtLink :to="{ path: '/sign-up', query: route.query }" class="auth-link">Regístrate gratis</NuxtLink>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: [] })

const route = useRoute()
const { isAuthenticated } = useAuthState()

const initialEmail = computed(() => (route.query.email as string | undefined) ?? '')
const invitationToken = computed(() => route.query.invitation_token as string | undefined)
const notice = computed(() => {
  if (route.query.message) return route.query.message as string
  if (invitationToken.value) return 'Inicia sesión para aceptar tu invitación.'
  return ''
})

function destination(): string {
  if (invitationToken.value) return invitationPath(invitationToken.value)
  return safeRedirect(route.query.redirect)
}

async function onSuccess() {
  await navigateTo(destination(), { replace: true })
}

if (isAuthenticated.value) {
  await navigateTo(destination(), { replace: true })
}
</script>

<style scoped>
.invitation-notice {
  background: var(--accent-subtle);
  border: 1px solid var(--accent);
  border-radius: var(--radius-lg);
  padding: var(--spacing-4);
  margin-bottom: var(--spacing-4);
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
}
.notice-icon { font-size: 1.25rem; flex-shrink: 0; }
.notice-text { font-size: 0.875rem; color: var(--foreground); margin: 0; line-height: 1.4; }
</style>
