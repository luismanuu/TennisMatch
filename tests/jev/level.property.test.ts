// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fc from 'fast-check'
import { resetJevBreakerForTests, UNTRUSTED_NOTE, untrustedText } from '../../server/utils/jev'
import {
  buildLevelRequest,
  LEVEL_MIN_PROBABILITY,
  parseLevelAnswers,
  suggestLevel,
  type SuggestionCategory,
} from '../../server/utils/level-suggestion'
import { LEVEL_QUESTIONS } from '../../utils/level-questionnaire'
import { answersFor, fakeGateway, FLAGS_ON, gatewayFailure, INJECTIONS, probability, SEED, userText } from './helpers'

const CATEGORIES: SuggestionCategory[] = [
  ['1era Categoría', 'NIVEL ELITE'],
  ['2da Categoría', 'NIVEL AVANZADO'],
  ['3ra Categoría', 'NIVEL MEDIO ALTO'],
  ['4ta Categoría', 'NIVEL MEDIO BAJO'],
  ['5ta Categoría', 'NIVEL BÁSICO MEDIO'],
  ['6ta Categoría', 'NIVEL PRINCIPIANTE ALTO'],
  ['7ma Categoría', 'NIVEL PRINCIPIANTE'],
].map(([name, description], i) => ({ id: `00000000-0000-4000-8000-00000000000${i + 1}`, name, description, order: i + 1 }))

const validAnswers = fc.record({
  years: fc.constantFrom(...LEVEL_QUESTIONS[0].options.map((o) => o.id)),
  frequency: fc.constantFrom(...LEVEL_QUESTIONS[1].options.map((o) => o.id)),
  results: fc.constantFrom(...LEVEL_QUESTIONS[2].options.map((o) => o.id)),
  tournaments: fc.constantFrom(...LEVEL_QUESTIONS[3].options.map((o) => o.id)),
  self_description: fc.option(userText, { nil: undefined }),
})

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {})
})
afterEach(() => {
  resetJevBreakerForTests()
  vi.restoreAllMocks()
})

describe('onboarding level suggestion', () => {
  it('any gateway failure, or the flag off, gives no suggestion', async () => {
    await fc.assert(
      fc.asyncProperty(validAnswers, gatewayFailure, fc.boolean(), async (raw, behaviour, flagOn) => {
        resetJevBreakerForTests()
        const answers = parseLevelAnswers(raw)!
        const gw = fakeGateway(behaviour)
        const env = flagOn ? FLAGS_ON : { ...FLAGS_ON, JEV_ONBOARDING_ENABLED: 'false' }
        expect(await suggestLevel(answers, CATEGORIES, { env, fetchImpl: gw.fetchImpl })).toBeNull()
        if (!flagOn) expect(gw.calls).toHaveLength(0)
      }),
      { seed: SEED, numRuns: 200 },
    )
  })

  it('a suggestion is always one of the offered categories, is Jev\'s own top choice, and clears the probability bar', async () => {
    await fc.assert(
      fc.asyncProperty(validAnswers, fc.array(probability, { minLength: 9, maxLength: 9 }), async (raw, draws) => {
        let i = 0
        const { questions } = buildLevelRequest(parseLevelAnswers(raw)!, CATEGORIES)
        const body = answersFor(questions, () => draws[i++ % draws.length])
        const gw = fakeGateway({ kind: 'body', body })
        const suggestion = await suggestLevel(parseLevelAnswers(raw)!, CATEGORIES, { env: FLAGS_ON, fetchImpl: gw.fetchImpl })
        const level = body.answers.level as { choice: string; probabilities: Record<string, number> }
        const enough = (body.answers.enough_info as { probability: number }).probability
        const top = level.probabilities[level.choice]
        if (suggestion === null) {
          expect(enough < 0.5 || top < LEVEL_MIN_PROBABILITY || Object.values(level.probabilities).filter((p) => p === top).length > 1).toBe(true)
          return
        }
        const index = Number(level.choice.replace('tier_', '')) - 1
        expect(suggestion.category_id).toBe(CATEGORIES[index].id)
        expect(suggestion.probability).toBeGreaterThanOrEqual(LEVEL_MIN_PROBABILITY)
        expect(enough).toBeGreaterThanOrEqual(0.5)
        if (suggestion.runner_up) expect(suggestion.runner_up.category_id).not.toBe(suggestion.category_id)
      }),
      { seed: SEED, numRuns: 200 },
    )
  })

  it('answers outside the questionnaire are rejected before any call', () => {
    fc.assert(
      fc.property(
        fc.record({ years: fc.anything(), frequency: fc.anything(), results: fc.anything(), tournaments: fc.anything() }, { requiredKeys: [] }),
        (raw) => {
          const valid = LEVEL_QUESTIONS.every((q) => q.options.some((o) => o.id === (raw as any)[q.id]))
          expect(parseLevelAnswers(raw as any) !== undefined).toBe(valid)
        },
      ),
      { seed: SEED, numRuns: 200 },
    )
  })

  it('the self-description only reaches Jev as untrusted data; injection strings never alter the questions', async () => {
    const base = { years: 'few', frequency: 'weekly', results: 'even', tournaments: 'club' }
    const reference = buildLevelRequest(parseLevelAnswers(base)!, CATEGORIES)
    for (const injection of [...INJECTIONS, 'x'.repeat(5000)]) {
      const req = buildLevelRequest(parseLevelAnswers({ ...base, self_description: injection })!, CATEGORIES)
      expect(req.questions).toEqual(reference.questions)
      expect(req.state.player_facts).toEqual(reference.state.player_facts)
      expect(req.state.note).toBe(UNTRUSTED_NOTE)
      const stored = (req.state.untrusted_user_text as { self_description: string }).self_description
      expect(stored).toBe(untrustedText(injection.trim(), 300))
      expect(JSON.stringify(req.questions)).not.toContain(injection.slice(0, 20))
    }
  })
})
