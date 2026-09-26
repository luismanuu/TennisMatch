// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fc from 'fast-check'
import { resetJevBreakerForTests, UNTRUSTED_NOTE, untrustedText } from '../../server/utils/jev'
import {
  flaggedCategories,
  moderateText,
  MODERATION_MAX_LENGTH,
  MODERATION_QUESTIONS,
  MODERATION_THRESHOLDS,
  type ModerationCategory,
  type ModerationKind,
} from '../../server/utils/moderation'
import { answersFor, fakeGateway, FLAGS_ON, gatewayFailure, probability, SEED, userText } from './helpers'

const kind = fc.constantFrom<ModerationKind>('name', 'chat')

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {})
})
afterEach(() => {
  resetJevBreakerForTests()
  vi.restoreAllMocks()
})

// Everything the gateway receives outside `untrusted_user_text` must be identical whatever the user typed.
function withoutUserText(body: any) {
  const clone = structuredClone(body)
  delete clone.state.untrusted_user_text
  return clone
}

describe('moderation', () => {
  it('flag off: any text, whatever the gateway would say, is allowed and the gateway is never called', async () => {
    await fc.assert(
      fc.asyncProperty(kind, userText, async (k, text) => {
        const gw = fakeGateway({ kind: 'body', body: answersFor(MODERATION_QUESTIONS, () => 1) })
        const env = { ...FLAGS_ON, JEV_MODERATION_ENABLED: undefined }
        expect((await moderateText(k, text, { env, fetchImpl: gw.fetchImpl })).verdict).toBe('allow')
        expect(gw.calls).toHaveLength(0)
      }),
      { seed: SEED, numRuns: 100 },
    )
  })

  it('any gateway failure allows the text, as today', async () => {
    await fc.assert(
      fc.asyncProperty(kind, userText, gatewayFailure, async (k, text, behaviour) => {
        resetJevBreakerForTests()
        const gw = fakeGateway(behaviour)
        const result = await moderateText(k, text, { env: FLAGS_ON, fetchImpl: gw.fetchImpl })
        expect(result).toEqual({ verdict: 'allow', checked: false })
      }),
      { seed: SEED, numRuns: 200 },
    )
  })

  it('user text only ever lands inside untrusted_user_text; questions and the rest of the request never change', async () => {
    const reference = fakeGateway({ kind: 'body', body: answersFor(MODERATION_QUESTIONS, () => 0) })
    await moderateText('chat', 'hola', { env: FLAGS_ON, fetchImpl: reference.fetchImpl })
    await moderateText('name', 'Ana', { env: FLAGS_ON, fetchImpl: reference.fetchImpl })
    const [chatRef, nameRef] = reference.calls.map((c) => withoutUserText(c.body))
    await fc.assert(
      fc.asyncProperty(kind, userText.filter((t) => t.trim() !== ''), async (k, text) => {
        const gw = fakeGateway({ kind: 'body', body: answersFor(MODERATION_QUESTIONS, () => 0) })
        await moderateText(k, text, { env: FLAGS_ON, fetchImpl: gw.fetchImpl })
        const sent = gw.calls[0].body
        expect(sent.questions).toEqual(MODERATION_QUESTIONS)
        expect(withoutUserText(sent)).toEqual(k === 'chat' ? chatRef : nameRef)
        expect(sent.state.note).toBe(UNTRUSTED_NOTE)
        const stored = Object.values(sent.state.untrusted_user_text)[0] as string
        expect(stored).toBe(untrustedText(text, MODERATION_MAX_LENGTH[k]))
      }),
      { seed: SEED, numRuns: 150 },
    )
  })

  it('flags exactly the categories at or above the threshold for that kind, and raising a score never clears a flag', () => {
    const score = probability
    const scores = fc.record({ harassment: score, spam: score, contact_solicitation: score, prompt_injection: score })
    fc.assert(
      fc.property(kind, scores, fc.constantFrom<ModerationCategory>('harassment', 'spam', 'contact_solicitation', 'prompt_injection'), (k, s, bump) => {
        const flagged = flaggedCategories(k, s)
        for (const c of Object.keys(s) as ModerationCategory[]) {
          const t = MODERATION_THRESHOLDS[k][c]
          expect(flagged.includes(c)).toBe(t !== undefined && s[c] >= t)
        }
        const raised = flaggedCategories(k, { ...s, [bump]: 1 })
        for (const c of flagged) expect(raised).toContain(c)
      }),
      { seed: SEED, numRuns: 300 },
    )
  })

  // Players share WhatsApp numbers to arrange matches; that alone must never hide a chat message.
  it('named regression: a chat message scored only as contact details is allowed', async () => {
    const gw = fakeGateway({
      kind: 'body',
      body: {
        answers: {
          harassment: { type: 'boolean', probability: 0.01 },
          spam: { type: 'boolean', probability: 0.05 },
          contact_solicitation: { type: 'boolean', probability: 0.99 },
          prompt_injection: { type: 'boolean', probability: 0.01 },
        },
      },
    })
    const result = await moderateText('chat', 'Escríbeme al 0991234567 y cuadramos', { env: FLAGS_ON, fetchImpl: gw.fetchImpl })
    expect(result.verdict).toBe('allow')
    const asName = await moderateText('name', 'Escríbeme al 0991234567', { env: FLAGS_ON, fetchImpl: gw.fetchImpl })
    expect(asName).toMatchObject({ verdict: 'flag', categories: ['contact_solicitation'] })
  })

  it('empty or whitespace text is allowed without a call', async () => {
    const gw = fakeGateway({ kind: 'body', body: answersFor(MODERATION_QUESTIONS, () => 1) })
    for (const text of ['', '   ', '\n\t']) {
      expect(await moderateText('chat', text, { env: FLAGS_ON, fetchImpl: gw.fetchImpl })).toEqual({ verdict: 'allow', checked: false })
    }
    expect(gw.calls).toHaveLength(0)
  })
})
