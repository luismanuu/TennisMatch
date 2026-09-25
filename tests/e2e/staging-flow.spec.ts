import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { expect, test, type Browser, type Page } from '@playwright/test'

// End-to-end flow against a running app (usually a Vercel preview on the Neon staging branch):
// sign up, onboarding, sign in, create a match, the opponent accepts, record the result, the ranking updates,
// tournaments. Screenshots go to E2E_SHOTS_DIR. Promoting the tournament admin needs STAGING_DATABASE_URL (psql).

const SHOTS = process.env.E2E_SHOTS_DIR ?? 'test-results/e2e-shots'
const PASSWORD = 'correct-horse-battery'
const stamp = Date.now().toString(36)
const ana = { name: `Ana E2E ${stamp}`, email: `ana-${stamp}@tenis.ec` }
const beto = { name: `Beto E2E ${stamp}`, email: `beto-${stamp}@tenis.ec` }

test.describe.configure({ mode: 'serial' })
test.setTimeout(180_000)
mkdirSync(SHOTS, { recursive: true })

// Vercel previews sit behind deployment protection. One request with the automation bypass secret sets a
// bypass cookie for the preview origin only (a global header would also hit Google Fonts and fail CORS).
async function newContext(browser: Browser, baseURL: string, viewport: { width: number; height: number }) {
  const ctx = await browser.newContext({ viewport })
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  if (secret) {
    await ctx.request.get(`${baseURL}/sign-in`, {
      headers: { 'x-vercel-protection-bypass': secret, 'x-vercel-set-bypass-cookie': 'true' },
    })
  }
  return ctx
}

const shot = (page: Page, name: string) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true })

async function onboard(page: Page) {
  await page.getByRole('button', { name: /Comenzar/ }).click()
  await page.locator('input[type="tel"]').fill('0991234567')
  await page.getByRole('button', { name: /Continuar/ }).click()
  await page.locator('select#city').selectOption({ index: 1 })
  await page.getByRole('button', { name: /Continuar/ }).click()
  await page.getByRole('button', { name: /4ta Categoría/ }).click()
  await page.locator('button:has-text("Completar"), button:has-text("Finalizar")').first().click()
  await expect(page.getByText('¡Perfil completado!')).toBeVisible()
}

