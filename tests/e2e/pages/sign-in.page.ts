import type { Page, Locator } from '@playwright/test'

/**
 * Page object for the sign-in page (/sign-in).
 * Selectors aligned with Clerk component and app shell (MCP-verified).
 */
export class SignInPage {
  constructor(private readonly page: Page) {}

  get clerkWrapper(): Locator {
    return this.page.locator('.clerk-wrapper')
  }

  get emailInput(): Locator {
    return this.page.locator('#identifier-field')
  }

  get passwordInput(): Locator {
    return this.page.locator('#password-field')
  }

  get submitButton(): Locator {
    return this.page.locator('button.cl-formButtonPrimary')
  }

  get brandName(): Locator {
    return this.page.locator('.brand-name')
  }

  get title(): Locator {
    return this.page.locator('.auth-title')
  }

  get subtitle(): Locator {
    return this.page.locator('.auth-subtitle')
  }

  get signUpLink(): Locator {
    return this.page.locator('a[href="/sign-up"]')
  }

  get authContainer(): Locator {
    return this.page.locator('.auth-container')
  }

  get authCard(): Locator {
    return this.page.locator('.auth-card')
  }

  /** Clerk uses .cl-formFieldErrorText, .cl-alert; inputs use [data-invalid="true"]. */
  get errorAlerts(): Locator {
    return this.page.locator(
      '[role="alert"], [class*="error"], [class*="invalid"], .cl-formFieldErrorText, .cl-alert, [data-invalid="true"]'
    )
  }

  async goto(): Promise<void> {
    await this.page.goto('/sign-in')
  }

  async waitForFormReady(timeout = 10000): Promise<void> {
    await this.clerkWrapper.waitFor({ state: 'visible', timeout })
    await this.emailInput.waitFor({ state: 'visible', timeout: Math.min(timeout, 5000) })
  }

  async fillCredentials(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
  }

  async submit(): Promise<void> {
    await this.submitButton.click()
  }
}
