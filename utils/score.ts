/**
 * Tennis score: parse, validate and render. Pure, shared by the score form (live preview) and the server (the only
 * gate a result passes before it is stored and rated).
 *
 * Orientation: player 1's games are always written first ("6-4 3-6 7-5" means player 1 took the first and third sets).
 * Format: best of 3 sets; the third set may be a match tiebreak to 10 ("6-4 3-6 10-8"). A 7-6 set may carry the
 * loser's tiebreak points ("7-6(5)"). "ret." after the sets marks a retirement, "abd." an abandoned match, and "W/O"
 * alone a walkover. The stored text is always renderScore(parseScore(input)), so every stored score parses back to
 * the same value.
 */

export type Completion = 'completed' | 'retired' | 'walkover' | 'abandoned'
export type Side = 'p1' | 'p2'

export type SetScore = {
  p1: number
  p2: number
  /** Loser's points in the tiebreak of a 7-6 set, when given */
  tiebreak?: number
  /** A third-set match tiebreak (points, first to 10 by 2) instead of a set of games */
  matchTiebreak?: true
}

export type ParsedScore = { sets: SetScore[]; completion: Completion }

export type ScoreParse = { ok: true; score: ParsedScore } | { ok: false; error: string }

const WALKOVER = /^(w\s*\/\s*o|w\.?\s*o\.?|walkover)$/
const MARKERS: Array<[RegExp, Completion]> = [
  [/\s*(ret\.?|rtd\.?|retired|retiro|retirado|retirada)$/, 'retired'],
  [/\s*(abd\.?|abandonado|suspendido)$/, 'abandoned'],
]
const TOKEN = /^\[?(\d{1,2})-(\d{1,2})\]?(?:\((\d{1,2})(?:-(\d{1,2}))?\))?$/

const fail = (error: string): ScoreParse => ({ ok: false, error })

/** Who took this set, or null when it is not a finished set. */
export function setWinner(set: SetScore): Side | null {
  const hi = Math.max(set.p1, set.p2)
  const lo = Math.min(set.p1, set.p2)
  const finished = set.matchTiebreak
    ? hi >= 10 && hi - lo >= 2 && (hi === 10 || hi - lo === 2)
    : (hi === 6 && lo <= 4) || (hi === 7 && (lo === 5 || lo === 6))
  if (!finished) return null
  return set.p1 > set.p2 ? 'p1' : 'p2'
}

function setsWon(sets: SetScore[]): { p1: number; p2: number } {
  const won = { p1: 0, p2: 0 }
  for (const set of sets) {
    const w = setWinner(set)
    if (w) won[w]++
  }
  return won
}

/** The side the sets say won the match; null for a retirement, walkover or abandoned match. */
export function scoreWinner(score: ParsedScore): Side | null {
  if (score.completion !== 'completed') return null
  const won = setsWon(score.sets)
  return won.p1 === 2 ? 'p1' : won.p2 === 2 ? 'p2' : null
}

// A set in progress when the match stopped: games only, neither side has won it yet.
function isPartialSet(set: SetScore): boolean {
  if (set.matchTiebreak || set.tiebreak !== undefined) return false
  return Math.max(set.p1, set.p2) <= 6 && setWinner(set) === null
}

function parseToken(token: string, index: number): SetScore | string {
  const m = TOKEN.exec(token)
  if (!m) return `No entiendo "${token}". Escribe cada set como 6-4.`
  const p1 = Number(m[1])
  const p2 = Number(m[2])
  const bracketed = token.startsWith('[')
  const set: SetScore = { p1, p2 }
  if (bracketed || (index === 2 && Math.max(p1, p2) >= 10)) {
    if (m[3] !== undefined) return `El super tiebreak "${token}" no lleva paréntesis.`
    set.matchTiebreak = true
    return set
  }
  if (m[3] !== undefined) {
    if (Math.max(p1, p2) !== 7 || Math.min(p1, p2) !== 6) return `Solo un set 7-6 lleva tiebreak entre paréntesis ("${token}").`
    const a = Number(m[3])
    const tiebreak = m[4] === undefined ? a : Math.min(a, Number(m[4]))
    if (m[4] !== undefined) {
      const hi = Math.max(a, Number(m[4]))
      if (hi < 7 || hi - tiebreak < 2 || (hi > 7 && hi - tiebreak !== 2)) return `El tiebreak de "${token}" no es válido.`
    }
    set.tiebreak = tiebreak
  }
  return set
}

