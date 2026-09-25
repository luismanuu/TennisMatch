<template>
  <div class="auth-page">
    <AuthVisual />

    <div class="auth-container">
      <!-- Logo & Branding -->
      <NuxtLink to="/" class="auth-brand"><BrandMark :size="26" /><span class="brand-name">Tenis Ecuador</span></NuxtLink>

      <!-- Main Card -->
      <div class="auth-card">
        <div class="auth-header">
          <h1 class="auth-title">Verifica tu correo</h1>
          <p class="auth-subtitle">Ingresa el código que enviamos a tu correo electrónico</p>
        </div>

        <!-- Email Info Message -->
        <div v-if="userEmail" class="email-info-message">
          <div class="flex items-center gap-2 justify-center">
            <Icon name="heroicons:envelope" class="w-5 h-5 text-accent flex-shrink-0" aria-hidden="true" />
            <p class="text-size-4 font-regular text-foreground-muted">
              Se envió un código de verificación a <strong class="text-foreground">{{ userEmail }}</strong>
            </p>
          </div>
        </div>
        <div v-else class="email-info-message">
          <div class="flex items-center gap-2 justify-center">
            <Icon name="heroicons:envelope" class="w-5 h-5 text-accent flex-shrink-0" aria-hidden="true" />
            <p class="text-size-4 font-regular text-foreground-muted">
              Se envió un código de verificación a tu correo electrónico
            </p>
          </div>
        </div>

        <!-- Clerk Email Verification Component -->
        <div class="clerk-wrapper">
          <ClientOnly>
            <EmailAddress 
              v-if="shouldShowVerification"
              :routing="'path'"
              :path="'/sign-up/verify-email-address'"
              :appearance="clerkAppearance"
              :key="verificationKey"
            />
            <template #fallback>
              <div class="flex items-center justify-center p-8">
                <Icon name="heroicons:arrow-path" class="w-8 h-8 text-accent animate-spin" aria-hidden="true" />
                <p class="text-size-4 font-regular text-foreground-muted ml-4">Cargando...</p>
              </div>
            </template>
          </ClientOnly>
        </div>
      </div>

      <!-- Footer -->
      <p class="auth-footer">
        <NuxtLink to="/sign-in" class="auth-link">Volver a iniciar sesión</NuxtLink>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { esES } from '@clerk/localizations'
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

definePageMeta({
  middleware: []
})

const { user } = useUser()

const clerkAppearance = {
  localization: esES
}

// Get user email from Clerk user object
const userEmail = computed(() => {
  return user.value?.emailAddresses?.[0]?.emailAddress || user.value?.primaryEmailAddress?.emailAddress || null
})

// Control whether to show verification component (prevents auto-send on reload)
const shouldShowVerification = ref(false)
const verificationKey = ref<string>('')

onMounted(() => {
  if (process.client) {
    const codeSentKey = 'clerk-verification-code-sent'
    const verificationInitiatedKey = 'clerk-verification-initiated'
    const codeSentTimestamp = sessionStorage.getItem(codeSentKey)
    const verificationInitiated = sessionStorage.getItem(verificationInitiatedKey)
    const now = Date.now()
    
    // Check if code was sent less than 10 minutes ago
    const codeSentRecently = codeSentTimestamp && (now - parseInt(codeSentTimestamp)) < 10 * 60 * 1000
    
    // Only show verification component if:
    // 1. User just came from sign-up (verificationInitiated exists) - Clerk will send code automatically
    // 2. Code was sent recently (user is returning to verify) - reuse existing session
    if (verificationInitiated || codeSentRecently) {
      shouldShowVerification.value = true
      
      if (codeSentRecently && !verificationInitiated) {
        // Code was already sent and user is reloading - reuse existing session to prevent re-sending
        verificationKey.value = 'existing-verification-' + codeSentTimestamp
      } else if (verificationInitiated) {
        // First time coming from sign-up - Clerk will send code, mark timestamp
        verificationKey.value = `verification-${now}`
        sessionStorage.setItem(codeSentKey, now.toString())
        // Remove the initiated flag so reloads don't trigger new sends
        sessionStorage.removeItem(verificationInitiatedKey)
      }
    } else {
      // User accessed page directly without coming from sign-up
      // Redirect to sign-up
      router.replace('/sign-up')
    }
  }
})
</script>

<style scoped>

/* Email Info Message */
.email-info-message {
  margin-bottom: var(--spacing-4);
  padding: var(--spacing-3) var(--spacing-4);
  background: var(--accent-subtle);
  border: 1px solid var(--accent);
  border-radius: var(--radius-md);
  text-align: center;
}

/* Clerk Wrapper */
.clerk-wrapper {
  width: 100%;
  max-width: 100%;
  overflow: visible;
  position: relative;
  z-index: 1;
}

.clerk-wrapper :deep(.cl-rootBox),
.clerk-wrapper :deep(.cl-card),
.clerk-wrapper :deep(.cl-cardBox),
.clerk-wrapper :deep(.cl-component),
.clerk-wrapper :deep(.cl-form) {
  width: 100% !important;
  max-width: 100% !important;
  box-sizing: border-box !important;
}

.clerk-wrapper :deep(.cl-main) {
  width: 100% !important;
  max-width: 100% !important;
  box-sizing: border-box !important;
  padding: var(--spacing-4) var(--spacing-6) !important;
  overflow: visible !important;
}

