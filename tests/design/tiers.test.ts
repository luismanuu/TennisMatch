import { describe, expect, it } from 'vitest'
import { TIERS, tierName } from '../../utils/tiers'
import { SEED, int, mulberry32, pick, str } from './prng'

describe('tiers (property)', () => {
  it('bands are contiguous from 1 to ∞ with no gaps or overlaps, so every rated SR has exactly one tier', () => {
    for (let i = 1; i < TIERS.length; i++) expect(TIERS[i].minElo).toBe(TIERS[i - 1].maxElo + 1)
    expect(TIERS[0].minElo).toBe(1)
    expect(TIERS[TIERS.length - 1].maxElo).toBe(Infinity)
    const rand = mulberry32(SEED + 30)
    for (let r = 0; r < 3000; r++) {
      const elo = int(rand, 1, 6000)
      expect(TIERS.filter(t => elo >= t.minElo && elo <= t.maxElo)).toHaveLength(1)
    }
  })

  it('tierName maps every internal key to its Spanish name and passes unknown keys through unchanged', () => {
    const rand = mulberry32(SEED + 31)
    for (const t of TIERS) expect(tierName(t.tier)).toBe(t.name)
    expect(tierName('Top100')).toBe('Top 100')
    expect(tierName(null)).toBe('')
    expect(tierName(undefined)).toBe('')
    for (let r = 0; r < 1000; r++) {
      const k = rand() < 0.5 ? pick(rand, TIERS).tier : str(rand, 10)
      const known = TIERS.find(t => t.tier === k)
      expect(tierName(k)).toBe(known ? known.name : k === 'Top100' ? 'Top 100' : k)
    }
  })
})
