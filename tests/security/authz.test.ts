// @vitest-environment node
import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { authorize, type Requirement } from '../../server/utils/authz'

// Written from the product rules, not from authz.ts: who may do what.
const MAY: Record<Requirement, string[]> = {
  user: ['player', 'admin', 'tournament_organizer'],
  admin: ['admin'],
  organizer: ['tournament_organizer'],
  admin_or_organizer: ['admin', 'tournament_organizer'],
}

const requirement = fc.constantFrom<Requirement>('user', 'admin', 'organizer', 'admin_or_organizer')
const role = fc.oneof(
  fc.constantFrom(null, undefined, 'player', 'admin', 'tournament_organizer'),
  // near-misses an attacker or a bad migration could produce
  fc.constantFrom('Admin', 'ADMIN', 'admin ', ' admin', 'administrator', 'organizer', 'tournament-organizer', ''),
  fc.string(),
  fc.string({ unit: 'grapheme' }),
)

describe('authorize(role, requirement)', () => {
  it('allows exactly the roles the product rules name, 401 without a session, 403 otherwise', () => {
    fc.assert(
      fc.property(role, requirement, (r, req) => {
        const outcome = authorize(r, req)
        if (r === null || r === undefined) {
          return !outcome.ok && outcome.statusCode === 401
        }
        if (MAY[req].includes(r)) {
          return outcome.ok
        }
        return !outcome.ok && outcome.statusCode === 403
      }),
      { seed: 20260925, numRuns: 2000 },
    )
  })

  it('an admin requirement is never satisfied by a lookalike role string', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => s !== 'admin'),
        (r) => !authorize(r, 'admin').ok,
      ),
      { seed: 20260925, numRuns: 2000 },
    )
  })
})
