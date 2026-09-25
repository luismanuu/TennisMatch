<template>
  <ClientOnly>
    <div class="auth-page">
    <AuthVisual />

      <div class="auth-container">
        <!-- Logo & Branding -->
        <NuxtLink to="/" class="auth-brand"><BrandMark :size="26" /><span class="brand-name">Admin Portal</span></NuxtLink>

        <!-- Main Card -->
        <div class="auth-card">
          <div class="auth-header">
            <h1 class="auth-title">Admin Sign In</h1>
            <p class="auth-subtitle">Sign in to access the admin dashboard</p>
          </div>

          <!-- Clerk Sign In Component -->
          <div class="clerk-wrapper">
            <SignIn 
              :routing="'path'"
              :path="'/admin/sign-in'"
              :sign-up-url="'/sign-up'"
              :appearance="clerkAppearance"
              :fallback-redirect-url="'/admin'"
            />
          </div>
        </div>

        <!-- Footer -->
        <p class="auth-footer">
          <NuxtLink to="/sign-in" class="auth-link">Regular Sign In</NuxtLink>
          <span class="mx-2">•</span>
          <NuxtLink to="/" class="auth-link">Back to Home</NuxtLink>
        </p>
      </div>
    </div>
    <template #fallback>
      <div class="auth-page" style="display: flex; align-items: center; justify-content: center; min-height: 100vh;">
        <div class="auth-container">
          <div class="text-center">
            <Icon name="heroicons:arrow-path" class="w-8 h-8 text-accent animate-spin" aria-hidden="true" />
            <p class="text-size-4 font-regular text-foreground-muted mt-4">Loading...</p>
          </div>
        </div>
      </div>
    </template>
  </ClientOnly>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import { esES } from '@clerk/localizations'
import { useRouter } from 'vue-router'

definePageMeta({
  middleware: []
})

const router = useRouter()
const auth = useAuth()
const { isSignedIn } = auth
const { user } = useUser()

// Custom localization that extends esES but removes "ultimo uso" references
const customLocalization = {
  ...esES,
  // Override the lastAuthenticationStrategy key to remove "Último uso" text
  lastAuthenticationStrategy: ''
}

const clerkAppearance = {
  localization: customLocalization
}

// Track if we've already redirected to prevent multiple redirects
let hasRedirected = false

// Watch for successful sign-in and redirect to admin dashboard
watch([isSignedIn, () => user.value], ([signedIn, currentUser]) => {
  if (signedIn && currentUser && !hasRedirected) {
    // Check if user is admin
    const role = currentUser.publicMetadata?.role as string | undefined
    if (role === 'admin') {
      hasRedirected = true
      // Use replace to avoid adding to history
      router.replace('/admin')
    } else {
      hasRedirected = true
      // If not admin, redirect to home
      router.replace('/')
    }
  }
}, { immediate: true })

// Also watch for route changes in case Clerk redirects elsewhere
watch(() => router.currentRoute.value.path, (newPath) => {
  // If we're signed in as admin but not on admin page, redirect
  if (isSignedIn.value && user.value && !hasRedirected) {
    const role = user.value.publicMetadata?.role as string | undefined
    if (role === 'admin' && newPath !== '/admin' && newPath !== '/admin/sign-in' && newPath !== '/admin/debug') {
      hasRedirected = true
      router.replace('/admin')
    }
  }
}, { immediate: true })

// Check on mount if user is already signed in
onMounted(() => {
  // If already signed in and admin, redirect immediately
  if (isSignedIn.value && user.value && !hasRedirected) {
    const role = user.value.publicMetadata?.role as string | undefined
    if (role === 'admin') {
      hasRedirected = true
      router.replace('/admin')
    }
  }
})

// Hide the lastAuthenticationStrategyBadge element after Clerk loads
if (process.client) {
  onMounted(() => {
    const hideBadge = () => {
      const clerkWrapper = document.querySelector('.clerk-wrapper')
      if (!clerkWrapper) return
      
      // Target the specific badge element
      const badge = clerkWrapper.querySelector('.cl-lastAuthenticationStrategyBadge') as HTMLElement
      if (badge) {
        badge.style.display = 'none'
        badge.style.visibility = 'hidden'
      }
      
      // Also target by data attribute as fallback
      const badgeByAttr = clerkWrapper.querySelector('[data-localization-key="lastAuthenticationStrategy"]') as HTMLElement
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

.clerk-wrapper :deep(.cl-formFieldInput) {
  background: var(--surface) !important;
  border: 1px solid var(--edge) !important;
  padding: 0.4375rem 0.75rem !important;
  font-size: 0.8125rem !important;
  min-height: 2.75rem !important; height: auto !important;
  transition: border-color 150ms ease, box-shadow 150ms ease !important;
}

.clerk-wrapper :deep(.cl-formFieldInput:hover) {
  border-color: var(--border-subtle) !important;
  
}

.clerk-wrapper :deep(.cl-formFieldInput:focus) {
  border-color: var(--accent) !important;
  
  box-shadow: 0 0 0 3px var(--accent-subtle) !important;
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
</style>

