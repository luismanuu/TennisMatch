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
          <h1 class="auth-title">Bienvenido de vuelta</h1>
          <p class="auth-subtitle">Ingresa a tu cuenta para continuar</p>
        </div>

        <!-- Invitation Message -->
        <div v-if="invitationMessage" class="invitation-notice">
          <div class="notice-icon">🎾</div>
          <p class="notice-text">{{ invitationMessage }}</p>
        </div>

        <!-- Clerk Sign In Component -->
        <div class="clerk-wrapper">
          <SignIn
            :routing="'path'"
            :path="'/sign-in'"
            :sign-up-url="'/sign-up'"
            :appearance="clerkAppearance"
            :initial-values="invitationEmail ? { emailAddress: invitationEmail } : undefined"
          />
        </div>
      </div>

      <!-- Footer -->
      <p class="auth-footer animate-fade-up animate-delay-2">
        ¿No tienes cuenta? 
        <NuxtLink to="/sign-up" class="auth-link">Regístrate gratis</NuxtLink>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { esES } from '@clerk/localizations'

definePageMeta({
  middleware: []
})

const route = useRoute()
const router = useRouter()
const { isAuthenticated, userId } = useAuthState()

// Check if coming from invitation completion
const invitationEmail = computed(() => route.query.email as string | undefined)
const invitationMessage = computed(() => route.query.message as string | undefined)
const invitationToken = computed(() => route.query.invitation_token as string | undefined)

// Handle invitation completion for OAuth users
const handleInvitationForOAuth = async () => {
  if (!invitationToken.value || !isAuthenticated.value || !userId.value) return

  try {
    console.log('Completing invitation for OAuth user:', { invitationToken: invitationToken.value, userId: userId.value })

    // Call API to complete invitation for OAuth user
    const response = await $fetch('/api/invitations/complete-oauth', {
      method: 'POST',
      body: {
        invitation_token: invitationToken.value,
        clerk_user_id: userId.value
      }
    })

    if (response.success) {
      console.log('Invitation completed successfully for OAuth user')
      // Redirect to home after successful completion
      await router.push('/')
    }
  } catch (error: any) {
    console.error('Error completing invitation for OAuth user:', error)
    // Continue to home anyway - the user is authenticated
    await router.push('/')
  }
}

// Watch for authentication state changes when coming from invitation
watch([isAuthenticated, invitationToken], ([authenticated, token]) => {
  if (authenticated && token) {
    // User just signed in via OAuth after invitation
    handleInvitationForOAuth()
  }
}, { immediate: true })

// Custom localization that extends esES but removes "ultimo uso" references
const customLocalization = {
  ...esES,
  // Override the lastAuthenticationStrategy key to remove "Último uso" text
  lastAuthenticationStrategy: ''
}

const clerkAppearance = {
  localization: customLocalization
}

// Hide the lastAuthenticationStrategyBadge element after Clerk loads
if (process.client) {
  onMounted(() => {
    const hideBadge = () => {
      const clerkWrapper = document.querySelector('.clerk-wrapper')
      if (!clerkWrapper) return
      
      // Target the specific badge element
      const badge = clerkWrapper.querySelector('.cl-lastAuthenticationStrategyBadge')
      if (badge) {
        badge.style.display = 'none'
        badge.style.visibility = 'hidden'
      }
      
      // Also target by data attribute as fallback
      const badgeByAttr = clerkWrapper.querySelector('[data-localization-key="lastAuthenticationStrategy"]')
      if (badgeByAttr) {
        badgeByAttr.style.display = 'none'
        badgeByAttr.style.visibility = 'hidden'
      }
    }
    
    // Run immediately and after delays to catch dynamically loaded content
    hideBadge()
    setTimeout(hideBadge, 500)
    setTimeout(hideBadge, 1000)
    
    // Use MutationObserver to catch dynamically added content
    const clerkWrapper = document.querySelector('.clerk-wrapper')
    if (clerkWrapper) {
      const observer = new MutationObserver(() => {
        hideBadge()
      })
      observer.observe(clerkWrapper, {
        childList: true,
        subtree: true
      })
      
      // Cleanup on unmount
      onUnmounted(() => {
        observer.disconnect()
      })
    }
  })
}
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

/* Clerk Wrapper - Constrained width */
.clerk-wrapper {
  width: 100%;
  max-width: 100%;
  overflow: visible;
  position: relative;
  z-index: 1;
}

