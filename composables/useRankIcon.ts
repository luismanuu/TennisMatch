import type { RatingTier } from '~/types'

/**
 * Get the PNG icon path for a given tier
 * @param tier - The rating tier
 * @returns The path to the PNG icon, or null if tier is invalid
 */
export function useRankIcon(tier: RatingTier | string | null | undefined): string | null {
  if (!tier) {
    return null
  }

  const tierMap: Record<string, string> = {
    'Bronze': '/images/ranks/bronze.png',
    'Silver': '/images/ranks/silver.png',
    'Gold': '/images/ranks/gold.png',
    'Platinum': '/images/ranks/platinum.png',
    'Diamond': '/images/ranks/diamond.png',
    'Master': '/images/ranks/master.png',
    'Grandmaster': '/images/ranks/grandmaster.png',
    'Unrated': '/images/ranks/unrated.png'
  }

  return tierMap[tier] || tierMap['Unrated'] || null
}

/**
 * Get the PNG icon path using Nuxt asset handling
 * @param tier - The rating tier
 * @returns The asset path for the PNG icon (relative to public folder)
 */
export function useRankIconAsset(tier: RatingTier | string | null | undefined): string | null {
  if (!tier) {
    return null
  }

  const tierMap: Record<string, string> = {
    'Bronze': '/images/ranks/bronze.png',
    'Silver': '/images/ranks/silver.png',
    'Gold': '/images/ranks/gold.png',
    'Platinum': '/images/ranks/platinum.png',
    'Diamond': '/images/ranks/diamond.png',
    'Master': '/images/ranks/master.png',
    'Grandmaster': '/images/ranks/grandmaster.png',
    'Unrated': '/images/ranks/unrated.png'
  }

  return tierMap[tier] || tierMap['Unrated'] || null
}
