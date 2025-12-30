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
        <div class="clerk-wrapper">
          <SignUp 
            :routing="'path'"
            :path="'/sign-up'"
            :sign-in-url="'/sign-in'"
            :appearance="clerkAppearance"
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

definePageMeta({
  middleware: []
})

const clerkAppearance = {
  localization: esES
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
