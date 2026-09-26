import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm'
import { useDb } from '../db'
import { matches, players, rating_history } from '../db/schema'
import { evaluateJev, type EvaluateJevOptions } from './jev'

// Rating-farming review for admins. Read-only by construction: it selects matches, players and
// rating_history, and returns a list. It never writes a rating, a match or a notification, and it is not
// on the score-approval path. Code does every count; Jev only judges the described pattern.

export const FARMING_WINDOW_DAYS = 60
export const FARMING_MIN_MATCHES = 3
export const FARMING_MAX_PAIRS = 50
export const FARMING_CONCURRENCY = 5
// Risk is Jev's 0-4 score over FARMING_RISK_LEVELS. 2.5 sits between "suspicious" and "likely farming",
// so a pair is flagged only when Jev leans past the midpoint. Not yet measured on labelled pairs.
export const FARMING_FLAG_SCORE = 2.5

export const FARMING_RISK_LEVELS = [
  'normal: two players who simply play each other often',
  'slightly unusual but with an innocent explanation',
  'suspicious: worth a human look',
  'likely rating farming or collusion',
  'almost certainly rating farming or collusion',
]

export const FARMING_QUESTIONS = {
  risk: {
    type: 'score',
    instructions:
      'How likely is it that these two accounts are colluding to inflate one rating (rating farming) rather than playing real matches?',
    criteria: FARMING_RISK_LEVELS,
  },
  one_sided: {
    type: 'boolean',
    instructions: 'Is this a repeated, one-sided series between the same two accounts?',
    criteria: {
      true: 'the same account wins almost every match, often by wide margins',
      false: 'results are mixed or the matches are few',
    },
  },
} as const

export type PairMatch = {
  id: string
  winner_is_a: boolean
  score: string | null
  proposed_by_winner: boolean | null
  minutes_to_confirm: number | null
}

export type PairFacts = {
  matches: number
  wins_a: number
  wins_b: number
  wide_margin_matches: number
  unreadable_scores: number
  proposed_by_winner: number
  median_minutes_to_confirm: number | null
  account_age_days_a: number
  account_age_days_b: number
  share_of_a_matches: number
  share_of_b_matches: number
  rating_points_to_a: number
}

