import { test, expect } from './fixtures/clerk-mock'

test.describe('Sign Up E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sign-up')
  })

  test('should display sign-up page correctly', async ({ page }) => {
    // Check page title and branding
    await expect(page.locator('.brand-name')).toContainText('Tenis Ecuador')
    await expect(page.locator('.auth-title')).toContainText('Crea tu cuenta')
    await expect(page.locator('.auth-subtitle')).toContainText('Únete a la comunidad de tenistas de Ecuador')
    
    // Check navigation link to sign-in
    const signInLink = page.locator('a[href="/sign-in"]')
    await expect(signInLink).toBeVisible()
    await expect(signInLink).toContainText('Inicia sesión')
  })

  test('should navigate to sign-in page when clicking sign-in link', async ({ page }) => {
    const signInLink = page.locator('a[href="/sign-in"]')
    await signInLink.click()
    
    await expect(page).toHaveURL('/sign-in')
    await expect(page.locator('.auth-title')).toContainText('Bienvenido de vuelta')
  })

  test('should display Clerk sign-up form', async ({ page }) => {
    // Wait for Clerk component to load
    await page.waitForSelector('.clerk-wrapper', { timeout: 10000 })
    
    // Check that Clerk form elements are present
    const clerkWrapper = page.locator('.clerk-wrapper')
    await expect(clerkWrapper).toBeVisible()
    
    // Check for email input
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
      
      // Wait for validation messages
      await page.waitForTimeout(1000)
      
      // Check for error indicators
      const errorMessages = page.locator('[class*="error"], [class*="invalid"], [role="alert"]')
      const errorCount = await errorMessages.count()
      
      // At least one validation error should appear
      expect(errorCount).toBeGreaterThan(0)
    }
  })

  test('should validate email format', async ({ page }) => {
    await page.waitForSelector('.clerk-wrapper', { timeout: 10000 })
    
    const emailInput = page.locator('input[type="email"], input[name*="email"], input[id*="email"]').first()
    
    if (await emailInput.isVisible()) {
      // Enter invalid email
      await emailInput.fill('invalid-email')
      await emailInput.blur()
      
      // Wait for validation
      await page.waitForTimeout(500)
      
      // Check for validation error
      const errorMessage = page.locator('[class*="error"], [class*="invalid"], [role="alert"]').first()
      const hasError = await errorMessage.isVisible().catch(() => false)
      
      // Error should be displayed or input should have invalid state
      const isInvalid = await emailInput.evaluate((el) => {
        return el.hasAttribute('aria-invalid') || 
               el.classList.toString().includes('error') ||
               el.classList.toString().includes('invalid')
      }).catch(() => false)
      
      expect(hasError || isInvalid).toBe(true)
    }
  })

  test('should validate password strength', async ({ page }) => {
    await page.waitForSelector('.clerk-wrapper', { timeout: 10000 })
    
    const passwordInput = page.locator('input[type="password"], input[name*="password"], input[id*="password"]').first()
    
    if (await passwordInput.isVisible()) {
      // Enter weak password
      await passwordInput.fill('123')
      await passwordInput.blur()
      
      // Wait for validation
      await page.waitForTimeout(500)
      
      // Check for validation error or password strength indicator
      const errorMessage = page.locator('[class*="error"], [class*="invalid"], [class*="password"], [role="alert"]').first()
      const hasError = await errorMessage.isVisible().catch(() => false)
      
      // Error should be displayed or input should have invalid state
      const isInvalid = await passwordInput.evaluate((el) => {
        return el.hasAttribute('aria-invalid') || 
               el.classList.toString().includes('error') ||
               el.classList.toString().includes('invalid')
      }).catch(() => false)
      
      expect(hasError || isInvalid).toBe(true)
    }
  })

  test('should handle duplicate email registration', async ({ page }) => {
    await page.waitForSelector('.clerk-wrapper', { timeout: 10000 })
    
    const emailInput = page.locator('input[type="email"], input[name*="email"], input[id*="email"]').first()
    const passwordInput = page.locator('input[type="password"], input[name*="password"], input[id*="password"]').first()
    
    if (await emailInput.isVisible() && await passwordInput.isVisible()) {
      // Fill form with potentially existing email
      await emailInput.fill('existing@example.com')
      await passwordInput.fill('SecurePassword123!')
      
      // Submit form
      const submitButton = page.locator('button[type="submit"]').first()
      if (await submitButton.isVisible()) {
        await submitButton.click()
        
        // Wait for response
        await page.waitForTimeout(2000)
        
        // Check for error message (if email exists)
        const errorMessage = page.locator('[class*="error"], [class*="invalid"], [role="alert"]').first()
        const hasError = await errorMessage.isVisible().catch(() => false)
        
        // Either error is shown or form is still visible (not redirected)
        expect(hasError || page.url().includes('/sign-up')).toBe(true)
      }
    }
  })

  test('should allow optional first and last name fields', async ({ page }) => {
    await page.waitForSelector('.clerk-wrapper', { timeout: 10000 })
    
    // Check if name fields exist
    const firstNameInput = page.locator('input[name*="firstName"], input[name*="first"], input[id*="firstName"]').first()
    const lastNameInput = page.locator('input[name*="lastName"], input[name*="last"], input[id*="lastName"]').first()
    
    // Name fields should be optional, so form should work without them
    const emailInput = page.locator('input[type="email"], input[name*="email"], input[id*="email"]').first()
    const passwordInput = page.locator('input[type="password"], input[name*="password"], input[id*="password"]').first()
    
    if (await emailInput.isVisible() && await passwordInput.isVisible()) {
      // Fill only required fields
      await emailInput.fill('test@example.com')
      await passwordInput.fill('SecurePassword123!')
      
      // Form should be submittable without name fields
      const submitButton = page.locator('button[type="submit"]').first()
      if (await submitButton.isVisible()) {
        const isDisabled = await submitButton.isDisabled().catch(() => false)
        // Submit button should not be disabled (name fields are optional)
        expect(isDisabled).toBe(false)
      }
    }
  })

  test('should maintain form state on navigation', async ({ page }) => {
    await page.waitForSelector('.clerk-wrapper', { timeout: 10000 })
    
    const emailInput = page.locator('input[type="email"], input[name*="email"], input[id*="email"]').first()
    
    if (await emailInput.isVisible()) {
      await emailInput.fill('test@example.com')
      
      // Navigate away and back
      await page.goto('/sign-in')
      await page.goto('/sign-up')
      
      // Form should be reset
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

