// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import fc from 'fast-check'
import {
  evaluateJev,
  JEV_BREAKER_MS,
  JEV_ENDPOINT,
  JEV_MODEL,
  parseJevResponse,
  resetJevBreakerForTests,
  UNTRUSTED_GAP,
  untrustedText,
  type JevFeature,
  type JevQuestion,
} from '../../server/utils/jev'
import { answersFor, fakeGateway, FLAGS_ON, gatewayFailure, probability, SEED, userText } from './helpers'

const QUESTIONS = {
  flag: { type: 'boolean', instructions: 'Is it?' },
  pick: { type: 'choice', instructions: 'Which?', criteria: { a: 'first', b: 'second', c: 'third' } },
  rate: { type: 'score', instructions: 'How much?', criteria: ['low', 'mid', 'high'] },
} as const

const feature = fc.constantFrom<JevFeature>('onboarding', 'farming', 'moderation')

afterEach(() => {
  resetJevBreakerForTests()
  vi.restoreAllMocks()
})

describe('evaluateJev fails open', () => {
  it('any thrown error, non-2xx status (402 and 429 included) or malformed body resolves to ok:false after exactly one attempt', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    await fc.assert(
      fc.asyncProperty(feature, gatewayFailure, async (f, behaviour) => {
        resetJevBreakerForTests()
        const gw = fakeGateway(behaviour)
        const outcome = await evaluateJev({ feature: f, state: { x: 1 }, questions: QUESTIONS, env: FLAGS_ON, fetchImpl: gw.fetchImpl })
        expect(outcome.ok).toBe(false)
        expect(gw.calls).toHaveLength(1)
      }),
      { seed: SEED, numRuns: 300 },
    )
  })

  it('a gateway that never answers is cut off by the timeout', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    const gw = fakeGateway({ kind: 'hang' })
    const started = Date.now()
    const outcome = await evaluateJev({
      feature: 'moderation',
      state: {},
      questions: QUESTIONS,
      env: FLAGS_ON,
      fetchImpl: gw.fetchImpl,
      timeoutMs: 50,
    })
    expect(outcome).toMatchObject({ ok: false, reason: 'timeout' })
    expect(Date.now() - started).toBeLessThan(1000)
  })

  it('with the feature flag off, or no key, the gateway is never called', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    await fc.assert(
      fc.asyncProperty(
        feature,
        fc.constantFrom(undefined, '', 'false', 'TRUE', '1', 'yes'),
        fc.boolean(),
        async (f, flagValue, keyPresent) => {
          const flag = { onboarding: 'JEV_ONBOARDING_ENABLED', farming: 'JEV_FARMING_ENABLED', moderation: 'JEV_MODERATION_ENABLED' }[f]
          const env = { ...FLAGS_ON, [flag]: flagValue, AI_GATEWAY_API_KEY: keyPresent ? 'k' : undefined }
          const gw = fakeGateway({ kind: 'body', body: answersFor(QUESTIONS, () => 0.5) })
          const outcome = await evaluateJev({ feature: f, state: {}, questions: QUESTIONS, env, fetchImpl: gw.fetchImpl })
          expect(outcome.ok).toBe(false)
          expect(gw.calls).toHaveLength(0)
        },
      ),
      { seed: SEED, numRuns: 100 },
    )
    const gw = fakeGateway({ kind: 'body', body: answersFor(QUESTIONS, () => 0.5) })
    const noKey = await evaluateJev({
      feature: 'farming',
      state: {},
      questions: QUESTIONS,
      env: { ...FLAGS_ON, AI_GATEWAY_API_KEY: undefined },
      fetchImpl: gw.fetchImpl,
    })
    expect(noKey).toMatchObject({ ok: false, reason: 'no_key' })
    expect(gw.calls).toHaveLength(0)
  })

  it('a 402 or 429 pauses every feature for the breaker window instead of retrying', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    for (const status of [402, 429]) {
      resetJevBreakerForTests()
      let clock = 1_000_000
      const now = () => clock
      const gw = fakeGateway((body) => (gw.calls.length === 1 ? { kind: 'status', status } : { kind: 'body', body: answersFor(QUESTIONS, () => 0.5) }))
      const opts = { state: {}, questions: QUESTIONS, env: FLAGS_ON, fetchImpl: gw.fetchImpl, now }
      expect(await evaluateJev({ feature: 'moderation', ...opts })).toMatchObject({ ok: false, reason: `http_${status}` })
      expect(await evaluateJev({ feature: 'onboarding', ...opts })).toMatchObject({ ok: false, reason: 'breaker_open' })
      expect(gw.calls).toHaveLength(1)
      clock += JEV_BREAKER_MS
      expect((await evaluateJev({ feature: 'farming', ...opts })).ok).toBe(true)
      expect(gw.calls).toHaveLength(2)
    }
  })
})