test('sign up, onboarding, sign in, match, result, ranking, tournaments', async ({ browser, baseURL }) => {
  const anaCtx = await newContext(browser, baseURL!, { width: 1280, height: 900 })
  const page = await anaCtx.newPage()

  // 1. Sign up (UI)
  // Typing before hydration leaves v-model empty (seen once: "Escribe tu nombre."); wait for the app first.
  await page.goto('/sign-up', { waitUntil: 'networkidle' })
  await page.getByLabel('Nombre completo').fill(ana.name)
  await page.getByLabel('Correo electrónico').fill(ana.email)
  await page.getByLabel('Contraseña').fill(PASSWORD)
  await shot(page, '01-sign-up')
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await page.waitForURL(/\/onboarding/)
  await onboard(page)
  await shot(page, '02-onboarding-done')

  // The opponent registers through the API (same flow, fewer screenshots).
  const betoCtx = await newContext(browser, baseURL!, { width: 390, height: 844 })
  const betoPage = await betoCtx.newPage()
  const signUp = await betoPage.request.post('/api/auth/sign-up/email', {
    data: { name: beto.name, email: beto.email, password: PASSWORD },
    headers: { origin: baseURL! },
  })
  expect(signUp.status()).toBe(200)
  const cats = await (await betoPage.request.get('/api/categories')).json()
  const cities = await (await betoPage.request.get('/api/cities')).json()
  const created = await betoPage.request.post('/api/players/me', {
    data: { name: beto.name, category_id: cats[3].id, city_id: cities[0].id },
  })
  expect([200, 201]).toContain(created.status())

  // 2. Sign out and sign in (UI)
  await page.goto('/user-profile')
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await page.waitForURL(/\/sign-in/)
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Correo electrónico').fill(ana.email)
  await page.getByLabel('Contraseña').fill(PASSWORD)
  await shot(page, '03-sign-in')
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'))
  await shot(page, '04-home-signed-in')

  // 3. Create a match against Beto (UI)
  await page.goto('/matches/new', { waitUntil: 'networkidle' })
  await page.locator('#opponent').fill('Beto E2E')
  await page.getByRole('button', { name: new RegExp(beto.name) }).first().click()
  const when = new Date(Date.now() + 2 * 86400_000 - 5 * 3600_000).toISOString().slice(0, 16)
  await page.locator('#scheduled_at').fill(when)
  await page.locator('#location').fill('Club E2E Guayaquil')
  await shot(page, '05-create-match')
  await page.getByRole('button', { name: 'Programar partido' }).click()
  await page.waitForURL(/\/matches\/[0-9a-f-]{36}/, { timeout: 30_000 }).catch(() => {})
  let matchUrl = page.url()
  if (!/\/matches\/[0-9a-f-]{36}/.test(matchUrl)) {
    const list = await (await page.request.get('/api/matches?page=1&limit=10')).json()
    const rows = list.matches ?? list.data ?? list
    matchUrl = `/matches/${rows[0].id}`
    await page.goto(matchUrl)
  }
  const matchPath = new URL(matchUrl, baseURL).pathname

  // 4. Beto accepts (UI, phone viewport)
  await betoPage.goto(matchPath)
  await betoPage.getByRole('button', { name: 'Aceptar Partido' }).first().click()
  await betoPage.getByRole('button', { name: 'Aceptar Partido' }).last().click()
  await expect(betoPage.getByRole('button', { name: 'Aceptar Partido' })).toHaveCount(0, { timeout: 20_000 })
  await expect(betoPage.getByText('Cargando partido')).toHaveCount(0, { timeout: 20_000 })
  await expect(betoPage.getByRole('heading', { name: 'Tu partido', level: 1 })).toBeVisible()
  await shot(betoPage, '06-opponent-accepted')

  // 5. Record the result: Ana proposes, Beto approves (UI)
  await page.goto(matchPath)
  await page.getByRole('button', { name: /Iniciar Partido|Proponer Puntuación/ }).first().waitFor()
  const start = page.getByRole('button', { name: 'Iniciar Partido' })
  if (await start.isVisible()) {
    await start.click()
    await page.getByRole('button', { name: 'Proponer Puntuación' }).waitFor({ timeout: 20_000 })
  }
  await page.getByRole('button', { name: 'Proponer Puntuación' }).click()
  await page.locator('#score').fill('6-4, 6-3')
  await page.locator('#winner').selectOption({ label: ana.name })
  await shot(page, '07-propose-score')
  await page.getByRole('button', { name: 'Proponer', exact: true }).click()
  await betoPage.goto(matchPath)
  await betoPage.getByRole('button', { name: 'Aprobar' }).first().click()
  await expect(betoPage.getByText(/Completado|Finalizado/i).first()).toBeVisible({ timeout: 30_000 })
  await page.goto(matchPath, { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { name: 'Resultado' })).toBeVisible()
  await expect(page.getByText('6–4, 6–3').or(page.getByText('6-4, 6-3')).first()).toBeVisible()
  await shot(page, '08-result-recorded')

  // 6. The ranking updates
  const me = await (await page.request.get('/api/players/me')).json()
  expect(me.elo).toBeGreaterThan(cats[3].default_elo)
  await page.goto('/leaderboard', { waitUntil: 'networkidle' })
  await expect(page.getByText(ana.name).first()).toBeVisible()
  await shot(page, '09-leaderboard')
  await page.goto('/my-ranking', { waitUntil: 'networkidle' })
  await shot(page, '10-my-ranking')

  // 7. Tournaments: Ana is promoted to admin on the staging DB, creates a tournament; Beto registers in the UI.
  test.skip(!process.env.STAGING_DATABASE_URL, 'STAGING_DATABASE_URL not set; skipping the admin part')
  execFileSync('psql', [process.env.STAGING_DATABASE_URL!, '-qc', `update "user" set role = 'admin' where email = '${ana.email}'`])
  try {
    const t = await page.request.post('/api/admin/tournaments', {
      data: {
        name: `Copa E2E ${stamp}`,
        start_date: new Date(Date.now() + 7 * 86400_000).toISOString(),
        group_size: 4,
        players_per_group_advance: 2,
        min_players: 2,
        registration_open: true,
        location: 'Guayaquil',
      },
    })
    expect(t.status()).toBe(200)
    const tournament = await t.json()
    const tournamentId = tournament.id ?? tournament.tournament?.id
    await page.goto('/tournaments', { waitUntil: 'networkidle' })
    // "Todos" merges two lists into a read-only ref and shows nothing (issue #15, predates the rebuild).
    await page.getByRole('button', { name: /Próximos/ }).click()
    await expect(page.getByText(`Copa E2E ${stamp}`).first()).toBeVisible()
    await shot(page, '11-tournaments-list')
    // Players see the "coming soon" teaser for tournaments (a product decision in the redesign), so the player
    // registers through the self-registration API and the bracket is checked from the staff side.
    await betoPage.goto(`/tournaments/${tournamentId}`, { waitUntil: 'networkidle' })
    await shot(betoPage, '12-tournament-player-view')
    const self = await betoPage.request.post(`/api/tournaments/${tournamentId}/register`, { data: {} })
    expect(self.status()).toBe(200)
    const other = await betoPage.request.post(`/api/tournaments/${tournamentId}/register`, { data: { player_id: me.id } })
    // The body's player_id is ignored: the request registers Beto himself, who is already registered
    expect(other.status(), 'a player cannot register someone else').toBe(400)
    expect(await other.text()).toContain('You are already registered for this tournament')
    const reg = await page.request.post(`/api/admin/tournaments/${tournamentId}/register`, { data: { player_id: me.id } })
    expect(reg.status()).toBe(200)
    const gen = await page.request.post(`/api/admin/tournaments/${tournamentId}/generate-brackets`, { data: {} })
    expect(gen.status()).toBe(200)
    await page.goto(`/tournaments/${tournamentId}`, { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { name: 'Fase de Grupos' })).toBeVisible()
    await expect(page.getByRole('cell', { name: beto.name })).toBeVisible()
    await shot(page, '13-tournament-groups')
    await page.goto(`/admin/tournaments/${tournamentId}`, { waitUntil: 'networkidle' })
    await shot(page, '14-admin-tournament')
  } finally {
    // Leave no admin behind on the staging DB, whatever happened above
    execFileSync('psql', [process.env.STAGING_DATABASE_URL!, '-qc', `update "user" set role = 'player' where email = '${ana.email}'`])
  }

  await anaCtx.close()
  await betoCtx.close()
})
