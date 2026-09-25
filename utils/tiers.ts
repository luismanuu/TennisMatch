/** Rating tiers as shown to players (Spanish names match RatingTierBadge). */
export const TIERS = [
  { tier: 'Bronze', name: 'Bronce', minElo: 1, maxElo: 1499 },
  { tier: 'Silver', name: 'Plata', minElo: 1500, maxElo: 1999 },
  { tier: 'Gold', name: 'Oro', minElo: 2000, maxElo: 2499 },
  { tier: 'Platinum', name: 'Platino', minElo: 2500, maxElo: 2999 },
  { tier: 'Diamond', name: 'Diamante', minElo: 3000, maxElo: 3499 },
  { tier: 'Master', name: 'Maestro', minElo: 3500, maxElo: 3999 },
  { tier: 'Grandmaster', name: 'Gran Maestro', minElo: 4000, maxElo: Infinity }
] as const

const NAMES: Record<string, string> = Object.fromEntries(TIERS.map(t => [t.tier, t.name]))
NAMES.Top100 = 'Top 100'

/** Spanish display name for an internal tier key ("Gold" → "Oro"); unknown keys pass through. */
export const tierName = (tier: string | null | undefined) => (tier ? NAMES[tier] ?? tier : '')