// Every set decided by 4+ games (6-2, 6-1, 6-0...). Unparseable text returns null, never a guess.
export function isWideMarginScore(score: string | null): boolean | null {
  if (!score) return null
  const sets = [...score.matchAll(/(\d{1,2})\s*[-–]\s*(\d{1,2})/g)].map((m) => [Number(m[1]), Number(m[2])])
  if (sets.length === 0) return null
  return sets.every(([x, y]) => Math.abs(x - y) >= 4)
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export function computePairFacts(input: {
  matches: PairMatch[]
  accountAgeDaysA: number
  accountAgeDaysB: number
  totalMatchesA: number
  totalMatchesB: number
  ratingPointsToA: number
}): PairFacts {
  const m = input.matches
  const wins_a = m.filter((x) => x.winner_is_a).length
  const margins = m.map((x) => isWideMarginScore(x.score))
  const confirm = m.map((x) => x.minutes_to_confirm).filter((x): x is number => x !== null)
  const share = (total: number) => (total > 0 ? Math.round((m.length / total) * 100) / 100 : 0)
  return {
    matches: m.length,
    wins_a,
    wins_b: m.length - wins_a,
    wide_margin_matches: margins.filter((x) => x === true).length,
    unreadable_scores: margins.filter((x) => x === null).length,
    proposed_by_winner: m.filter((x) => x.proposed_by_winner === true).length,
    median_minutes_to_confirm: median(confirm),
    account_age_days_a: input.accountAgeDaysA,
    account_age_days_b: input.accountAgeDaysB,
    share_of_a_matches: share(input.totalMatchesA),
    share_of_b_matches: share(input.totalMatchesB),
    rating_points_to_a: input.ratingPointsToA,
  }
}

// Facts become sentences about "player A" and "player B". No names or other user-written text reach Jev.
export function describePairFacts(f: PairFacts): string[] {
  const confirm =
    f.median_minutes_to_confirm === null
      ? 'The time between proposing and confirming results is unknown.'
      : `Half of the results were confirmed by the opponent within ${f.median_minutes_to_confirm} minutes of being proposed.`
  return [
    `Player A and player B played ${f.matches} rated matches against each other in the last ${FARMING_WINDOW_DAYS} days.`,
    `Player A won ${f.wins_a} of them and player B won ${f.wins_b}.`,
    `${f.wide_margin_matches} of the ${f.matches} matches were won by a wide margin in every set; ${f.unreadable_scores} scores could not be read.`,
    `In ${f.proposed_by_winner} of the ${f.matches} matches the winner proposed the result and the loser confirmed it.`,
    confirm,
    `Player A's account is ${f.account_age_days_a} days old and player B's is ${f.account_age_days_b} days old.`,
    `These matches are ${Math.round(f.share_of_a_matches * 100)}% of all rated matches player A played in the window, and ${Math.round(f.share_of_b_matches * 100)}% of player B's.`,
    `Across these matches player A's rating changed by ${f.rating_points_to_a >= 0 ? '+' : ''}${f.rating_points_to_a} points in total.`,
  ]
}

export type FarmingReviewRow = {
  player_a: { id: string; name: string }
  player_b: { id: string; name: string }
  facts: PairFacts
  status: 'flagged' | 'clear' | 'unchecked'
  risk_score: number | null
  one_sided_probability: number | null
}

type JevOpts = Pick<EvaluateJevOptions<typeof FARMING_QUESTIONS>, 'env' | 'fetchImpl' | 'timeoutMs'>

export async function judgePair(facts: PairFacts, options: JevOpts = {}) {
  const outcome = await evaluateJev({
    feature: 'farming',
    state: {
      context: 'An amateur tennis ladder. Players propose match results and the opponent confirms them; confirmed results move both ratings.',
      facts: describePairFacts(facts),
    },
    questions: FARMING_QUESTIONS,
    ...options,
  })
  if (!outcome.ok) return { status: 'unchecked' as const, risk_score: null, one_sided_probability: null }
  const risk = outcome.answers.risk.score
  return {
    status: risk >= FARMING_FLAG_SCORE ? ('flagged' as const) : ('clear' as const),
    risk_score: Math.round(risk * 100) / 100,
    one_sided_probability: outcome.answers.one_sided.probability,
  }
}

async function mapLimited<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

// A non-finite change would turn the whole sum into NaN in the facts sent to Jev; it is skipped instead.
export function sumRatingPoints(rows: Array<{ elo_change: number | null | undefined }>): number {
  return rows.reduce((sum, r) => (Number.isFinite(r.elo_change) ? sum + (r.elo_change as number) : sum), 0)
}

const DAY_MS = 86_400_000

export async function scanForRatingFarming(options: JevOpts & { now?: Date } = {}): Promise<FarmingReviewRow[]> {
  const db = useDb()
  const now = options.now ?? new Date()
  const since = new Date(now.getTime() - FARMING_WINDOW_DAYS * DAY_MS)

  const rows = await db
    .select({
      id: matches.id,
      p1: matches.player1_id,
      p2: matches.player2_id,
      winner: matches.winner_id,
      score: matches.score,
      proposed_by: matches.score_proposed_by,
      proposed_at: matches.score_proposed_at,
    })
    .from(matches)
    .where(
      and(
        eq(matches.status, 'completed'),
        eq(matches.is_competitive, true),
        isNotNull(matches.player1_id),
        isNotNull(matches.player2_id),
        isNotNull(matches.winner_id),
        sql`coalesce(${matches.played_at}, ${matches.updated_at}) >= ${since.toISOString()}::timestamptz`,
      ),
    )

  const totals = new Map<string, number>()
  const byPair = new Map<string, typeof rows>()
  for (const r of rows) {
    if (r.winner !== r.p1 && r.winner !== r.p2) continue
    const [a, b] = [r.p1!, r.p2!].sort()
    totals.set(a, (totals.get(a) ?? 0) + 1)
    totals.set(b, (totals.get(b) ?? 0) + 1)
    const key = `${a}|${b}`
    const list = byPair.get(key)
    if (list) list.push(r)
    else byPair.set(key, [r])
  }
  const candidates = [...byPair.entries()]
    .filter(([, ms]) => ms.length >= FARMING_MIN_MATCHES)
    .sort((x, y) => y[1].length - x[1].length)
    .slice(0, FARMING_MAX_PAIRS)
  if (candidates.length === 0) return []

  const matchIds = candidates.flatMap(([, ms]) => ms.map((m) => m.id))
  const playerIds = [...new Set(candidates.flatMap(([key]) => key.split('|')))]
  const [history, people] = await Promise.all([
    db
      .select({
        match_id: rating_history.match_id,
        player_id: rating_history.player_id,
        elo_change: rating_history.elo_change,
        created_at: rating_history.created_at,
        reversed: rating_history.rating_reversed,
      })
      .from(rating_history)
      .where(inArray(rating_history.match_id, matchIds)),
    db
      .select({ id: players.id, name: players.name, created_at: players.created_at })
      .from(players)
      .where(inArray(players.id, playerIds)),
  ])
  const personById = new Map(people.map((p) => [p.id, p]))

  const reviewed = await mapLimited(candidates, FARMING_CONCURRENCY, async ([key, ms]): Promise<FarmingReviewRow> => {
    const [a, b] = key.split('|')
    const pairMatches: PairMatch[] = ms.map((m) => {
      // The first rating row is the original confirmation; a later admin recalculation adds newer rows.
      const ratedAt = history
        .filter((h) => h.match_id === m.id)
        .map((h) => h.created_at)
        .filter((d): d is Date => d !== null)
        .sort((x, y) => x.getTime() - y.getTime())[0]
      return {
        id: m.id,
        winner_is_a: m.winner === a,
        score: m.score,
        proposed_by_winner: m.proposed_by ? m.proposed_by === m.winner : null,
        minutes_to_confirm:
          ratedAt && m.proposed_at
            ? Math.max(0, Math.round((ratedAt.getTime() - m.proposed_at.getTime()) / 60_000))
            : null,
      }
    })
    const ratingPointsToA = sumRatingPoints(
      history.filter((h) => h.player_id === a && !h.reversed && ms.some((m) => m.id === h.match_id)),
    )
    const ageDays = (id: string) => {
      const created = personById.get(id)?.created_at
      return created ? Math.max(0, Math.floor((now.getTime() - created.getTime()) / DAY_MS)) : 0
    }
    const facts = computePairFacts({
      matches: pairMatches,
      accountAgeDaysA: ageDays(a),
      accountAgeDaysB: ageDays(b),
      totalMatchesA: totals.get(a) ?? 0,
      totalMatchesB: totals.get(b) ?? 0,
      ratingPointsToA,
    })
    return {
      player_a: { id: a, name: personById.get(a)?.name ?? '' },
      player_b: { id: b, name: personById.get(b)?.name ?? '' },
      facts,
      ...(await judgePair(facts, options)),
    }
  })
  const rank = { flagged: 0, unchecked: 1, clear: 2 }
  return reviewed.sort((x, y) => rank[x.status] - rank[y.status] || (y.risk_score ?? 0) - (x.risk_score ?? 0))
}
