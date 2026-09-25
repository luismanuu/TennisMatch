// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import fc from 'fast-check'
import { ref } from 'vue'
import { safeRedirect, verificationCallback, invitationPath, VERIFY_EMAIL_PAGE } from '../../utils/auth-redirects'
import { withPending } from '../../utils/with-pending'
import { sendInvitationEmail } from '../../server/utils/invitations'

describe('Bugbot regressions (PR #14)', () => {
  it('4104912803: an invitation sign-up verifies back onto its invitation, for any token', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (token) => {
        const cb = verificationCallback(token)
        return cb === invitationPath(token) && cb.startsWith('/invitation/') && safeRedirect(cb) === cb
      }),
      { seed: 20260925, numRuns: 500 },
    )
    expect(verificationCallback('9f2c0b')).toBe('/invitation/9f2c0b')
    expect(verificationCallback(undefined)).toBe(`${VERIFY_EMAIL_PAGE}?verified=1`)
  })

  it('4104912842: pending always resets, whether the task resolves or throws', async () => {
    await fc.assert(
      fc.asyncProperty(fc.boolean(), fc.anything(), async (fails, value) => {
        const pending = ref(false)
        const task = async () => {
          if (fails) throw new TypeError('Failed to fetch')
          return value
        }
        const outcome = await withPending(pending, task).then(
          (v) => ({ ok: true as const, v }),
          (e) => ({ ok: false as const, e }),
        )
        return pending.value === false && outcome.ok === !fails
      }),
      { seed: 20260925, numRuns: 200 },
    )
  })

  describe('4104912819: a failing email provider does not fail the invitation', () => {
    const env = { ...process.env }
    beforeAll(() => {
      process.env.RESEND_API_KEY = 're_test'
      process.env.EMAIL_FROM = 'Tenis Ecuador <hola@tenis.ec>'
    })
    afterEach(() => vi.unstubAllGlobals())
    afterAll(() => {
      process.env = env
    })

    it('Resend answers 500: sendInvitationEmail resolves false', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })))
      await expect(sendInvitationEmail({ to: 'ana@tenis.ec', name: 'Ana', url: 'https://x/invitation/t' })).resolves.toBe(false)
    })

    it('network error: sendInvitationEmail resolves false', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed') }))
      await expect(sendInvitationEmail({ to: 'ana@tenis.ec', name: 'Ana', url: 'https://x/invitation/t' })).resolves.toBe(false)
    })

    it('Resend accepts: sendInvitationEmail resolves true', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })))
      await expect(sendInvitationEmail({ to: 'ana@tenis.ec', name: 'Ana', url: 'https://x/invitation/t' })).resolves.toBe(true)
    })
  })
})

describe('safeRedirect', () => {
  it('never returns anything but a same-origin path', () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.webUrl(), fc.constantFrom('//evil.ec', '/\\evil.ec', 'https://evil.ec', 'javascript:alert(1)')), (v) => {
        const r = safeRedirect(v)
        return r.startsWith('/') && !r.startsWith('//') && !r.includes('\\')
      }),
      { seed: 20260925, numRuns: 1000 },
    )
  })
})
