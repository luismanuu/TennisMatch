<template>
  <div class="auth-page">
    <!-- Decorative elements -->
    <div class="auth-decoration">
      <div class="decoration-ring decoration-ring-1"></div>
      <div class="decoration-ring decoration-ring-2"></div>
      <div class="decoration-glow"></div>
    </div>

    <div class="auth-container">
      <!-- Logo & Branding -->
      <div class="auth-brand animate-fade-up">
        <div class="brand-icon">
          <span>🎾</span>
        </div>
        <span class="brand-name">Tenis Ecuador</span>
      </div>

      <!-- Main Card -->
      <div class="auth-card animate-fade-up animate-delay-1">
        <div class="auth-header">
          <h1 class="auth-title">Verifica tu correo</h1>
          <p class="auth-subtitle">Ingresa el código que enviamos a tu correo electrónico</p>
        </div>

        <!-- Email Info Message -->
        <div v-if="userEmail" class="email-info-message">
          <div class="flex items-center gap-2 justify-center">
            <span class="text-xl">📧</span>
            <p class="text-size-4 font-regular text-foreground-muted">
              Se envió un código de verificación a <strong class="text-foreground">{{ userEmail }}</strong>
            </p>
          </div>
        </div>
        <div v-else class="email-info-message">
          <div class="flex items-center gap-2 justify-center">
            <span class="text-xl">📧</span>
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
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
                <p class="text-size-4 font-regular text-foreground-muted ml-4">Cargando...</p>
              </div>
            </template>
          </ClientOnly>
        </div>
      </div>

      <!-- Footer -->
      <p class="auth-footer animate-fade-up animate-delay-2">
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
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-6) var(--spacing-4);
  position: relative;
  overflow-x: hidden;
  overflow-y: auto;
}

/* Decorative Elements */
.auth-decoration {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.decoration-ring {
  position: absolute;
  border-radius: 50%;
  border: 1px solid var(--border-subtle);
}

.decoration-ring-1 {
  width: 500px;
  height: 500px;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  opacity: 0.2;
}

.decoration-ring-2 {
  width: 700px;
  height: 700px;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  opacity: 0.1;
}

.decoration-glow {
  position: absolute;
  width: 300px;
  height: 300px;
  top: 25%;
  left: 50%;
  transform: translateX(-50%);
  background: radial-gradient(circle, var(--accent) 0%, transparent 70%);
  opacity: 0.06;
  filter: blur(60px);
}

/* Container */
.auth-container {
  width: 100%;
  max-width: 380px;
  position: relative;
  z-index: 1;
}

/* Brand */
.auth-brand {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-2);
  margin-bottom: var(--spacing-5);
}

.brand-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, var(--accent) 0%, oklch(0.60 0.20 150) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.125rem;
  box-shadow: 0 4px 12px -4px var(--glow-accent);
}

.brand-name {
  font-size: 1.125rem;
  font-weight: var(--font-weight-semibold);
  color: var(--foreground);
  letter-spacing: -0.01em;
}

/* Card */
.auth-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: var(--spacing-6);
  box-shadow: 
    0 1px 3px 0 oklch(0 0 0 / 0.1),
    0 1px 2px -1px oklch(0 0 0 / 0.1);
  overflow: visible;
  position: relative;
}

/* Header */
.auth-header {
  text-align: center;
  margin-bottom: var(--spacing-5);
}

.auth-title {
  font-size: 1.375rem;
  font-weight: var(--font-weight-semibold);
  color: var(--foreground);
  margin-bottom: var(--spacing-1);
  letter-spacing: -0.02em;
  line-height: 1.3;
}

.auth-subtitle {
  font-size: var(--font-size-4);
  color: var(--foreground-muted);
  line-height: 1.4;
}

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
  border: 2px solid var(--border) !important;
  color: var(--foreground) !important;
  padding: 0.4375rem 0.75rem !important;
  font-size: 0.8125rem !important;
  height: 2.125rem !important;
}

/* ═══════════════════════════════════════════════════════════════════════════
   OTP CODE INPUT STYLING - Using HEX for mobile compatibility
   ═══════════════════════════════════════════════════════════════════════════ */

/* Visual OTP digit segments */
.clerk-wrapper :deep(.cl-otpCodeFieldInput),
.clerk-wrapper :deep(.cl-input.cl-otpCodeFieldInput),
.clerk-wrapper :deep([data-input-otp-placeholder="true"]) {
  background: #252535 !important;
  border: 2px solid #6b6b8a !important;
  border-radius: 8px !important;
  font-size: 1.25rem !important;
  font-weight: 600 !important;
  height: 3rem !important;
  width: 2.5rem !important;
  min-width: 2.5rem !important;
  max-width: 2.5rem !important;
  color: #f2f2f7 !important;
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
  border-color: #4ade80 !important;
  box-shadow: 0 0 0 3px rgba(74, 222, 128, 0.2) !important;
  background: #2a2a3e !important;
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
  caret-color: #4ade80 !important;
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
  background: oklch(0.95 0 0) !important;
  background-color: oklch(0.95 0 0) !important;
  color: oklch(0.13 0 0) !important;
  padding: 0.625rem 1.25rem !important;
  font-size: 0.875rem !important;
  border-radius: var(--radius-md) !important;
}

.clerk-wrapper :deep(.cl-formButtonPrimary:hover) {
  background: oklch(0.70 0.22 150) !important;
  background-color: oklch(0.70 0.22 150) !important;
}

/* Footer */
.auth-footer {
  text-align: center;
  margin-top: var(--spacing-4);
  font-size: 0.8125rem;
  color: var(--foreground-muted);
}

.auth-link {
  color: var(--accent);
  font-weight: var(--font-weight-semibold);
  text-decoration: none;
  transition: color 200ms ease;
}

.auth-link:hover {
  color: oklch(0.75 0.22 150);
  text-decoration: underline;
}
</style>

