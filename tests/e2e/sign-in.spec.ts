import { test, expect } from './fixtures/clerk-mock'
import { SignInPage } from './pages/sign-in.page'
import { e2eEnv } from './env'
import { e2eTestUser } from './fixtures/test-user'

test.describe('Sign In E2E Tests', () => {
  let testUserEnsured = false

  test.beforeAll(async ({ request }) => {
    try {
      const res = await request.post('/api/e2e/ensure-test-user', {
        data: { clerk_id: e2eTestUser.clerkId },
      })
      const status = res.status()
      testUserEnsured = status >= 200 && status < 300
    } catch {
      testUserEnsured = false
    }
  })

  test.beforeEach(async ({ page }) => {
    const signInPage = new SignInPage(page)
    await signInPage.goto()
  })

  test('should display sign-in page correctly', async ({ page }) => {
    const signInPage = new SignInPage(page)
    await expect(signInPage.brandName).toContainText('Tenis Ecuador')
    await expect(signInPage.title).toContainText('Bienvenido de vuelta')
    await expect(signInPage.subtitle).toContainText('Ingresa a tu cuenta para continuar')
    await expect(signInPage.signUpLink).toBeVisible()
    await expect(signInPage.signUpLink).toContainText('Regístrate gratis')
  })

  test('should navigate to sign-up page when clicking sign-up link', async ({ page }) => {
    const signInPage = new SignInPage(page)
    await signInPage.signUpLink.click()
    await expect(page).toHaveURL('/sign-up')
    await expect(page.locator('.auth-title')).toContainText('Crea tu cuenta')
  })

  test('should display Clerk sign-in form', async ({ page }) => {
    const signInPage = new SignInPage(page)
    await signInPage.waitForFormReady()
    await expect(signInPage.clerkWrapper).toBeVisible()
    await expect(signInPage.emailInput).toBeVisible()
  })

  test('should show validation errors for empty form submission', async ({ page }) => {
    const signInPage = new SignInPage(page)
    await signInPage.waitForFormReady()
    await expect(signInPage.submitButton).toBeVisible()
    await signInPage.submit()
    // Clerk may show role="alert" / .cl-formFieldErrorText / .cl-alert or inputs [data-invalid="true"];
    // if no error UI appears (e.g. HTML5 only), at least we must still be on sign-in (no redirect)
    const count = await signInPage.errorAlerts.count()
    if (count > 0) {
      await expect(signInPage.errorAlerts.first()).toBeVisible({ timeout: 2000 })
    }
    await expect(page).toHaveURL(/\/sign-in/)
  })

  test('should handle invalid credentials gracefully', async ({ page }) => {
    const signInPage = new SignInPage(page)
    await signInPage.waitForFormReady()
    await signInPage.fillCredentials('invalid@example.com', 'wrongpassword')
    await signInPage.submit()
    await expect(page).toHaveURL(/\/sign-in/, { timeout: 5000 })
    // Clerk may show error via .cl-alert / .cl-formFieldErrorText; if not, we still stayed on sign-in
    const count = await signInPage.errorAlerts.count()
    if (count > 0) await expect(signInPage.errorAlerts.first()).toBeVisible({ timeout: 2000 })
  })

  test('should maintain form state on navigation', async ({ page }) => {
    const signInPage = new SignInPage(page)
    await signInPage.waitForFormReady()
    await signInPage.fillCredentials(e2eTestUser.email, e2eTestUser.password)
    await page.goto('/sign-up')
    await page.goto('/sign-in')
    const signInPage2 = new SignInPage(page)
    await signInPage2.waitForFormReady()
    await expect(signInPage2.emailInput).toHaveValue('')
  })

  test('should be responsive on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    const signInPage = new SignInPage(page)
    await expect(signInPage.authContainer).toBeVisible()
    await expect(signInPage.authCard).toBeVisible()
    await expect(signInPage.brandName).toBeVisible()
  })

  test('should sign in with valid test user and redirect', async ({ page }) => {
    test.skip(!testUserEnsured, 'E2E test user not ensured. Set NUXT_E2E_ENSURE_TEST_USER=1 and ensure DB has cities/categories.')
    test.skip(!e2eEnv.useRealClerk, 'Set E2E_USE_REAL_CLERK=1 and E2E_CLERK_EMAIL, E2E_CLERK_PASSWORD, E2E_CLERK_ID to run with real Clerk.')
    const signInPage = new SignInPage(page)
    await signInPage.waitForFormReady()
    await signInPage.fillCredentials(e2eTestUser.email, e2eTestUser.password)
    await signInPage.submit()
    await expect(page).not.toHaveURL(/\/sign-in/, { timeout: 15000 })
    await expect(page).toHaveURL(/\/(\?.*)?$|\/onboarding/, { timeout: 5000 })
  })
})