describe('evaluateJev success path', () => {
  it('posts model, state and questions to the gateway and returns the parsed answers, tokens and cost', async () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => {})
    const body = answersFor(QUESTIONS, () => 0.7)
    const gw = fakeGateway({ kind: 'body', body })
    const outcome = await evaluateJev({ feature: 'farming', state: { s: 'x' }, questions: QUESTIONS, env: FLAGS_ON, fetchImpl: gw.fetchImpl })
    expect(gw.calls[0].url).toBe(JEV_ENDPOINT)
    expect(gw.calls[0].body).toEqual({ model: JEV_MODEL, state: { s: 'x' }, questions: QUESTIONS })
    expect(outcome).toMatchObject({ ok: true, answers: body.answers, inputTokens: 300, costUsd: 0.0000126 })
    const logged = JSON.parse(String(log.mock.calls.at(-1)![0]))
    expect(logged).toMatchObject({ event: 'jev_usage', feature: 'farming', outcome: 'ok', input_tokens: 300, cost_usd: 0.0000126 })
    expect(typeof logged.latency_ms).toBe('number')
    expect(JSON.stringify(logged)).not.toContain('test-gateway-key')
  })

  // The shape observed on a live call on 2026-09-26: `confidence` and extra metadata ride along.
  it('parses the live response shape, extra fields included', () => {
    const live = {
      answers: {
        flag: { type: 'boolean', probability: 0.01 },
        pick: { type: 'choice', choice: 'a', probabilities: { a: 0.97, b: 0.02, c: 0.01 }, confidence: 0.95 },
        rate: { type: 'score', score: 0.07, probabilities: { '0': 0.9299999999999999, '1': 0.06, '2': 0.01 }, confidence: 0.9 },
      },
      model: 'typesafe-ai/jev',
      providerMetadata: { gateway: { cost: '0.00001596' } },
      usage: { inputTokens: 380, outputTokens: 66 },
    }
    expect(parseJevResponse(QUESTIONS, live)).toMatchObject({ inputTokens: 380, costUsd: 0.00001596 })
  })

  it('round trip: any well-formed answer set parses back to itself; breaking any one answer rejects the whole response', () => {
    fc.assert(
      fc.property(fc.array(probability, { minLength: 12, maxLength: 12 }), fc.nat(), (draws, pick) => {
        let i = 0
        const body = answersFor(QUESTIONS as Record<string, JevQuestion>, () => draws[i++ % draws.length])
        expect(parseJevResponse(QUESTIONS, body)?.answers).toEqual(body.answers)
        const keys = Object.keys(QUESTIONS)
        const broken = structuredClone(body) as any
        const key = keys[pick % keys.length]
        const mutation = pick % 4
        if (mutation === 0) delete broken.answers[key]
        else if (mutation === 1) broken.answers[key].type = 'other'
        else if (mutation === 2) broken.answers[key] = { ...broken.answers[key], probability: 1.5, score: -1, choice: 'zzz' }
        else broken.answers[key] = 'not an object'
        expect(parseJevResponse(QUESTIONS, broken)).toBeUndefined()
      }),
      { seed: SEED, numRuns: 200 },
    )
  })
})

describe('untrustedText', () => {
  it('short text passes through; long text keeps exactly its head and tail, so padding cannot hide the end', () => {
    fc.assert(
      fc.property(userText, fc.integer({ min: 2, max: 400 }), (text, max) => {
        const out = untrustedText(text, max)
        const chars = Array.from(text)
        if (chars.length <= max) {
          expect(out).toBe(text)
          return
        }
        const half = Math.floor(max / 2)
        const outChars = Array.from(out)
        const gap = Array.from(UNTRUSTED_GAP).length
        expect(outChars.slice(0, half)).toEqual(chars.slice(0, half))
        expect(outChars.slice(half, half + gap).join('')).toBe(UNTRUSTED_GAP)
        expect(outChars.slice(half + gap)).toEqual(chars.slice(chars.length - (max - half)))
      }),
      { seed: SEED, numRuns: 300 },
    )
  })

  // Named regression (review finding): 2,000 harmless characters followed by abuse used to reach Jev
  // as the harmless part only.
  it('named regression: abuse after 2,000 characters of padding still reaches the model', () => {
    const text = 'hola '.repeat(400) + 'eres un tramposo de mierda'
    expect(untrustedText(text, 2000)).toContain('eres un tramposo de mierda')
  })
})

describe('evaluateJev body timeout', () => {
  it('a response whose headers arrive but whose body stalls is still cut off by the timeout', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      const body = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"answers":'))
          init.signal?.addEventListener('abort', () => controller.error(new DOMException('aborted', 'AbortError')))
        },
      })
      return new Response(body, { status: 200 })
    }) as unknown as typeof fetch
    const outcome = await evaluateJev({ feature: 'moderation', state: {}, questions: QUESTIONS, env: FLAGS_ON, fetchImpl, timeoutMs: 50 })
    expect(outcome).toMatchObject({ ok: false, reason: 'timeout' })
  })
})
