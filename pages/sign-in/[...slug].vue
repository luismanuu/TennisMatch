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

        <!-- Clerk Sign In Component -->
        <div class="clerk-wrapper" v-if="shouldRenderSignIn">
          <ClientOnly>
            <SignIn
              v-if="shouldRenderSignIn"
              :key="signInKey"
              :routing="'path'"
              :path="'/sign-in'"
              :sign-up-url="'/sign-up'"
              :appearance="clerkAppearance"
            />
            <template #fallback>
              <div class="flex items-center justify-center p-8">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
                <p class="text-size-4 font-regular text-foreground-muted ml-4">Cargando...</p>
              </div>
            </template>
          </ClientOnly>
        </div>
        <!-- Custom message for reload scenarios -->
        <div v-else-if="isFactorTwoRoute && !shouldRenderSignIn" class="code-entry-message">
          <div class="message-content">
            <p class="message-title">Ingresa tu código de verificación</p>
            <p class="message-text">
              Ya se envió un código de verificación a tu correo electrónico.
              Por favor, revisa tu bandeja de entrada e ingresa el código a continuación.
            </p>
            <button
              @click="allowCodeEntry"
              class="continue-button"
            >
              Continuar con el código existente
            </button>
          </div>
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
import { onMounted, onUnmounted, ref, computed, watch } from 'vue'
import { esES } from '@clerk/localizations'
import { useRoute } from 'vue-router'

definePageMeta({
  middleware: ['2fa']
})

const route = useRoute()

// Custom localization that extends esES but removes "ultimo uso" references
const customLocalization = {
  ...esES,
  // Override the lastAuthenticationStrategy key to remove "Último uso" text
  lastAuthenticationStrategy: ''
}

const clerkAppearance = {
  localization: customLocalization
}

// Track if we're on the factor-two route
const isFactorTwoRoute = computed(() => {
  if (!process.client) return false
  const currentPath = window.location?.pathname || ''
  const currentHash = window.location?.hash || ''
  const routePath = route.path || ''
  return routePath === '/sign-in/factor-two' ||
         routePath.includes('factor-two') ||
         currentPath.includes('factor-two') ||
         currentHash.includes('factor-two')
})

// Track when 2FA code was sent to prevent re-sending on reload
const twoFactorCodeSentKey = 'clerk-2fa-code-sent'
const twoFactorInitiatedKey = 'clerk-2fa-initiated'
const continueWithExistingCodeKey = 'clerk-2fa-continue-existing'

// Initialize as false - will be set synchronously before render
const shouldRenderSignIn = ref(false)

// SYNCHRONOUS CHECK: If we're on factor-two with recent code but no initiated flag, never render
if (process.client && typeof window !== 'undefined') {
  const currentPath = window.location.pathname
  const currentHash = window.location.hash
  const isOnFactorTwo = currentPath.includes('factor-two') || currentHash.includes('factor-two')

  if (isOnFactorTwo) {
    const codeSentTimestamp = sessionStorage.getItem(twoFactorCodeSentKey)
    const twoFactorInitiated = sessionStorage.getItem(twoFactorInitiatedKey)
    const codeSentRecently = codeSentTimestamp && (Date.now() - parseInt(codeSentTimestamp)) < 10 * 60 * 1000

    if (codeSentRecently && !twoFactorInitiated) {
      shouldRenderSignIn.value = false
      console.log('🚫 INITIAL: Blocking SignIn render on factor-two reload')
    }
  }
}

