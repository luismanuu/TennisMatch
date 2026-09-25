/**
 * Tablero: pure motion and scoring logic for the scoreboard world (DESIGN.md).
 * Everything here is deterministic and DOM-free so it can be property-tested;
 * composables/useScrub.ts and components/tablero/* only read from it.
 */

export type Side = 'a' | 'b'

export const clamp01 = (x: number): number => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0)

/**
 * Progress through a pinned section: 0 when its top reaches the viewport top,
 * 1 when its bottom reaches the viewport bottom. A section no taller than the
 * viewport has no scroll distance and reads as complete once its top passes.
 */
export function sectionProgress(top: number, height: number, viewport: number): number {
  const travel = height - viewport
  if (!(travel > 0)) return top <= 0 ? 1 : 0
  return clamp01(-top / travel)
}

/**
 * Linger remap (after scroll-world's scrub engine): the board moves quickly at
 * the edges of a section and slowly in its middle, where the copy peaks.
 * f(0) = 0, f(1) = 1 and f is non-decreasing for amount in [0, 1].
 */
export function linger(t: number, amount: number): number {
  const x = clamp01(t)
  const a = Math.min(1, Math.max(0, Number.isFinite(amount) ? amount : 0))
  if (x === 0 || x === 1) return x
  return clamp01(x + (a * Math.sin(2 * Math.PI * x)) / (2 * Math.PI))
}

/** Whole step reached at progress t out of n steps: 0..n, non-decreasing, n exactly at t = 1. */
export function stepAt(t: number, n: number): number {
  const steps = Math.max(0, Math.floor(Number.isFinite(n) ? n : 0))
  return Math.min(steps, Math.floor(clamp01(t) * steps + 1e-9))
}

/**
 * Frame-rate independent smoothing toward a target: after `dt` ms the gap has
 * shrunk by half every `halfLife` ms. Snaps when the gap is below `epsilon`, so a
 * resting board stops requesting frames.
 */
export function smoothToward(current: number, target: number, dt: number, halfLife = 90, epsilon = 0.0005): number {
  if (!Number.isFinite(current)) return target
  if (!Number.isFinite(target)) return current
  const gap = target - current
  if (Math.abs(gap) < epsilon || !(halfLife > 0)) return target
  // A first rAF frame can hand over an undefined/NaN delta: treat it as no time passed.
  const elapsed = Number.isFinite(dt) ? Math.max(0, dt) : 0
  const k = 1 - Math.pow(2, -elapsed / halfLife)
  const next = current + gap * k
  return Math.abs(target - next) < epsilon ? target : next
}

/** Digits of a non-negative integer for one-plate-per-digit display. Invalid input shows a dash. */
export function plateDigits(value: number | null | undefined, minDigits = 1): string[] {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return ['–']
  const s = String(Math.floor(value))
  return s.padStart(Math.max(1, Math.floor(minDigits)), '0').split('')
}

// ── Tennis scoring ─────────────────────────────────────────────────────────

export interface MatchState {
  /** Completed sets as [a, b] game counts. */
  sets: Array<[number, number]>
  /** Games in the set being played. */
  games: [number, number]
  /** Point display for the game in progress: 0 15 30 40 AD, or tiebreak counts. */
  points: [string, string]
  tiebreak: boolean
  winner: Side | null
  /** Sets won so far. */
  setsWon: [number, number]
}

const LABELS = ['0', '15', '30', '40']
const idx = (s: Side): 0 | 1 => (s === 'a' ? 0 : 1)

function pointLabels(p: [number, number], tiebreak: boolean): [string, string] {
  if (tiebreak) return [String(p[0]), String(p[1])]
  const [a, b] = p
  if (a >= 3 && b >= 3) {
    if (a === b) return ['40', '40']
    return a > b ? ['AD', '40'] : ['40', 'AD']
  }
  return [LABELS[Math.min(a, 3)] ?? '0', LABELS[Math.min(b, 3)] ?? '0']
}

/**
 * Replays a point sequence under standard rules: games to four points by two
 * (deuce/advantage), sets to six games by two with a seven-point tiebreak at 6–6,
 * best of `bestOf` sets. Points after the match is decided are ignored.
 */
