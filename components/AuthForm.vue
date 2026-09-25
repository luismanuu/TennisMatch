<template>
  <form class="auth-form" novalidate @submit.prevent="submit">
    <div v-if="mode === 'sign-up'" class="auth-field">
      <label for="auth-name" class="form-label">Nombre completo</label>
      <input
        id="auth-name"
        v-model.trim="name"
        type="text"
        class="form-input"
        autocomplete="name"
        required
        :disabled="pending"
      >
    </div>

    <div class="auth-field">
      <label for="auth-email" class="form-label">Correo electrónico</label>
      <input
        id="auth-email"
        v-model.trim="email"
        type="email"
        class="form-input"
        autocomplete="email"
        inputmode="email"
        required
        :readonly="emailLocked"
        :disabled="pending"
        :aria-describedby="emailLocked ? 'auth-email-hint' : undefined"
      >
      <p v-if="emailLocked" id="auth-email-hint" class="auth-hint">Es el correo al que llegó tu invitación.</p>
    </div>

    <div class="auth-field">
      <label for="auth-password" class="form-label">Contraseña</label>
      <input
        id="auth-password"
        v-model="password"
        type="password"
        class="form-input"
        :autocomplete="mode === 'sign-up' ? 'new-password' : 'current-password'"
        :minlength="MIN_PASSWORD"
        required
        :disabled="pending"
        :aria-describedby="mode === 'sign-up' ? 'auth-password-hint' : undefined"
      >
      <p v-if="mode === 'sign-up'" id="auth-password-hint" class="auth-hint">Mínimo {{ MIN_PASSWORD }} caracteres.</p>
    </div>

    <p v-if="error" class="form-error" role="alert">{{ error }}</p>

    <button type="submit" class="btn-primary auth-submit" :disabled="pending">
      {{ pending ? 'Un momento…' : submitLabel }}
    </button>
  </form>
</template>

<script setup lang="ts">
const MIN_PASSWORD = 8

const props = withDefaults(
  defineProps<{
    mode: 'sign-in' | 'sign-up'
    initialEmail?: string
    initialName?: string
    invitationToken?: string
    emailLocked?: boolean
    submitLabel?: string
  }>(),
  { initialEmail: '', initialName: '', invitationToken: undefined, emailLocked: false, submitLabel: undefined },
)

const emit = defineEmits<{
  (e: 'success', payload: { needsVerification: boolean; email: string }): void
}>()

const { refresh } = useAuthState()

const name = ref(props.initialName)
const email = ref(props.initialEmail)
const password = ref('')
const pending = ref(false)
const error = ref('')

watch(
  () => props.initialEmail,
  (value) => {
    if (value) email.value = value
  },
)

const submitLabel = computed(() => props.submitLabel ?? (props.mode === 'sign-up' ? 'Crear cuenta' : 'Iniciar sesión'))

const PASSWORD_TOO_SHORT = `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`

const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'El correo o la contraseña no son correctos.',
  USER_ALREADY_EXISTS: 'Ya existe una cuenta con este correo. Inicia sesión.',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'Ya existe una cuenta con este correo. Inicia sesión.',
  PASSWORD_TOO_SHORT,
  INVALID_EMAIL: 'Revisa el formato del correo.',
  EMAIL_NOT_VERIFIED: 'Confirma tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.',
}

function validate(): string {
  if (props.mode === 'sign-up' && name.value.length < 2) return 'Escribe tu nombre.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) return 'Revisa el formato del correo.'
  if (password.value.length < MIN_PASSWORD) return PASSWORD_TOO_SHORT
  return ''
}

async function submit() {
  error.value = validate()
  if (error.value) return
  try {
    const result = await withPending(pending, async () =>
      props.mode === 'sign-up'
        ? await authClient.signUp.email({ name: name.value, email: email.value, password: password.value, callbackURL: verificationCallback(props.invitationToken) })
        : await authClient.signIn.email({ email: email.value, password: password.value }),
    )
    if (result.error) {
      error.value = MESSAGES[result.error.code ?? ''] ?? 'No pudimos completar la solicitud. Inténtalo de nuevo.'
      return
    }
    const user = await refresh()
    emit('success', { needsVerification: user === null, email: email.value })
  } catch {
    error.value = 'No pudimos conectar con el servidor. Inténtalo de nuevo.'
  }
}
</script>

<style scoped>
.auth-form { display: flex; flex-direction: column; gap: 16px; }
.auth-field { display: flex; flex-direction: column; }
.auth-hint { margin-top: 6px; font-size: 13px; color: var(--foreground-subtle); }
.auth-submit { width: 100%; min-height: 44px; margin-top: 4px; }
.form-input[readonly] { opacity: 0.75; cursor: not-allowed; }
</style>
