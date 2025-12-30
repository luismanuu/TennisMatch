/**
 * Test utilities and helpers for authentication tests
 */

export const TEST_USER = {
  email: 'test@example.com',
  password: 'SecurePassword123!',
  firstName: 'Test',
  lastName: 'User',
}

export const INVALID_CREDENTIALS = {
  email: 'invalid@example.com',
  password: 'wrongpassword',
}

export const WEAK_PASSWORD = '123'

export const INVALID_EMAIL = 'not-an-email'

/**
 * Wait for Clerk component to be fully loaded
 */
export async function waitForClerkComponent(page: any, timeout = 10000) {
  await page.waitForSelector('.clerk-wrapper', { timeout })
  // Additional wait for Clerk to initialize
  await page.waitForTimeout(500)
}

/**
 * Fill Clerk sign-in form
 */
export async function fillSignInForm(
  page: any,
  email: string,
  password: string
) {
  await waitForClerkComponent(page)
  
  const emailInput = page
    .locator('input[type="email"], input[name*="email"], input[id*="email"]')
    .first()
  const passwordInput = page
    .locator('input[type="password"], input[name*="password"], input[id*="password"]')
    .first()
  
  if (await emailInput.isVisible() && await passwordInput.isVisible()) {
    await emailInput.fill(email)
    await passwordInput.fill(password)
    return { emailInput, passwordInput }
  }
  
  return null
}

/**
 * Fill Clerk sign-up form
 */
export async function fillSignUpForm(
  page: any,
  email: string,
  password: string,
  firstName?: string,
  lastName?: string
) {
  await waitForClerkComponent(page)
  
  const emailInput = page
    .locator('input[type="email"], input[name*="email"], input[id*="email"]')
    .first()
  const passwordInput = page
    .locator('input[type="password"], input[name*="password"], input[id*="password"]')
    .first()
  
  const inputs: any = {}
  
  if (await emailInput.isVisible()) {
    await emailInput.fill(email)
    inputs.emailInput = emailInput
  }
  
  if (await passwordInput.isVisible()) {
    await passwordInput.fill(password)
    inputs.passwordInput = passwordInput
  }
  
  if (firstName) {
    const firstNameInput = page
      .locator('input[name*="firstName"], input[name*="first"], input[id*="firstName"]')
      .first()
    if (await firstNameInput.isVisible()) {
      await firstNameInput.fill(firstName)
      inputs.firstNameInput = firstNameInput
    }
  }
  
  if (lastName) {
    const lastNameInput = page
      .locator('input[name*="lastName"], input[name*="last"], input[id*="lastName"]')
      .first()
    if (await lastNameInput.isVisible()) {
      await lastNameInput.fill(lastName)
      inputs.lastNameInput = lastNameInput
    }
  }
  
  return Object.keys(inputs).length > 0 ? inputs : null
}

/**
 * Submit Clerk form
 */
export async function submitClerkForm(page: any) {
  const submitButton = page.locator('button[type="submit"]').first()
  
  if (await submitButton.isVisible()) {
    await submitButton.click()
    await page.waitForTimeout(1000) // Wait for form submission
    return true
  }
  
  return false
}

/**
 * Check for error messages in Clerk form
 */
export async function hasErrorMessages(page: any): Promise<boolean> {
  const errorMessages = page.locator(
    '[class*="error"], [class*="invalid"], [role="alert"]'
  )
  const errorCount = await errorMessages.count()
  return errorCount > 0
}

/**
 * Get first error message text
 */
export async function getFirstErrorMessage(page: any): Promise<string | null> {
  const errorMessage = page
    .locator('[class*="error"], [class*="invalid"], [role="alert"]')
    .first()
  
  if (await errorMessage.isVisible().catch(() => false)) {
    return await errorMessage.textContent()
  }
  
  return null
}

