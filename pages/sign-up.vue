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
          <h1 class="auth-title">Crea tu cuenta</h1>
          <p class="auth-subtitle">Únete a la comunidad de tenistas de Ecuador</p>
        </div>

        <!-- Clerk Sign Up Component -->
        <div class="clerk-wrapper" :class="{ 'from-invitation': !!invitationEmail }">
          <SignUp 
            :key="signUpKey"
            :routing="'path'"
            :path="'/sign-up'"
            :sign-in-url="'/sign-in'"
            :appearance="clerkAppearance"
            :initial-values="initialValues"
            :fallback-redirect-url="redirectPath || '/'"
            :force-redirect-url="redirectPath || undefined"
            @after-sign-up="handleAfterSignUp"
          />
        </div>
      </div>

      <!-- Footer -->
      <p class="auth-footer animate-fade-up animate-delay-2">
        ¿Ya tienes cuenta? 
        <NuxtLink to="/sign-in" class="auth-link">Inicia sesión</NuxtLink>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { esES } from '@clerk/localizations'
import { onMounted, onUnmounted, computed, watch, ref } from 'vue'

definePageMeta({
  middleware: []
})

const route = useRoute()
const router = useRouter()

// Check if coming from invitation - use computed to make it reactive
const emailFromQuery = computed(() => route.query.email as string | undefined)
const invitationToken = computed(() => route.query.invitation_token as string | undefined)
const redirectPath = computed(() => route.query.redirect as string | undefined)

const clerkAppearance = {
  localization: esES
}

// Get invitation email - ONLY use it if we have BOTH email and token (coming from invitation)
// This prevents using cached email when user navigates to sign-up directly
const invitationEmail = computed(() => {
  // Only use email if we have both email and invitation_token in query
  // This ensures we're actually coming from an invitation
  if (emailFromQuery.value && invitationToken.value) {
    return emailFromQuery.value
  }
  
  // Fallback: Check sessionStorage ONLY if we have invitation_token
  // This handles cases where query params might be lost during navigation
  if (invitationToken.value && process.client) {
    try {
      const storedToken = sessionStorage.getItem('__invitation_token')
      const storedEmail = sessionStorage.getItem('__invitation_email')
      // Only use stored email if token matches (security check)
      if (storedToken === invitationToken.value && storedEmail) {
        return storedEmail
      }
    } catch {
      return undefined
    }
  }
  
  // If no invitation token, clear any stored email
  if (process.client && !invitationToken.value) {
    try {
      sessionStorage.removeItem('__invitation_email')
      sessionStorage.removeItem('__invitation_token')
    } catch {
      // Ignore errors
    }
  }
  
  return undefined
})

// Pre-fill email if coming from invitation
// Use the invitation email consistently
const initialValues = computed(() => {
  if (invitationEmail.value) {
    return { 
      emailAddress: invitationEmail.value
    }
  }
  return undefined
})

// Create a key for the SignUp component to force re-render when email changes
const signUpKey = computed(() => {
  if (invitationEmail.value) {
    return `signup-invitation-${invitationEmail.value}`
  }
  return 'signup-default'
})

// Mark that verification will be needed when user signs up
// This prevents auto-sending code on page reload in verify-email-address page
if (process.client) {
  onMounted(() => {
    // Watch for navigation to verify-email-address to mark that code should be sent
    router.beforeEach((to, from) => {
      if (to.path === '/sign-up/verify-email-address' && from.path === '/sign-up') {
        // User is navigating from sign-up to verification - mark that code should be sent
        sessionStorage.setItem('clerk-verification-initiated', 'true')
        sessionStorage.setItem('clerk-verification-code-sent', Date.now().toString())
      }
    })

    // Watch for invitation email and ensure it's set in the email field
    if (invitationEmail.value) {
      const targetEmail = invitationEmail.value
      
      // Function to find and set email in any email input field
      const ensureEmailIsSet = () => {
        const emailInputs = document.querySelectorAll(
          '.clerk-wrapper input[type="email"]'
        )
        
        emailInputs.forEach((input: any) => {
          // Skip OTP/code inputs
          if (input.getAttribute('autocomplete') === 'one-time-code' ||
              input.closest('[class*="otp"]') ||
              input.closest('[class*="code"]') ||
              input.closest('[class*="verification"]')) {
            return
          }
          
          // If the email doesn't match, set it
          if (input.value !== targetEmail) {
            input.value = targetEmail
            input.setAttribute('value', targetEmail)
            
            // Trigger events so Clerk picks up the change
            input.dispatchEvent(new Event('input', { bubbles: true }))
            input.dispatchEvent(new Event('change', { bubbles: true }))
            
            // Disable the field
            input.setAttribute('readonly', 'readonly')
            input.style.pointerEvents = 'none'
            input.style.cursor = 'not-allowed'
            input.style.opacity = '0.7'
          }
        })
      }
      
      // Set up a MutationObserver to watch for DOM changes
      const observer = new MutationObserver(() => {
        ensureEmailIsSet()
      })
      
      // Start observing when the wrapper is available
      const startObserving = () => {
        const wrapper = document.querySelector('.clerk-wrapper')
        if (wrapper) {
          observer.observe(wrapper, {
            childList: true,
            subtree: true,
            attributes: true
          })
          
          // Also watch for input value changes
          const inputs = wrapper.querySelectorAll('input[type="email"]')
          inputs.forEach((input: any) => {
            observer.observe(input, {
              attributes: true,
              attributeFilter: ['value']
            })
          })
        }
      }
      
      // Try immediately and after a delay
      ensureEmailIsSet()
      startObserving()
      
      setTimeout(() => {
        ensureEmailIsSet()
        startObserving()
      }, 100)
      
      setTimeout(() => {
        ensureEmailIsSet()
        startObserving()
      }, 500)
      
      setTimeout(() => {
        ensureEmailIsSet()
        startObserving()
      }, 1000)
      
      // Clean up on unmount
      onUnmounted(() => {
        observer.disconnect()
      })
    }
  })
}

