<template>
  <div class="auth-page">
    <AuthVisual />

    <div class="auth-container">
      <NuxtLink to="/" class="auth-brand"><BrandMark :size="26" /><span class="brand-name">Administración</span></NuxtLink>

      <div class="auth-card">
        <div class="auth-header">
          <h1 class="auth-title">Acceso de administración</h1>
          <p class="auth-subtitle">Inicia sesión con una cuenta de administrador</p>
        </div>

        <p v-if="denied" class="form-error admin-denied" role="alert">
          Tu cuenta no tiene acceso de administración.
        </p>

        <AuthForm mode="sign-in" @success="onSuccess" />
      </div>

      <p class="auth-footer">
        <NuxtLink to="/sign-in" class="auth-link">Acceso de jugadores</NuxtLink>
        <span aria-hidden="true">·</span>
        <NuxtLink to="/" class="auth-link">Volver al inicio</NuxtLink>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: [] })

const { isAuthenticated, role } = useAuthState()
const denied = ref(false)

async function onSuccess() {
  if (role.value === 'admin') {
    await navigateTo('/admin', { replace: true })
    return
  }
  denied.value = true
}

if (isAuthenticated.value) {
  if (role.value === 'admin') {
    await navigateTo('/admin', { replace: true })
  } else {
    denied.value = true
  }
}
</script>

<style scoped>
.admin-denied { margin-bottom: 16px; }
</style>