.clerk-wrapper :deep(.cl-form) {
  overflow: visible !important;
}

.clerk-wrapper :deep(.cl-formFieldInput) {
  background: var(--surface) !important;
  border: 1px solid var(--edge) !important;
  color: var(--foreground) !important;
  padding: 0.4375rem 0.75rem !important;
  font-size: 0.8125rem !important;
  min-height: 2.75rem !important; height: auto !important;
}

/* ═══════════════════════════════════════════════════════════════════════════
   OTP CODE INPUT STYLING - Using HEX for mobile compatibility
   ═══════════════════════════════════════════════════════════════════════════ */

/* Visual OTP digit segments */
.clerk-wrapper :deep(.cl-otpCodeFieldInput),
.clerk-wrapper :deep(.cl-input.cl-otpCodeFieldInput),
.clerk-wrapper :deep([data-input-otp-placeholder="true"]) {
  background: var(--surface) !important;
  border: 1px solid var(--edge) !important;
  border-radius: 8px !important;
  font-size: 1.25rem !important;
  font-weight: 600 !important;
  height: 3rem !important;
  width: 2.5rem !important;
  min-width: 2.5rem !important;
  max-width: 2.5rem !important;
  color: var(--foreground) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 0 !important;
  margin: 0 !important;
  flex-shrink: 0 !important;
  pointer-events: none !important;
  transition: border-color 150ms ease, box-shadow 150ms ease !important;
}

/* OTP segment focus state */
.clerk-wrapper :deep([data-input-otp-container="true"]:focus-within .cl-otpCodeFieldInput) {
  border-color: var(--accent) !important;
  box-shadow: 0 0 0 3px rgba(74, 222, 128, 0.2) !important;
  background: var(--surface-elevated) !important;
}

/* OTP Container - Must be interactive */
.clerk-wrapper :deep(.cl-otpCodeFieldInputs),
.clerk-wrapper :deep(.cl-otpCodeField),
.clerk-wrapper :deep([data-input-otp-container="true"]) {
  display: flex !important;
  gap: 0.5rem !important;
  justify-content: center !important;
  align-items: center !important;
  pointer-events: auto !important;
  position: relative !important;
  cursor: text !important;
  user-select: auto !important;
  width: 100% !important;
  max-width: 100% !important;
  box-sizing: border-box !important;
  padding: 0.25rem !important;
  overflow: visible !important;
  flex-wrap: nowrap !important;
}

/* CRITICAL: Override inline pointer-events:none on wrapper divs */
.clerk-wrapper :deep([data-input-otp-container="true"] > div) {
  pointer-events: auto !important;
  width: 100% !important;
  max-width: 100% !important;
  box-sizing: border-box !important;
}

/* Hidden input that receives all keystrokes - CRITICAL */
.clerk-wrapper :deep(input[data-input-otp="true"]) {
  position: absolute !important;
  inset: 0 !important;
  width: 100% !important;
  max-width: 100% !important;
  height: 100% !important;
  z-index: 20 !important;
  opacity: 1 !important;
  background: transparent !important;
  border: none !important;
  outline: none !important;
  color: transparent !important;
  caret-color: var(--accent) !important;
  font-size: 1.25rem !important;
  letter-spacing: 0.75rem !important;
  box-sizing: border-box !important;
  pointer-events: auto !important;
  touch-action: manipulation !important;
  cursor: text !important;
  -webkit-user-select: text !important;
  user-select: text !important;
  -webkit-appearance: none !important;
  appearance: none !important;
  /* Override Clerk's inline width calculation */
  clip-path: none !important;
}

/* OTP Error Message - Add spacing after OTP fields */
.clerk-wrapper :deep(.cl-otpCodeFieldErrorText),
.clerk-wrapper :deep(.cl-otpCodeField .cl-otpCodeFieldErrorText),
.clerk-wrapper :deep(.cl-otpCodeField ~ .cl-otpCodeFieldErrorText),
.clerk-wrapper :deep(.cl-otpCodeFieldInputContainer ~ .cl-otpCodeFieldErrorText) {
  margin-top: var(--spacing-3) !important;
  display: block !important;
}

/* Also target the container div that holds the error */
.clerk-wrapper :deep(.cl-otpCodeField > div:last-child) {
  margin-top: var(--spacing-3) !important;
}

/* Ensure input text is visible */
.clerk-wrapper :deep(input[type="text"]),
.clerk-wrapper :deep(input[type="email"]),
.clerk-wrapper :deep(input[type="password"]),
.clerk-wrapper :deep(input[type="tel"]) {
  color: var(--foreground) !important;
}

.clerk-wrapper :deep(input::placeholder) {
  color: var(--foreground-subtle) !important;
  opacity: 1 !important;
}

.clerk-wrapper :deep(.cl-formButtonPrimary) {
  background: var(--accent) !important;
  background-color: var(--accent) !important;
  color: var(--accent-foreground) !important;
  padding: 0.625rem 1.25rem !important;
  font-size: 0.875rem !important;
  border-radius: var(--radius-md) !important;
}

.clerk-wrapper :deep(.cl-formButtonPrimary:hover) {
  background: var(--accent-hover) !important;
  background-color: var(--accent-hover) !important;
}
</style>