/* Force Clerk components to fit within container */
.clerk-wrapper :deep(.cl-rootBox),
.clerk-wrapper :deep(.cl-card),
.clerk-wrapper :deep(.cl-cardBox),
.clerk-wrapper :deep(.cl-component),
.clerk-wrapper :deep(.cl-form) {
  width: 100% !important;
  max-width: 100% !important;
  box-sizing: border-box !important;
}

/* Add padding to main Clerk container */
.clerk-wrapper :deep(.cl-main) {
  width: 100% !important;
  max-width: 100% !important;
  box-sizing: border-box !important;
  padding: var(--spacing-4) var(--spacing-6) !important;
}

/* Tighten form spacing */
.clerk-wrapper :deep(.cl-formFieldRow) {
  margin-bottom: var(--spacing-3) !important;
}

.clerk-wrapper :deep(.cl-formFieldLabel) {
  margin-bottom: var(--spacing-1) !important;
  font-size: 0.8125rem !important;
}

.clerk-wrapper :deep(.cl-formFieldInput:not(.cl-otpCodeFieldInput)) {
  background: var(--surface) !important;
  border: 2px solid var(--border) !important;
  color: var(--foreground) !important;
  padding: 0.4375rem 0.75rem !important;
  font-size: 0.8125rem !important;
  height: 2.125rem !important;
  transition: border-color 150ms ease, box-shadow 150ms ease !important;
}

.clerk-wrapper :deep(.cl-formFieldInput:not(.cl-otpCodeFieldInput):hover) {
  border-color: var(--border-subtle) !important;
  border-width: 2px !important;
  color: var(--foreground) !important;
}

.clerk-wrapper :deep(.cl-formFieldInput:not(.cl-otpCodeFieldInput):focus) {
  border-color: var(--accent) !important;
  border-width: 2px !important;
  box-shadow: 0 0 0 3px var(--accent-subtle) !important;
  color: var(--foreground) !important;
}

.clerk-wrapper :deep(.cl-formFieldInput:not(.cl-otpCodeFieldInput)[data-invalid="true"]) {
  border-color: oklch(0.60 0.18 25) !important;
  border-width: 2px !important;
}

.clerk-wrapper :deep(.cl-formFieldInput:not(.cl-otpCodeFieldInput)[data-invalid="true"]:hover) {
  border-color: oklch(0.65 0.18 25) !important;
  border-width: 2px !important;
}

.clerk-wrapper :deep(.cl-formFieldInput:not(.cl-otpCodeFieldInput)[data-invalid="true"]:focus) {
  border-color: oklch(0.60 0.18 25) !important;
  border-width: 2px !important;
  box-shadow: 0 0 0 3px oklch(0.60 0.18 25 / 0.2) !important;
}

/* Social button compact */
.clerk-wrapper :deep(.cl-socialButtonsBlockButton) {
  background: var(--background) !important;
  border: 1px solid var(--border) !important;
  border-radius: var(--radius-md) !important;
  color: var(--foreground) !important;
  padding: 0.625rem 1rem !important;
  font-size: 0.875rem !important;
  font-weight: var(--font-weight-semibold) !important;
  height: 2.5rem !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 0.5rem !important;
}

.clerk-wrapper :deep(.cl-socialButtonsBlockButton:hover) {
  background: var(--surface-elevated) !important;
  border-color: var(--accent) !important;
}

/* Divider compact */
.clerk-wrapper :deep(.cl-dividerRow) {
  margin: var(--spacing-3) 0 !important;
}

.clerk-wrapper :deep(.cl-dividerText) {
  font-size: 0.75rem !important;
  text-transform: uppercase !important;
  letter-spacing: 0.05em !important;
}

/* Primary button - Silicon Valley style */
.clerk-wrapper :deep(.cl-formButtonPrimary),
.clerk-wrapper :deep(button[class*="formButtonPrimary"]) {
  background: oklch(0.95 0 0) !important;
  background-color: oklch(0.95 0 0) !important;
  color: oklch(0.13 0 0) !important;
  padding: 0.625rem 1.25rem !important;
  font-size: 0.875rem !important;
  margin-top: 0.75rem !important;
  margin-bottom: 1rem !important;
  border-radius: var(--radius-md) !important;
  border: none !important;
  cursor: pointer !important;
  transition: all 150ms ease !important;
}

