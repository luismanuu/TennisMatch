/**
 * Copy for the Inicio lead card and pending list, derived only from a real
 * notification (DESIGN.md §7: never invent urgency). Pure, so it is property-tested.
 */
export interface PendingNotification {
  id?: string
  type?: string | null
  match_id?: string | null
  metadata?: Record<string, unknown> | null
  match?: {
    player1_id?: string | null
    player2_id?: string | null
    scheduled_at?: string | null
    location?: string | null
    score?: string | null
    player1?: { id?: string | null; name?: string | null } | null
    player2?: { id?: string | null; name?: string | null } | null
  } | null
}

export interface PendingCopy { status: string; title: string; action: string }

/** Lower number = more urgent. A result waiting on you outranks everything else. */
export const PRIORITY: Record<string, number> = {
  score_proposal: 0,
  match_proposal: 1,
  reschedule_proposal: 2,
  schedule_proposal: 3,
  acceptance_change: 4,
  match_created: 5
}

const clean = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

/** The other player's name, seen from `myPlayerId`; falls back to metadata names. */
export function opponentName(n: PendingNotification, myPlayerId?: string | null): string | null {
  const m = n.match
  if (m) {
    const p1 = m.player1?.id ?? m.player1_id ?? null
    const p2 = m.player2?.id ?? m.player2_id ?? null
    if (myPlayerId && p1 === myPlayerId) return clean(m.player2?.name)
    if (myPlayerId && p2 === myPlayerId) return clean(m.player1?.name)
  }
  const md = n.metadata ?? {}
  return clean(md.with_player) ?? clean(md.accepted_by) ?? null
}

export function pendingCopy(n: PendingNotification, myPlayerId?: string | null): PendingCopy {
  const who = opponentName(n, myPlayerId)
  const withWho = who ? ` con ${who}` : ''
  switch (n.type) {
    case 'score_proposal':
      return { status: 'Resultado pendiente', title: `Confirma tu partido${withWho}`, action: 'Revisar resultado' }
    case 'match_proposal':
      return { status: 'Propuesta de partido', title: who ? `${who} te propuso un partido` : 'Te propusieron un partido', action: 'Ver propuesta' }
    case 'reschedule_proposal':
      return { status: 'Reprogramación', title: `Nueva fecha propuesta para tu partido${withWho}`, action: 'Revisar fecha' }
    case 'schedule_proposal':
      return { status: 'Fecha propuesta', title: `Elige la fecha de tu partido${withWho}`, action: 'Revisar fecha' }
    case 'acceptance_change':
      return { status: 'Cambio propuesto', title: `Aceptaron tu partido${withWho} con otra fecha o lugar`, action: 'Revisar cambio' }
    case 'match_created':
      return { status: 'Partido confirmado', title: `Tu partido${withWho} está confirmado`, action: 'Ver partido' }
    default:
      return { status: 'Pendiente', title: `Tienes una novedad en tu partido${withWho}`, action: 'Ver partido' }
  }
}

/** Most urgent first; stable for equal priority (keeps the API's newest-first order). */
export function byUrgency<T extends PendingNotification>(list: readonly T[]): T[] {
  return list
    .map((n, i) => ({ n, i, p: PRIORITY[n.type ?? ''] ?? 9 }))
    .sort((a, b) => a.p - b.p || a.i - b.i)
    .map(x => x.n)
}

/** "6-4, 3-6, 10-7" → "6–4, 3–6, 10–7" (en dash between games only). */
export const formatScore = (score: string) => score.replace(/(\d)\s*-\s*(\d)/g, '$1–$2')

/**
 * Which lead panel Inicio shows. "Todo al día" is a claim about real data, so it needs
 * a completed fetch behind it: before the first successful load the empty list means
 * "unknown", not "nothing pending" (DESIGN.md §7, §9.5: skeleton, inline retry, empty).
 * A real pending action always wins; after one good load a failed poll keeps what we know.
 */
export type LeadPanelState = 'lead' | 'loading' | 'error' | 'clear'

export function leadPanelState(s: { hasLead: boolean; loaded: boolean; error: unknown }): LeadPanelState {
  if (s.hasLead) return 'lead'
  if (!s.loaded) return s.error ? 'error' : 'loading'
  return 'clear'
}
