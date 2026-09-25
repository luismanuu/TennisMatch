<template>
  <div class="account-security">
    <div class="account-security__row">
      <span class="meta">Correo de la cuenta</span>
      <strong class="account-security__email">{{ user?.email }}</strong>
    </div>

    <form class="account-security__form" novalidate @submit.prevent="changePassword">
      <h3 class="account-security__title">Cambiar contraseña</h3>
      <div>
        <label for="current-password" class="form-label">Contraseña actual</label>
        <input id="current-password" v-model="current" type="password" class="form-input" autocomplete="current-password" required :disabled="pending">
      </div>
      <div>
        <label for="new-password" class="form-label">Nueva contraseña</label>
        <input
          id="new-password"
          v-model="next"
          type="password"
          class="form-input"
          autocomplete="new-password"
          minlength="8"
          required
          :disabled="pending"
          aria-describedby="new-password-hint"
        >
        <p id="new-password-hint" class="meta account-security__hint">Mínimo 8 caracteres. Cerraremos tus otras sesiones.</p>
      </div>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <p v-if="done" class="account-security__done" role="status">Listo, tu contraseña se actualizó.</p>
      <button type="submit" class="btn-primary" :disabled="pending">{{ pending ? 'Guardando…' : 'Guardar contraseña' }}</button>
    </form>
  </div>
</template>

<script setup lang="ts">
const { user } = useAuthState()
const current = ref('')
const next = ref('')
const pending = ref(false)
const error = ref('')
const done = ref(false)

async function changePassword() {
  error.value = ''
  done.value = false
  if (next.value.length < 8) {
    error.value = 'La nueva contraseña debe tener al menos 8 caracteres.'
    return
  }
  let result: Awaited<ReturnType<typeof authClient.changePassword>>
  try {
    result = await withPending(pending, () =>
      authClient.changePassword({ currentPassword: current.value, newPassword: next.value, revokeOtherSessions: true }),
    )
  } catch {
    error.value = 'No pudimos conectar con el servidor. Inténtalo de nuevo.'
    return
  }
  if (result.error) {
    error.value =
      result.error.code === 'INVALID_PASSWORD'
        ? 'La contraseña actual no es correcta.'
        : 'No pudimos cambiar tu contraseña. Inténtalo de nuevo.'
    return
  }
  current.value = ''
  next.value = ''
  done.value = true
}
</script>

<style scoped>
.account-security { display: grid; gap: 20px; padding: 20px; }
.account-security__row { display: grid; gap: 4px; }
.account-security__email { overflow-wrap: anywhere; }
.account-security__form { display: grid; gap: 14px; }
.account-security__title { font-size: 18px; }
.account-security__hint { margin-top: 6px; }
.account-security__done { color: var(--accent); font-size: 14px; }
</style>
