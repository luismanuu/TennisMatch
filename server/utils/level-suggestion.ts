import {
  LEVEL_QUESTIONS,
  SELF_DESCRIPTION_MAX,
  type LevelAnswers,
  type LevelSuggestion,
} from '~/utils/level-questionnaire'
import { evaluateJev, UNTRUSTED_NOTE, untrustedText, type EvaluateJevOptions, type JevOutcome } from './jev'

export type SuggestionCategory = { id: string; name: string; description: string | null; order: number }

// Seeded tiers are ordered 1 (elite) to 7 (beginner). Their DB descriptions are two words, too thin for
// Jev to separate neighbours, so each seeded order gets a player profile. An admin-added order keeps
// only its own name and description.
const PROFILE_BY_ORDER: Record<number, string> = {
  1: 'elite: current or former national-level, professional or college players who win open tournaments',
  2: 'advanced: strong tournament players with reliable strokes who go deep in regional tournaments',
  3: 'upper intermediate: regular club competitors who play tournaments and beat most club players',
  4: 'lower intermediate: plays weekly, rallies consistently and wins some club matches',
  5: 'basic intermediate: can rally and play full sets but loses often to regular club players',
  6: 'upper beginner: has played for a short while and is learning to keep the ball in play',
  7: 'beginner: has just started or plays very rarely',
}

// A top choice below this share means Jev is split between tiers; "we suggest X" would overstate it.
// Uniform over 7 tiers is 0.14. Not yet measured on labelled Spanish data (see the PR).
export const LEVEL_MIN_PROBABILITY = 0.45
export const LEVEL_MIN_ENOUGH_INFO = 0.5

export const LEVEL_QUESTION_ENOUGH_INFO = {
  type: 'boolean',
  instructions: 'Do these answers give enough consistent information to place this player in a playing level?',
  criteria: {
    true: 'the answers agree with each other and describe a playing level',
    false: 'the answers contradict each other or say almost nothing about how well the player plays',
  },
} as const

// Keys come from list position so two categories sharing an order still get distinct options.
const categoryKey = (index: number) => `tier_${index + 1}`

export type LevelAnswersInput = Partial<Record<string, unknown>>

export function parseLevelAnswers(body: LevelAnswersInput | undefined): LevelAnswers | undefined {
  if (!body || typeof body !== 'object') return undefined
  const parsed: Record<string, string> = {}
  for (const q of LEVEL_QUESTIONS) {
    const value = body[q.id]
    if (typeof value !== 'string' || !q.options.some((o) => o.id === value)) return undefined
    parsed[q.id] = value
  }
  const selfDescription = body.self_description
  if (selfDescription !== undefined && typeof selfDescription !== 'string') return undefined
  return { ...(parsed as LevelAnswers), self_description: selfDescription?.trim() || undefined }
}

export function buildLevelRequest(answers: LevelAnswers, categories: SuggestionCategory[]) {
  const facts = LEVEL_QUESTIONS.map((q) => q.options.find((o) => o.id === answers[q.id])!.fact)
  const criteria: Record<string, string> = {}
  categories.forEach((c, i) => {
    criteria[categoryKey(i)] = [c.name, c.description, PROFILE_BY_ORDER[c.order]].filter(Boolean).join(': ')
  })
  const state: Record<string, unknown> = {
    context: 'A new player is joining an amateur tennis ladder in Ecuador and answered a short questionnaire.',
    player_facts: facts,
  }
  if (answers.self_description) {
    state.note = UNTRUSTED_NOTE
    state.untrusted_user_text = { self_description: untrustedText(answers.self_description, SELF_DESCRIPTION_MAX) }
  }
  const questions = {
    level: {
      type: 'choice' as const,
      instructions: 'Which playing category fits this player best?',
      criteria,
    },
    enough_info: LEVEL_QUESTION_ENOUGH_INFO,
  }
  return { state, questions }
}

type LevelQuestions = ReturnType<typeof buildLevelRequest>['questions']

export function interpretLevelOutcome(
  outcome: JevOutcome<LevelQuestions>,
  categories: SuggestionCategory[],
): LevelSuggestion | null {
  if (!outcome.ok) return null
  const { level, enough_info } = outcome.answers
  if (enough_info.probability < LEVEL_MIN_ENOUGH_INFO) return null
  const ranked = categories
    .map((c, i) => ({ category: c, key: categoryKey(i), probability: level.probabilities[categoryKey(i)] ?? 0 }))
    .sort((a, b) => b.probability - a.probability)
  const top = ranked[0]
  if (!top || top.key !== level.choice || top.probability < LEVEL_MIN_PROBABILITY) return null
  const second = ranked[1]
  return {
    category_id: top.category.id,
    name: top.category.name,
    probability: top.probability,
    runner_up:
      second && second.probability > 0
        ? { category_id: second.category.id, name: second.category.name, probability: second.probability }
        : null,
  }
}

export async function suggestLevel(
  answers: LevelAnswers,
  categories: SuggestionCategory[],
  options: Pick<EvaluateJevOptions<LevelQuestions>, 'env' | 'fetchImpl' | 'timeoutMs'> = {},
): Promise<LevelSuggestion | null> {
  if (categories.length < 2) return null
  const { state, questions } = buildLevelRequest(answers, categories)
  const outcome = await evaluateJev({ feature: 'onboarding', state, questions, ...options })
  return interpretLevelOutcome(outcome, categories)
}