.clerk-wrapper :deep(.cl-formButtonPrimary:hover),
.clerk-wrapper :deep(button[class*="formButtonPrimary"]:hover) {
  background: oklch(0.70 0.22 150) !important;
  background-color: oklch(0.70 0.22 150) !important;
  color: oklch(0.13 0 0) !important;
  transform: translateY(-2px) !important;
  box-shadow: 0 8px 20px -4px oklch(0.70 0.22 150 / 0.4) !important;
}

/* Footer section with proper spacing */
.clerk-wrapper :deep(.cl-footerPages),
.clerk-wrapper :deep(.cl-footer__pages) {
  padding-top: 1rem !important;
  margin-top: 0 !important;
  gap: 0.25rem !important;
}

/* Force Clerk footer to be transparent */
.clerk-wrapper :deep([class*="cl-footerPages"]),
.clerk-wrapper :deep([class*="cl-footer"]),
.clerk-wrapper :deep([class^="cl-internal"]) {
  background: transparent !important;
  background-color: transparent !important;
}

/* Style the development mode link */
.clerk-wrapper :deep(a[href*="dashboard.clerk"]),
.clerk-wrapper :deep(a[href*="accounts.clerk"]),
.clerk-wrapper :deep([class*="footerPages"] a) {
  background: transparent !important;
  color: var(--foreground-subtle) !important;
  font-size: 0.6875rem !important;
  padding: 0 !important;
  border: none !important;
  text-decoration: none !important;
}

/* Development mode badge - force gray */
.clerk-wrapper :deep(.cl-footerPages [class*="internal"]),
.clerk-wrapper :deep(.cl-footer [class*="internal"]),
.clerk-wrapper :deep(.cl-footerPages span),
.clerk-wrapper :deep(.cl-footer span) {
  color: var(--foreground-subtle) !important;
}

/* Hide the lastAuthenticationStrategyBadge element */
.clerk-wrapper :deep(.cl-lastAuthenticationStrategyBadge),
.clerk-wrapper :deep([data-localization-key="lastAuthenticationStrategy"]) {
  display: none !important;
  visibility: hidden !important;
}

/* Override any orange/red colors in Clerk components */
.clerk-wrapper :deep(a) {
  color: var(--foreground-subtle) !important;
}

.clerk-wrapper :deep(a:hover) {
  color: var(--foreground-muted) !important;
}

/* Invitation Notice */
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

.notice-icon {
  font-size: 1.25rem;
  flex-shrink: 0;
}

.notice-text {
  font-size: 0.875rem;
  color: var(--foreground);
  margin: 0;
  line-height: 1.4;
}

/* OTP Container - Must allow pointer events for the hidden input overlay */
.clerk-wrapper :deep([data-input-otp-container="true"]) {
  position: relative !important;
  pointer-events: auto !important;
  cursor: text !important;
}

/* The hidden input overlay that actually receives input */
.clerk-wrapper :deep(input[data-input-otp="true"]) {
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  width: 100% !important;
  height: 100% !important;
  opacity: 1 !important;
  pointer-events: all !important;
  cursor: text !important;
  z-index: 10 !important;
  background: transparent !important;
  border: none !important;
  color: transparent !important;
  caret-color: var(--accent) !important;
  font-size: 20px !important;
  letter-spacing: 0.75rem !important;
  text-align: center !important;
  text-indent: 0 !important;
  /* Mobile touch improvements */
  -webkit-appearance: none !important;
  -moz-appearance: textfield !important;
  appearance: none !important;
  touch-action: manipulation !important;
  -webkit-user-select: text !important;
  user-select: text !important;
}

/* OTP Code Field Input Container */
.clerk-wrapper :deep(.cl-otpCodeFieldInputContainer) {
  pointer-events: auto !important;
  width: 100% !important;
  display: flex !important;
  justify-content: center !important;
  align-items: center !important;
}

/* OTP Code Field Inputs - KEEP pointer-events enabled for hidden input */
.clerk-wrapper :deep(.cl-otpCodeFieldInputs) {
  pointer-events: auto !important;
  position: relative !important;
  display: flex !important;
  flex-direction: row !important;
  gap: 0.5rem !important;
  justify-content: center !important;
  align-items: center !important;
  flex-wrap: nowrap !important;
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

/* Responsive */
@media (max-width: 480px) {
  .auth-container {
    max-width: 100%;
  }

  .auth-card {
    padding: var(--spacing-5);
    border-radius: var(--radius-lg);
  }

  .auth-title {
    font-size: 1.25rem;
  }

  .decoration-ring-1,
  .decoration-ring-2 {
    display: none;
  }
}
</style>
