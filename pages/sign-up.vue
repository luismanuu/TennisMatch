<template>
  <div class="auth-page">
    <AuthVisual />

    <div class="auth-container">
      <!-- Logo & Branding -->
      <NuxtLink to="/" class="auth-brand"><BrandMark :size="26" /><span class="brand-name">Tenis Ecuador</span></NuxtLink>

      <!-- Main Card -->
      <div class="auth-card">
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
          />
        </div>
      </div>

      <!-- Footer -->
      <p class="auth-footer">
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

// Watch for successful authentication to cleanup invitation data
const { isAuthenticated } = useAuthState()
watch(isAuthenticated, (authenticated) => {
  if (authenticated && process.client) {
    // Clear the invitation email from sessionStorage after successful sign-up
    try {
      sessionStorage.removeItem('__invitation_email')
      sessionStorage.removeItem('__invitation_token')
    } catch (e) {
      // Ignore errors
    }
  }
}, { immediate: true })

// Watch for successful sign-up to redirect back to invitation
watch([invitationToken, redirectPath], ([token, redirect]) => {
  if (token && redirect) {
    watch(isAuthenticated, (authenticated) => {
      if (authenticated && redirect) {
        setTimeout(() => {
          router.push(redirect as string)
        }, 1000)
      }
    }, { immediate: true })
  }
}, { immediate: true })
</script>

<style scoped>

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

.clerk-wrapper :deep(.cl-formFieldInput:hover) {
  border-color: var(--border-subtle) !important;
  
  color: var(--foreground) !important;
}

.clerk-wrapper :deep(.cl-formFieldInput:focus) {
  border-color: var(--accent) !important;
  
  box-shadow: 0 0 0 3px var(--accent-subtle) !important;
  color: var(--foreground) !important;
}

.clerk-wrapper :deep(.cl-formFieldInput[data-invalid="true"]) {
  border-color: var(--danger) !important;
  
}

.clerk-wrapper :deep(.cl-formFieldInput[data-invalid="true"]:hover) {
  border-color: var(--danger) !important;
  
}

.clerk-wrapper :deep(.cl-formFieldInput[data-invalid="true"]:focus) {
  border-color: var(--danger) !important;
  
  box-shadow: 0 0 0 3px var(--danger-subtle) !important;
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
  background: var(--accent) !important;
  background-color: var(--accent) !important;
  color: var(--accent-foreground) !important;
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
  background: var(--accent-hover) !important;
  background-color: var(--accent-hover) !important;
  color: var(--accent-foreground) !important;
  
  box-shadow: 0 8px 20px -4px transparent !important;
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
</style>