// Determine if we should render SignIn component
// Only render when user is actually signing in, not on page reload
const checkShouldRender = () => {
  if (!process.client) {
    shouldRenderSignIn.value = true
    return
  }
  
  // Check route directly from window.location for more reliable detection
  const currentPath = window.location.pathname
  const currentHash = window.location.hash
  const isOnFactorTwo = currentPath.includes('factor-two') || currentHash.includes('factor-two')
  
  if (!isOnFactorTwo) {
    // Not on factor-two route, always render
    shouldRenderSignIn.value = true
    return
  }
  
  // We're on factor-two route - check if we should render
  const codeSentTimestamp = sessionStorage.getItem(twoFactorCodeSentKey)
  const twoFactorInitiated = sessionStorage.getItem(twoFactorInitiatedKey)
  const continueWithExisting = sessionStorage.getItem(continueWithExistingCodeKey)
  const now = Date.now()
  const codeSentRecently = codeSentTimestamp && (now - parseInt(codeSentTimestamp)) < 10 * 60 * 1000
  
  if (twoFactorInitiated) {
    // User just navigated here from sign-in (completed first factor)
    // Allow SignIn to render and send code
    shouldRenderSignIn.value = true
    console.log('✅ Allowing SignIn to render - user completed sign-in')
    // Remove initiated flag after a delay to mark that code sending is complete
    setTimeout(() => {
      sessionStorage.removeItem(twoFactorInitiatedKey)
      // Mark that code was sent
      sessionStorage.setItem(twoFactorCodeSentKey, now.toString())
    }, 3000)
  } else if (codeSentRecently && !continueWithExisting) {
    // Code was sent recently and this is a reload (not continuing with existing)
    // DON'T render SignIn to prevent automatic code sending
    shouldRenderSignIn.value = false
    console.log('🚫 Preventing SignIn render - code already sent, this is a reload')
  } else if (continueWithExisting) {
    // User clicked continue - render but with fetch interception active
    shouldRenderSignIn.value = true
    console.log('✅ Allowing SignIn to render - user clicked continue')
    // Clear the continue flag after a short delay
    setTimeout(() => {
      sessionStorage.removeItem(continueWithExistingCodeKey)
    }, 1000)
  } else {
    // Code expired or no code sent yet, allow resend
    // But only if we have a code sent timestamp (meaning user was here before)
    // If no timestamp, this might be direct access - don't allow
    if (codeSentTimestamp) {
      // Code expired, allow resend
      sessionStorage.setItem(twoFactorInitiatedKey, 'true')
      shouldRenderSignIn.value = true
      console.log('✅ Allowing SignIn to render - code expired, allowing resend')
      setTimeout(() => {
        sessionStorage.removeItem(twoFactorInitiatedKey)
        sessionStorage.setItem(twoFactorCodeSentKey, Date.now().toString())
      }, 3000)
    } else {
      // No code sent timestamp - this is likely direct access to factor-two
      // Don't render SignIn - redirect or show message
      shouldRenderSignIn.value = false
      console.log('🚫 Preventing SignIn render - no code sent timestamp, likely direct access')
    }
  }
}

// Run check synchronously before component renders
if (process.client) {
  // IMMEDIATE CHECK: Prevent rendering on reload scenarios
  const currentPath = window.location.pathname
  const currentHash = window.location.hash
  const isOnFactorTwo = currentPath.includes('factor-two') || currentHash.includes('factor-two')

  if (isOnFactorTwo) {
    const codeSentTimestamp = sessionStorage.getItem(twoFactorCodeSentKey)
    const twoFactorInitiated = sessionStorage.getItem(twoFactorInitiatedKey)
    const codeSentRecently = codeSentTimestamp && (Date.now() - parseInt(codeSentTimestamp)) < 10 * 60 * 1000

    if (codeSentRecently && !twoFactorInitiated) {
      // Definitely a reload - don't render Clerk component
      shouldRenderSignIn.value = false
    }
  }

  // Also run the full check
  checkShouldRender()
}

// Function to allow code entry (when user clicks button)
const allowCodeEntry = () => {
  // Mark that user wants to continue with existing code
  // This will render SignIn but fetch interception will block code sending
  sessionStorage.setItem(continueWithExistingCodeKey, 'true')
  shouldRenderSignIn.value = true
  // The stable key from signInKey computed will prevent Clerk from re-initializing
  // Fetch interception will block any code sending requests
}

// Compute the sign-in key
const signInKey = computed(() => {
  if (!process.client) return 'sign-in-default'
  
  if (!isFactorTwoRoute.value) {
    return 'sign-in-default'
  }
  
  const codeSentTimestamp = sessionStorage.getItem(twoFactorCodeSentKey)
  const twoFactorInitiated = sessionStorage.getItem(twoFactorInitiatedKey)
  const now = Date.now()
  const codeSentRecently = codeSentTimestamp && (now - parseInt(codeSentTimestamp)) < 10 * 60 * 1000
  
  if (twoFactorInitiated) {
    return `sign-in-2fa-${now}`
  } else if (codeSentRecently) {
    // Use stable key to prevent re-initialization
    return `sign-in-2fa-existing-${codeSentTimestamp}`
  } else {
    return `sign-in-2fa-${now}`
  }
})