export function scoreAfter(points: readonly Side[], bestOf = 3): MatchState {
  const needSets = Math.floor(Math.max(1, bestOf) / 2) + 1
  const sets: Array<[number, number]> = []
  const setsWon: [number, number] = [0, 0]
  let games: [number, number] = [0, 0]
  let pts: [number, number] = [0, 0]
  let winner: Side | null = null

  for (const s of points) {
    if (winner) break
    const i = idx(s)
    const o: 0 | 1 = i === 0 ? 1 : 0
    const tiebreak = games[0] === 6 && games[1] === 6
    pts[i]++
    const target = tiebreak ? 7 : 4
    if (pts[i] >= target && pts[i] - pts[o] >= 2) {
      pts = [0, 0]
      games[i]++
      const setDone = tiebreak || (games[i] >= 6 && games[i] - games[o] >= 2)
      if (setDone) {
        sets.push([games[0], games[1]])
        setsWon[i]++
        games = [0, 0]
        if (setsWon[i] >= needSets) winner = s
      }
    }
  }

  const tiebreakNow = !winner && games[0] === 6 && games[1] === 6
  return {
    sets,
    games,
    points: winner ? ['', ''] : pointLabels(pts, tiebreakNow),
    tiebreak: tiebreakNow,
    winner,
    setsWon
  }
}

/** Point sequence for one game: `pattern` lists the loser's points before the winner closes it out. */
function game(winner: Side, loserPoints: number, deuces = 0): Side[] {
  const loser: Side = winner === 'a' ? 'b' : 'a'
  const out: Side[] = []
  const l = Math.min(loserPoints, 3)
  // Interleave so the score reads naturally, then close the game.
  for (let k = 0; k < 3; k++) { out.push(winner); if (k < l) out.push(loser) }
  for (let d = 0; d < deuces; d++) out.push(loser, winner) // deuce back and forth
  if (l === 3) out.push(winner)
  out.push(winner)
  return out
}

/**
 * The landing's example match (synthetic, labelled on the page): 6–4, 6–3.
 * Built from whole games so every stop on the scroll is a real score.
 */
export const EXAMPLE_MATCH: readonly Side[] = [
  // Set 1: 6–4
  ...game('a', 1), ...game('b', 2), ...game('a', 3, 1), ...game('b', 0), ...game('a', 2),
  ...game('a', 1), ...game('b', 3), ...game('a', 0), ...game('b', 2), ...game('a', 3, 2),
  // Set 2: 6–3
  ...game('a', 2), ...game('a', 1), ...game('b', 3, 1), ...game('a', 0), ...game('b', 1),
  ...game('a', 2), ...game('b', 2), ...game('a', 3), ...game('a', 1)
]

// ── Landing stage timeline ─────────────────────────────────────────────────

export interface StageState {
  /** Points of the example match already played. */
  played: number
  match: MatchState
  /** 0 nothing proposed, 1 score proposed, 2 confirmed by both players. */
  confirm: 0 | 1 | 2
  /** 0..1: the winner's name plate climbing one rung on the ladder. */
  climb: number
}

export const STAGE = { play: 0.64, confirm: 0.8 } as const

/**
 * Scroll progress → what the board shows. The match plays out on whole points
 * (the board never rests between plates), then the result is proposed and
 * confirmed, then the winner climbs one rung. Reversible: scrolling up replays it backwards.
 */
export function stageAt(progress: number, script: readonly Side[] = EXAMPLE_MATCH): StageState {
  const p = clamp01(progress)
  const playT = linger(p / STAGE.play, 0.35)
  const played = stepAt(playT, script.length)
  const match = scoreAfter(script.slice(0, played))
  const confirmT = clamp01((p - STAGE.play) / (STAGE.confirm - STAGE.play))
  const confirm = (match.winner ? stepAt(confirmT, 2) : 0) as 0 | 1 | 2
  const climbRaw = clamp01((p - STAGE.confirm) / (1 - STAGE.confirm))
  const climb = confirm === 2 ? climbRaw : 0
  return { played, match, confirm, climb }
}