// Handle after sign-up event
const handleAfterSignUp = () => {
  // Clear the invitation email from sessionStorage after successful sign-up
  if (process.client) {
    try {
      sessionStorage.removeItem('__invitation_email')
    } catch (e) {
      // Ignore errors
    }
  }
}

// Watch for successful sign-up to redirect back to invitation
watch([invitationToken, redirectPath], ([token, redirect]) => {
  if (token && redirect) {
    const { isAuthenticated } = useAuthState()
    watch(isAuthenticated, (authenticated) => {
      if (authenticated && redirect) {
        setTimeout(() => {
          router.push(redirect as string)
        }, 1000)
      }
    })
  }
}, { immediate: true })
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
  margin-bottom: 0.375rem !important;
}

/* Name fields container - ensure proper spacing between firstName and lastName */
.clerk-wrapper :deep(.cl-formFieldRow__name) {
  display: flex !important;
  flex-direction: column !important;
  gap: 1.25rem !important;
}

.clerk-wrapper :deep(.cl-formFieldLabel) {
  margin-bottom: 0.125rem !important;
  font-size: 0.75rem !important;
}

/* Hide the "Opcional" label - we'll use visual indicators instead */
.clerk-wrapper :deep(.cl-formFieldLabel__optional),
.clerk-wrapper :deep([class*="optional"]),
.clerk-wrapper :deep(.cl-formFieldLabelRow span),
.clerk-wrapper :deep(.cl-formFieldLabelRow [class*="optional"]),
.clerk-wrapper :deep(.cl-formFieldLabelRow > *:last-child:not(.cl-formFieldLabel)) {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  width: 0 !important;
  height: 0 !important;
  overflow: hidden !important;
}

/* Visual indicator for optional fields - subtle dashed border */
.clerk-wrapper :deep(.cl-formFieldRow__firstName .cl-formFieldInput),
.clerk-wrapper :deep(.cl-formFieldRow__lastName .cl-formFieldInput) {
  border-style: dashed !important;
  border-color: var(--border-subtle) !important;
}

.clerk-wrapper :deep(.cl-formFieldRow__firstName .cl-formFieldInput:hover),
.clerk-wrapper :deep(.cl-formFieldRow__lastName .cl-formFieldInput:hover) {
  border-style: solid !important;
  border-color: var(--border) !important;
}

.clerk-wrapper :deep(.cl-formFieldRow__firstName .cl-formFieldInput:focus),
.clerk-wrapper :deep(.cl-formFieldRow__lastName .cl-formFieldInput:focus) {
  border-style: solid !important;
  border-color: var(--accent) !important;
}

/* Disable email field when coming from invitation - be very specific to avoid affecting OTP code inputs */
.clerk-wrapper.from-invitation :deep(input[type="email"]),
.clerk-wrapper.from-invitation :deep(input[name*="emailAddress"]),
.clerk-wrapper.from-invitation :deep(input[name*="email_address"]),
.clerk-wrapper.from-invitation :deep(input[id*="emailAddress"]),
.clerk-wrapper.from-invitation :deep(input[id*="email_address"]),
.clerk-wrapper.from-invitation :deep(.cl-formFieldRow__emailAddress input[type="email"]),
.clerk-wrapper.from-invitation :deep(.cl-formFieldRow__emailAddress input[name*="email"]),
.clerk-wrapper.from-invitation :deep(.cl-formFieldRow__email input[type="email"]),
.clerk-wrapper.from-invitation :deep(.cl-formFieldRow__email input[name*="email"]) {
  background-color: var(--surface-elevated) !important;
  cursor: not-allowed !important;
  opacity: 0.7 !important;
  pointer-events: none !important;
  user-select: none !important;
  readonly: true !important;
}

