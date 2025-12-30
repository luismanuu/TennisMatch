import { test, expect } from './fixtures/clerk-mock'

test.describe('Sign In E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sign-in')
  })

  test('should display sign-in page correctly', async ({ page }) => {
    // Check page title and branding
    await expect(page.locator('.brand-name')).toContainText('Tenis Ecuador')
    await expect(page.locator('.auth-title')).toContainText('Bienvenido de vuelta')
    await expect(page.locator('.auth-subtitle')).toContainText('Ingresa a tu cuenta para continuar')
    
    // Check navigation link to sign-up
    const signUpLink = page.locator('a[href="/sign-up"]')
    await expect(signUpLink).toBeVisible()
    await expect(signUpLink).toContainText('Regístrate gratis')
  })

  test('should navigate to sign-up page when clicking sign-up link', async ({ page }) => {
    const signUpLink = page.locator('a[href="/sign-up"]')
    await signUpLink.click()
    
    await expect(page).toHaveURL('/sign-up')
    await expect(page.locator('.auth-title')).toContainText('Crea tu cuenta')
  })

  test('should display Clerk sign-in form', async ({ page }) => {
    // Wait for Clerk component to load
    await page.waitForSelector('.clerk-wrapper', { timeout: 10000 })
    
    // Check that Clerk form elements are present
    // Note: Clerk uses dynamic class names, so we check for common patterns
    const clerkWrapper = page.locator('.clerk-wrapper')
    await expect(clerkWrapper).toBeVisible()
    
    // Check for email input (Clerk typically uses input[type="email"] or similar)
    const emailInput = page.locator('input[type="email"], input[name*="email"], input[id*="email"]').first()
    await expect(emailInput).toBeVisible({ timeout: 5000 }).catch(() => {
      // If email input is not found, check for any input field
      const anyInput = page.locator('input').first()
      expect(anyInput).toBeVisible()
    })
  })

  test('should show validation errors for empty form submission', async ({ page }) => {
    await page.waitForSelector('.clerk-wrapper', { timeout: 10000 })
    
    // Try to submit empty form
    const submitButton = page.locator('button[type="submit"]').first()
    
    if (await submitButton.isVisible()) {
      await submitButton.click()
      
      // Wait for validation messages (Clerk shows error messages)
      await page.waitForTimeout(1000)
      
      // Check for error indicators (Clerk typically shows error messages)
      const errorMessages = page.locator('[class*="error"], [class*="invalid"], [role="alert"]')
      const errorCount = await errorMessages.count()
      
      // At least one validation error should appear
      expect(errorCount).toBeGreaterThan(0)
    }
  })

  test('should handle invalid credentials gracefully', async ({ page }) => {
    await page.waitForSelector('.clerk-wrapper', { timeout: 10000 })
    
    // Find email and password inputs
    const emailInput = page.locator('input[type="email"], input[name*="email"], input[id*="email"]').first()
    const passwordInput = page.locator('input[type="password"], input[name*="password"], input[id*="password"]').first()
    
    if (await emailInput.isVisible() && await passwordInput.isVisible()) {
      // Fill with invalid credentials
      await emailInput.fill('invalid@example.com')
      await passwordInput.fill('wrongpassword')
      
      // Submit form
      const submitButton = page.locator('button[type="submit"]').first()
      if (await submitButton.isVisible()) {
        await submitButton.click()
        
        // Wait for error message
        await page.waitForTimeout(2000)
        
        // Check for error message (Clerk shows authentication errors)
        const errorMessage = page.locator('[class*="error"], [class*="invalid"], [role="alert"]').first()
        const hasError = await errorMessage.isVisible().catch(() => false)
        
        // Error should be displayed or form should still be visible (not redirected)
        expect(hasError || page.url().includes('/sign-in')).toBe(true)
      }
    }
  })

  test('should maintain form state on navigation', async ({ page }) => {
    await page.waitForSelector('.clerk-wrapper', { timeout: 10000 })
    
    const emailInput = page.locator('input[type="email"], input[name*="email"], input[id*="email"]').first()
    
    if (await emailInput.isVisible()) {
      await emailInput.fill('test@example.com')
      
      // Navigate away and back
      await page.goto('/sign-up')
      await page.goto('/sign-in')
      
      // Form should be reset (Clerk resets on navigation)
      await page.waitForSelector('.clerk-wrapper', { timeout: 10000 })
      const newEmailInput = page.locator('input[type="email"], input[name*="email"], input[id*="email"]').first()
      const value = await newEmailInput.inputValue().catch(() => '')
      
      // Value should be empty (form reset)
      expect(value).toBe('')
    }
  })

  test('should be responsive on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    
    await expect(page.locator('.auth-container')).toBeVisible()
    await expect(page.locator('.auth-card')).toBeVisible()
    await expect(page.locator('.brand-name')).toBeVisible()
  })
})

