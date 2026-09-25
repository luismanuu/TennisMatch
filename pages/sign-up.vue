<template>
  <div class="auth-page">
    <AuthVisual />

    <div class="auth-container">
      <NuxtLink to="/" class="auth-brand"><BrandMark :size="26" /><span class="brand-name">Tenis Ecuador</span></NuxtLink>

      <div class="auth-card">
        <div class="auth-header">
          <h1 class="auth-title">Crea tu cuenta</h1>
          <p class="auth-subtitle">Únete a la comunidad de tenistas de Ecuador</p>
        </div>

        <AuthForm
          mode="sign-up"
          :initial-email="invitationEmail"
          :email-locked="Boolean(invitationEmail)"
          :invitation-token="invitationToken"
          @success="onSuccess"
        />
      </div>

      <p class="auth-footer">
        ¿Ya tienes cuenta?
        <NuxtLink :to="{ path: '/sign-in', query: route.query }" class="auth-link">Inicia sesión</NuxtLink>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: [] })

const route = useRoute()
const { isAuthenticated } = useAuthState()

const invitationToken = computed(() => route.query.invitation_token as string | undefined)
// The email is only prefilled (and locked) when the link carries an invitation token.
const invitationEmail = computed(() =>
  invitationToken.value ? ((route.query.email as string | undefined) ?? '') : '',
)

function destination(): string {
  if (invitationToken.value) return invitationPath(invitationToken.value)
  return safeRedirect(route.query.redirect, '/onboarding')
}

async function onSuccess({ needsVerification, email }: { needsVerification: boolean; email: string }) {
  if (needsVerification) {
    await navigateTo({ path: VERIFY_EMAIL_PAGE, query: { email, invitation_token: invitationToken.value } })
    return
  }
  await navigateTo(destination(), { replace: true })
}

if (isAuthenticated.value) {
  await navigateTo(destination(), { replace: true })
}
</script>