.clerk-wrapper.from-invitation :deep(input[type="email"]:hover),
.clerk-wrapper.from-invitation :deep(input[name*="emailAddress"]:hover),
.clerk-wrapper.from-invitation :deep(input[name*="email_address"]:hover),
.clerk-wrapper.from-invitation :deep(input[id*="emailAddress"]:hover),
.clerk-wrapper.from-invitation :deep(input[id*="email_address"]:hover),
.clerk-wrapper.from-invitation :deep(.cl-formFieldRow__emailAddress input[type="email"]:hover),
.clerk-wrapper.from-invitation :deep(.cl-formFieldRow__emailAddress input[name*="email"]:hover),
.clerk-wrapper.from-invitation :deep(.cl-formFieldRow__email input[type="email"]:hover),
.clerk-wrapper.from-invitation :deep(.cl-formFieldRow__email input[name*="email"]:hover) {
  border-color: var(--border) !important;
  background-color: var(--surface-elevated) !important;
}

.clerk-wrapper.from-invitation :deep(input[type="email"]:focus),
.clerk-wrapper.from-invitation :deep(input[name*="emailAddress"]:focus),
.clerk-wrapper.from-invitation :deep(input[name*="email_address"]:focus),
.clerk-wrapper.from-invitation :deep(input[id*="emailAddress"]:focus),
.clerk-wrapper.from-invitation :deep(input[id*="email_address"]:focus),
.clerk-wrapper.from-invitation :deep(.cl-formFieldRow__emailAddress input[type="email"]:focus),
.clerk-wrapper.from-invitation :deep(.cl-formFieldRow__emailAddress input[name*="email"]:focus),
.clerk-wrapper.from-invitation :deep(.cl-formFieldRow__email input[type="email"]:focus),
.clerk-wrapper.from-invitation :deep(.cl-formFieldRow__email input[name*="email"]:focus) {
  border-color: var(--border) !important;
  box-shadow: none !important;
  outline: none !important;
  background-color: var(--surface-elevated) !important;
}

/* Ensure OTP code inputs are NOT affected by invitation styles */
.clerk-wrapper.from-invitation :deep(input[type="text"][inputmode="numeric"]),
.clerk-wrapper.from-invitation :deep(input[type="tel"]),
.clerk-wrapper.from-invitation :deep(input[type="text"][autocomplete="one-time-code"]),
.clerk-wrapper.from-invitation :deep(.cl-otpCodeInput),
.clerk-wrapper.from-invitation :deep(.cl-codeInput),
.clerk-wrapper.from-invitation :deep([class*="otp"] input),
.clerk-wrapper.from-invitation :deep([class*="code"] input),
.clerk-wrapper.from-invitation :deep([class*="verification"] input) {
  pointer-events: auto !important;
  cursor: text !important;
  opacity: 1 !important;
  user-select: auto !important;
  background-color: var(--surface) !important;
}

.clerk-wrapper :deep(.cl-formFieldLabelRow) {
  margin-bottom: 0.125rem !important;
}

/* Hide "Opcional" text in label rows - target any element after the label */
.clerk-wrapper :deep(.cl-formFieldLabelRow > *:not(.cl-formFieldLabel)),
.clerk-wrapper :deep(.cl-formFieldLabelRow span:not(.cl-formFieldLabel)),
.clerk-wrapper :deep(.cl-formFieldLabelRow .cl-formFieldLabel + *) {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  font-size: 0 !important;
  width: 0 !important;
  height: 0 !important;
  overflow: hidden !important;
  margin: 0 !important;
  padding: 0 !important;
}

.clerk-wrapper :deep(.cl-formFieldInput) {
  background: var(--surface) !important;
  border: 2px solid var(--border) !important;
  padding: 0.4375rem 0.75rem !important;
  font-size: 0.8125rem !important;
  height: 2.125rem !important;
}

/* Verification code input fields (OTP) - Use same style as regular text fields */
.clerk-wrapper :deep(input[type="text"][inputmode="numeric"]),
.clerk-wrapper :deep(input[type="tel"]),
.clerk-wrapper :deep(input[type="text"][autocomplete="one-time-code"]),
.clerk-wrapper :deep(.cl-otpCodeInput),
.clerk-wrapper :deep(.cl-codeInput),
.clerk-wrapper :deep([class*="otp"] input),
.clerk-wrapper :deep([class*="code"] input),
.clerk-wrapper :deep([class*="verification"] input),
.clerk-wrapper :deep([class*="codeInput"]),
.clerk-wrapper :deep([class*="otpField"]),
.clerk-wrapper :deep([class*="otpField"] input),
.clerk-wrapper :deep([class*="codeField"]),
.clerk-wrapper :deep([class*="codeField"] input),
.clerk-wrapper :deep(div[class*="otp"] input),
.clerk-wrapper :deep(div[class*="code"] input) {
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
}

