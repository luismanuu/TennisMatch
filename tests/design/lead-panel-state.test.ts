import { describe, expect, it } from 'vitest'
import { byUrgency, leadPanelState } from '../../utils/pendingAction'
import { SEED, int, mulberry32, pick } from './prng'

const ERRORS = [null, undefined, '', 'Error fetching notifications', 'timeout', new Error('fetch failed')] as const
const TYPES = ['score_proposal', 'match_proposal', 'match_created', 'unknown', null] as const

describe('leadPanelState (property)', () => {
  it('never claims "Todo al día" before a fetch has succeeded, and a real pending action always leads', () => {
    const rand = mulberry32(SEED + 40)
    for (let i = 0; i < 5000; i++) {
      // Same derivation as pages/index.vue: lead = first urgent notification that has a match
      const list = Array.from({ length: int(rand, 0, 6) }, (_, j) => ({
        id: `n${j}`, type: pick(rand, TYPES), match_id: rand() < 0.7 ? `m${j}` : null
      }))
      const hasLead = !!byUrgency(list).find(n => n.match_id)
      const loaded = rand() < 0.5
      const error = pick(rand, ERRORS)
      const state = leadPanelState({ hasLead, loaded, error })

      if (hasLead) expect(state).toBe('lead')
      if (state === 'clear') { expect(loaded).toBe(true); expect(hasLead).toBe(false) }
      if (!loaded && !hasLead) expect(state).toBe(error ? 'error' : 'loading')
      if (loaded && !hasLead) expect(state).toBe('clear')
    }
  })
})

describe('leadPanelState regressions', () => {
  // Bugbot PR #2 (4101202203): the empty initial list rendered "Todo al día" while the fetch was in flight
  it('signed-in player, fetch still in flight, notifications = [] → loading, not clear', () => {
    expect(leadPanelState({ hasLead: false, loaded: false, error: null })).toBe('loading')
  })

  // Bugbot PR #2 (4101202203): on a failed first fetch the false all-clear stayed on screen
  it('first fetch failed with "timeout", notifications = [] → error, not clear', () => {
    expect(leadPanelState({ hasLead: false, loaded: false, error: 'timeout' })).toBe('error')
  })

  it('a later poll fails after a good empty load → keeps the known clear state', () => {
    expect(leadPanelState({ hasLead: false, loaded: true, error: 'timeout' })).toBe('clear')
  })
})
