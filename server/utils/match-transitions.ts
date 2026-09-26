export type MatchStatus = 'scheduled' | 'active' | 'completed' | 'cancelled'

/**
 * The only status changes a match can make, by action. Anything else is refused before the write, and the write
 * itself is conditional on the status that was checked (matches/[id].put.ts), so two requests cannot both move it.
 *
 * - A match starts (scheduled → active) through update_status, which cannot do anything else.
 * - It is cancelled before it starts, by `cancel` or by the opponent rejecting the proposal; an admin can also
 *   cancel an active match (abandoned, no result).
 * - It is completed only by an approved score or an organizer/admin result, which also rates it.
 * - completed and cancelled are final.
 */
export const STATUS_CHANGES: Readonly<Record<string, { from: readonly MatchStatus[]; to: MatchStatus }>> = {
  update_status: { from: ['scheduled'], to: 'active' },
  // Players only before it starts (enforced in the handler); an admin also closes an active match that was abandoned
  cancel: { from: ['scheduled', 'active'], to: 'cancelled' },
  reject_match: { from: ['scheduled'], to: 'cancelled' },
  approve_score: { from: ['active'], to: 'completed' },
  organizer_set_result: { from: ['scheduled', 'active'], to: 'completed' },
}

export function statusChangeError(action: string, from: MatchStatus, to: MatchStatus): string | null {
  const allowed = STATUS_CHANGES[action]
  if (allowed && allowed.to === to && allowed.from.includes(from)) return null
  return `No se puede pasar un partido de "${from}" a "${to}" con esta acción.`
}