// Initialize on mount
if (process.client) {
  onMounted(() => {
    // IMMEDIATE CHECK: Prevent Clerk from mounting if this is a reload on factor-two
    const currentPath = window.location.pathname
    const currentHash = window.location.hash
    const isOnFactorTwo = currentPath.includes('factor-two') || currentHash.includes('factor-two')

        if (isOnFactorTwo) {
          const codeSentTimestamp = sessionStorage.getItem(twoFactorCodeSentKey)
          const twoFactorInitiated = sessionStorage.getItem(twoFactorInitiatedKey)
          const codeSentRecently = codeSentTimestamp && (Date.now() - parseInt(codeSentTimestamp)) < 10 * 60 * 1000

          // If code was sent recently and no initiated flag, this is DEFINITELY a reload - prevent rendering
          if (codeSentRecently && !twoFactorInitiated) {
            console.log('🚫 IMMEDIATE: Preventing Clerk SignIn render on reload - code already sent', {
              codeSentTimestamp,
              twoFactorInitiated,
              isOnFactorTwo
            })
            shouldRenderSignIn.value = false
            return // Don't run any other checks
          }
        }
        
        // Check if we should render SignIn on mount (in case it wasn't set synchronously)
        checkShouldRender()
    
    // Watch for route changes
    watch(() => route.path, () => {
      checkShouldRender()
    })
    
    // NOTE: Fetch interception is handled by the plugin (track-2fa-navigation.client.ts)
    // We don't need to intercept here to avoid conflicts
    
    const hideBadge = () => {
      const clerkWrapper = document.querySelector('.clerk-wrapper')
      if (!clerkWrapper) return
      
      // Target the specific badge element
      const badge = clerkWrapper.querySelector('.cl-lastAuthenticationStrategyBadge')
      if (badge instanceof HTMLElement) {
        badge.style.display = 'none'
        badge.style.visibility = 'hidden'
      }
      
      // Also target by data attribute as fallback
      const badgeByAttr = clerkWrapper.querySelector('[data-localization-key="lastAuthenticationStrategy"]')
      if (badgeByAttr instanceof HTMLElement) {
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
        // Fetch interception is handled by plugin, no cleanup needed here
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
  padding: 0.4375rem 0.75rem !important;
  font-size: 0.8125rem !important;
  height: 2.125rem !important;
  transition: border-color 150ms ease, box-shadow 150ms ease !important;
}

.clerk-wrapper :deep(.cl-formFieldInput:not(.cl-otpCodeFieldInput):hover) {
  border-color: var(--border-subtle) !important;
  border-width: 2px !important;
}

.clerk-wrapper :deep(.cl-formFieldInput:not(.cl-otpCodeFieldInput):focus) {
  border-color: var(--accent) !important;
  border-width: 2px !important;
  box-shadow: 0 0 0 3px var(--accent-subtle) !important;
}

.clerk-wrapper :deep(.cl-formFieldInput[data-invalid="true"]) {
  border-color: oklch(0.60 0.18 25) !important;
  border-width: 2px !important;
}

.clerk-wrapper :deep(.cl-formFieldInput[data-invalid="true"]:hover) {
  border-color: oklch(0.65 0.18 25) !important;
  border-width: 2px !important;
}

.clerk-wrapper :deep(.cl-formFieldInput[data-invalid="true"]:focus) {
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

/* OTP Container - Must allow pointer events for the hidden input overlay */
.clerk-wrapper :deep([data-input-otp-container="true"]) {
  position: relative !important;
  pointer-events: auto !important;
  cursor: text !important;
}

/* Position the hidden input overlay to cover the entire OTP container area */
.clerk-wrapper :deep(input[data-input-otp="true"]) {
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  width: 100% !important;
  height: 100% !important;
  opacity: 1 !important;
  pointer-events: all !important;
  cursor: text !important;
  /* Override Clerk's inline styles */
  background: transparent !important;
  border: none !important;
  color: transparent !important;
  caret-color: var(--accent) !important;
  z-index: 10 !important;
  font-size: 20px !important;
  letter-spacing: 0.75rem !important;
  text-align: center !important;
  text-indent: 0 !important;
}

/* Apple-style OTP Code Input - Clean and minimal design */
.clerk-wrapper :deep(.cl-otpCodeFieldInputContainer) {
  pointer-events: auto !important;
  width: 100% !important;
  display: flex !important;
  justify-content: center !important;
  align-items: center !important;
  margin: 1rem 0 !important;
}

/* OTP Code Field Inputs container - Apple spacing */
.clerk-wrapper :deep(.cl-otpCodeFieldInputs) {
  pointer-events: none !important;
  display: flex !important;
  flex-direction: row !important;
  gap: 0.75rem !important;
  justify-content: center !important;
  align-items: center !important;
  flex-wrap: nowrap !important;
  margin: 0 !important;
  padding: 0 !important;
  position: relative !important;
}

/* Apple-style individual OTP boxes */
.clerk-wrapper :deep(.cl-otpCodeFieldInput),
.clerk-wrapper :deep(.cl-input.cl-otpCodeFieldInput) {
  /* Clean Apple-like appearance */
  background: var(--background) !important;
  border: 1px solid #d1d5db !important;
  border-radius: 8px !important;
  color: var(--foreground) !important;
  pointer-events: none !important;

  /* Perfect square dimensions like Apple */
  width: 44px !important;
  height: 44px !important;
  min-width: 44px !important;
  min-height: 44px !important;
  max-width: 44px !important;
  max-height: 44px !important;

  /* Centered content */
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;

  /* Smooth transitions */
  transition: all 200ms ease !important;

  /* Reset Clerk styles */
  padding: 0 !important;
  margin: 0 !important;
  box-sizing: border-box !important;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif !important;
  font-weight: 400 !important;
  font-size: 20px !important;
  line-height: 1 !important;
  text-align: center !important;

  /* Subtle shadow like Apple */
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05) !important;
}

/* Style the inner content */
.clerk-wrapper :deep(.cl-otpCodeFieldInput > div) {
  font-size: 20px !important;
  font-weight: 400 !important;
  color: var(--foreground) !important;
  line-height: 1 !important;
  text-align: center !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 100% !important;
  height: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
}

/* Verification code input fields (OTP) - Fallback for other OTP implementations */
.clerk-wrapper :deep(input[type="text"][inputmode="numeric"]:not([data-input-otp])),
.clerk-wrapper :deep(input[type="tel"]:not([data-input-otp])),
.clerk-wrapper :deep(input[type="text"][autocomplete="one-time-code"]:not([data-input-otp])),
.clerk-wrapper :deep(.cl-otpCodeInput:not([data-input-otp])),
.clerk-wrapper :deep(.cl-codeInput:not([data-input-otp])) {
  background: var(--surface) !important;
  border: 2px solid var(--border) !important;
  border-radius: var(--radius-md) !important;
  padding: 0.4375rem 0.75rem !important;
  font-size: 0.8125rem !important;
  height: 2.125rem !important;
  width: 2.5rem !important;
  min-width: 2.5rem !important;
  max-width: 2.5rem !important;
  text-align: center !important;
  color: var(--foreground) !important;
  transition: border-color 150ms ease, box-shadow 150ms ease !important;
  box-sizing: border-box !important;
  display: inline-block !important;
  margin: 0 0.25rem !important;
  font-weight: normal !important;
  pointer-events: auto !important;
  cursor: text !important;
  opacity: 1 !important;
  user-select: auto !important;
  -webkit-user-select: auto !important;
  -moz-user-select: auto !important;
  -ms-user-select: auto !important;
}

/* Apple-style focus state */
.clerk-wrapper :deep([data-input-otp-container="true"]:focus-within .cl-otpCodeFieldInput) {
  border-color: var(--accent) !important;
  border-width: 2px !important;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1) !important;
  transform: scale(1.02) !important;
}

/* Subtle hover state */
.clerk-wrapper :deep([data-input-otp-container="true"]:hover:not(:focus-within) .cl-otpCodeFieldInput) {
  border-color: #9ca3af !important;
  box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.1) !important;
}

/* Fallback OTP inputs hover/focus */
.clerk-wrapper :deep(input[type="text"][inputmode="numeric"]:not([data-input-otp]):hover),
.clerk-wrapper :deep(input[type="tel"]:not([data-input-otp]):hover),
.clerk-wrapper :deep(input[type="text"][autocomplete="one-time-code"]:not([data-input-otp]):hover) {
  border-color: var(--border-subtle) !important;
  border-width: 2px !important;
}

.clerk-wrapper :deep(input[type="text"][inputmode="numeric"]:not([data-input-otp]):focus),
.clerk-wrapper :deep(input[type="tel"]:not([data-input-otp]):focus),
.clerk-wrapper :deep(input[type="text"][autocomplete="one-time-code"]:not([data-input-otp]):focus) {
  border-color: var(--accent) !important;
  border-width: 2px !important;
  box-shadow: 0 0 0 3px var(--accent-subtle) !important;
  outline: none !important;
}

/* OTP Code Field container */
.clerk-wrapper :deep(.cl-otpCodeField) {
  pointer-events: auto !important;
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

/* Code Entry Message */
.code-entry-message {
  padding: var(--spacing-6);
  text-align: center;
}

.message-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  align-items: center;
}

.message-title {
  font-size: 1.125rem;
  font-weight: var(--font-weight-semibold);
  color: var(--foreground);
  margin-bottom: var(--spacing-1);
}

.message-text {
  font-size: var(--font-size-4);
  color: var(--foreground-muted);
  line-height: 1.5;
  max-width: 320px;
}

.continue-button {
  background: oklch(0.70 0.22 150);
  color: oklch(0.13 0 0);
  padding: 0.625rem 1.25rem;
  font-size: 0.875rem;
  font-weight: var(--font-weight-semibold);
  border-radius: var(--radius-md);
  border: none;
  cursor: pointer;
  transition: all 150ms ease;
  margin-top: var(--spacing-2);
}

.continue-button:hover {
  background: oklch(0.65 0.20 150);
  transform: translateY(-2px);
  box-shadow: 0 8px 20px -4px oklch(0.70 0.22 150 / 0.4);
}

.continue-button:active {
  transform: translateY(0);
}
</style>