.clerk-wrapper :deep(input[type="text"][inputmode="numeric"]:hover),
.clerk-wrapper :deep(input[type="tel"]:hover),
.clerk-wrapper :deep(input[type="text"][autocomplete="one-time-code"]:hover),
.clerk-wrapper :deep(.cl-otpCodeInput:hover),
.clerk-wrapper :deep(.cl-codeInput:hover),
.clerk-wrapper :deep([class*="otp"] input:hover),
.clerk-wrapper :deep([class*="code"] input:hover),
.clerk-wrapper :deep([class*="verification"] input:hover),
.clerk-wrapper :deep([class*="codeInput"]:hover),
.clerk-wrapper :deep([class*="otpField"]:hover),
.clerk-wrapper :deep([class*="otpField"] input:hover),
.clerk-wrapper :deep([class*="codeField"]:hover),
.clerk-wrapper :deep([class*="codeField"] input:hover),
.clerk-wrapper :deep(div[class*="otp"] input:hover),
.clerk-wrapper :deep(div[class*="code"] input:hover) {
  border-color: var(--border-subtle) !important;
  border-width: 2px !important;
}

.clerk-wrapper :deep(input[type="text"][inputmode="numeric"]:focus),
.clerk-wrapper :deep(input[type="tel"]:focus),
.clerk-wrapper :deep(input[type="text"][autocomplete="one-time-code"]:focus),
.clerk-wrapper :deep(.cl-otpCodeInput:focus),
.clerk-wrapper :deep(.cl-codeInput:focus),
.clerk-wrapper :deep([class*="otp"] input:focus),
.clerk-wrapper :deep([class*="code"] input:focus),
.clerk-wrapper :deep([class*="verification"] input:focus),
.clerk-wrapper :deep([class*="codeInput"]:focus),
.clerk-wrapper :deep([class*="otpField"]:focus),
.clerk-wrapper :deep([class*="otpField"] input:focus),
.clerk-wrapper :deep([class*="codeField"]:focus),
.clerk-wrapper :deep([class*="codeField"] input:focus),
.clerk-wrapper :deep(div[class*="otp"] input:focus),
.clerk-wrapper :deep(div[class*="code"] input:focus) {
  border-color: var(--accent) !important;
  border-width: 2px !important;
  box-shadow: 0 0 0 3px var(--accent-subtle) !important;
  outline: none !important;
}

/* Ensure OTP container has proper spacing */
.clerk-wrapper :deep([class*="otp"]),
.clerk-wrapper :deep([class*="code"]),
.clerk-wrapper :deep([class*="verification"]) {
  display: flex !important;
  gap: 0.5rem !important;
  justify-content: center !important;
  align-items: center !important;
}

.clerk-wrapper :deep(.cl-formFieldInput:hover) {
  border-color: var(--border-subtle) !important;
  border-width: 2px !important;
}

.clerk-wrapper :deep(.cl-formFieldInput:focus) {
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

/* First and Last name fields - compact */
.clerk-wrapper :deep(.cl-formFieldRow__firstName) {
  margin-bottom: 0 !important;
}

/* Add spacing between first name and last name fields */
.clerk-wrapper :deep(.cl-formFieldRow__lastName) {
  margin-top: 0 !important;
  margin-bottom: 0.375rem !important;
}

/* Reduce gap between label and input */
.clerk-wrapper :deep(.cl-formFieldInputGroup) {
  margin-top: 0 !important;
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

/* Fix form field labels for first/last name */
.clerk-wrapper :deep(.cl-formFieldLabel) {
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  gap: 0.375rem !important;
  white-space: nowrap !important;
}

.clerk-wrapper :deep(.cl-formFieldLabelRow) {
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
  margin-bottom: 0.375rem !important;
}

.clerk-wrapper :deep(.cl-formFieldRow__firstName) {
  display: block !important;
  width: 100% !important;
}

.clerk-wrapper :deep(.cl-formFieldRow__lastName) {
  display: block !important;
  width: 100% !important;
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

/* Override any orange/red colors in Clerk components */
.clerk-wrapper :deep(a) {
  color: var(--foreground-subtle) !important;
}

.clerk-wrapper :deep(a:hover) {
  color: var(--foreground-muted) !important;
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
