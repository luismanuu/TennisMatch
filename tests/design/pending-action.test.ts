import { describe, expect, it } from 'vitest'
import { PRIORITY, byUrgency, formatScore, opponentName, pendingCopy, type PendingNotification } from '../../utils/pendingAction'
import { SEED, int, mulberry32, pick, str } from './prng'

const TYPES = [...Object.keys(PRIORITY), 'unknown_type', '', null, undefined] as const
const NAMES = ['Diego Ramírez', 'María José Villacís de la Torre Albornoz', 'Ana', '  ', '', null, undefined, '🎾 Pato']
const ME = 'p-me'

function notification(rand: () => number, i: number): PendingNotification {
  const meIsP1 = rand() < 0.5
  const other = `p${int(rand, 1, 99)}`
  const withMatch = rand() < 0.85
  const nm = pick(rand, NAMES)
  return {
    id: `n${i}`,
    type: pick(rand, TYPES) as string | null | undefined,
    match_id: rand() < 0.9 ? `m${int(rand, 1, 5)}` : null,
    metadata: rand() < 0.2 ? null : { with_player: pick(rand, NAMES), accepted_by: rand() < 0.3 ? pick(rand, NAMES) : undefined },
    match: withMatch ? {
      player1_id: meIsP1 ? ME : other,
      player2_id: meIsP1 ? other : ME,
      player1: rand() < 0.9 ? { id: meIsP1 ? ME : other, name: meIsP1 ? 'Mateo Salazar' : nm } : null,
      player2: rand() < 0.9 ? { id: meIsP1 ? other : ME, name: meIsP1 ? nm : 'Mateo Salazar' } : null,
      score: rand() < 0.5 ? str(rand, 12) : null
    } : null
  }
}

describe('pendingCopy (property)', () => {
  it('never throws, always yields non-empty status/title/action, and never names the viewer as the opponent', () => {
    const rand = mulberry32(SEED + 20)
    for (let i = 0; i < 3000; i++) {
      const n = notification(rand, i)
      const copy = pendingCopy(n, ME)
      for (const v of Object.values(copy)) { expect(typeof v).toBe('string'); expect(v.trim().length).toBeGreaterThan(0) }
      expect(copy.title).not.toMatch(/Mateo Salazar/)
      expect(copy.title).not.toMatch(/\bcon\s*$/)
      expect(copy.title).not.toMatch(/undefined|null/)
      const who = opponentName(n, ME)
      if (who) expect(who).toBe(who.trim())
    }
  })

  it('regression: a blank opponent name reads as a complete sentence, not "con "', () => {
    const n: PendingNotification = { type: 'score_proposal', match: { player1_id: ME, player2_id: 'p2', player1: { id: ME, name: 'Mateo' }, player2: { id: 'p2', name: '  ' } } }
    expect(pendingCopy(n, ME).title).toBe('Confirma tu partido')
  })
})

describe('byUrgency (property)', () => {
  it('is a permutation, orders by priority, and keeps API order within a priority', () => {
    const rand = mulberry32(SEED + 21)
    for (let r = 0; r < 500; r++) {
      const list = Array.from({ length: int(rand, 0, 12) }, (_, i) => notification(rand, i))
      const out = byUrgency(list)
      expect(out).toHaveLength(list.length)
      expect(new Set(out)).toEqual(new Set(list))
      const p = (n: PendingNotification) => PRIORITY[n.type ?? ''] ?? 9
      for (let i = 1; i < out.length; i++) {
        expect(p(out[i - 1])).toBeLessThanOrEqual(p(out[i]))
        if (p(out[i - 1]) === p(out[i])) expect(list.indexOf(out[i - 1])).toBeLessThan(list.indexOf(out[i]))
      }
    }
  })
})

describe('formatScore (property)', () => {
  it('only swaps hyphens between digits for en dashes; digits and length-of-digits survive', () => {
    const rand = mulberry32(SEED + 22)
    for (let i = 0; i < 2000; i++) {
      const sets = Array.from({ length: int(rand, 0, 5) }, () => `${int(rand, 0, 7)}${pick(rand, ['-', ' - ', '-'])}${int(rand, 0, 12)}`)
      const raw = sets.join(pick(rand, [', ', ' ', ',']))
      const out = formatScore(raw)
      expect(out.replace(/\D/g, '')).toBe(raw.replace(/\D/g, ''))
      expect(out).not.toMatch(/\d\s*-\s*\d/)
    }
    expect(formatScore('6-4, 3-6, 10-7')).toBe('6–4, 3–6, 10–7')
  })
})