export function parseScore(input: string | null | undefined): ScoreParse {
  let text = (input ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
  if (!text) return fail('Escribe el marcador, por ejemplo 6-4 6-3.')
  if (WALKOVER.test(text)) return { ok: true, score: { sets: [], completion: 'walkover' } }

  let completion: Completion = 'completed'
  for (const [marker, value] of MARKERS) {
    if (marker.test(text)) {
      completion = value
      text = text.replace(marker, '').trim()
      break
    }
  }

  // "6/4" and "6–4" (slash, en dash) are common spellings of 6-4
  const tokens = text
    .replace(/(\d)\s*[\/\u2013\u2014]\s*(\d)/g, '$1-$2')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s*\(\s*/g, '(')
    .replace(/\s*\)/g, ')')
    .split(/[\s,;]+/)
    .filter(Boolean)
  if (tokens.length === 0) return fail('Escribe al menos un set antes de "ret." o "abd.".')
  if (tokens.length > 3) return fail('Un partido tiene como máximo 3 sets.')

  const sets: SetScore[] = []
  for (const [i, token] of tokens.entries()) {
    const set = parseToken(token, i)
    if (typeof set === 'string') return fail(set)
    sets.push(set)
  }

  const error = validate({ sets, completion })
  return error ? fail(error) : { ok: true, score: { sets, completion } }
}

function validate({ sets, completion }: ParsedScore): string | null {
  const last = sets.length - 1
  for (const [i, set] of sets.entries()) {
    if (set.matchTiebreak && i !== 2) return 'El super tiebreak solo puede ser el tercer set.'
    const partialAllowed = completion !== 'completed' && i === last
    if (setWinner(set) === null && !(partialAllowed && isPartialSet(set))) {
      return `El set ${set.p1}-${set.p2} no es un resultado válido de set.`
    }
  }

  const beforeThird = setsWon(sets.slice(0, 2))
  if (sets.length === 3 && (beforeThird.p1 === 2 || beforeThird.p2 === 2)) {
    return 'Hay un tercer set, pero el partido ya estaba decidido en dos.'
  }
  if (sets[2]?.matchTiebreak && !(beforeThird.p1 === 1 && beforeThird.p2 === 1)) {
    return 'El super tiebreak solo se juega con los sets 1-1.'
  }

  const won = setsWon(sets)
  const decided = won.p1 === 2 || won.p2 === 2
  if (completion === 'completed' && !decided) return 'El marcador no tiene ganador: faltan sets. Si alguien se retiró, añade "ret.".'
  if (completion !== 'completed' && decided) return 'El partido ya estaba decidido: quita "ret." o "abd.".'
  return null
}

export function renderSet(set: SetScore): string {
  const games = `${set.p1}-${set.p2}`
  return set.tiebreak === undefined ? games : `${games}(${set.tiebreak})`
}

export function renderScore(score: ParsedScore): string {
  if (score.completion === 'walkover') return 'W/O'
  const sets = score.sets.map(renderSet).join(' ')
  if (score.completion === 'retired') return `${sets} ret.`
  if (score.completion === 'abandoned') return `${sets} abd.`
  return sets
}

/**
 * Whether a parsed score can stand as the result with `winner` as the winner. A completed match must be won by that
 * side in the sets; a retirement or walkover names the winner explicitly (the other player retired or did not show).
 * An abandoned match has no winner and is never a result.
 */
export function checkWinner(score: ParsedScore, winner: Side): string | null {
  if (score.completion === 'abandoned') return 'Un partido abandonado no tiene ganador y no se puede registrar como resultado.'
  if (score.completion !== 'completed') return null
  const byScore = scoreWinner(score)
  if (byScore !== winner) return 'El marcador no coincide con el ganador. Van primero los juegos de quien creó el partido.'
  return null
}
