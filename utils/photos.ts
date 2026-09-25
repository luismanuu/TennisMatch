/**
 * Photo registry (DESIGN.md §8). One source: design/mock/photos/credits.json.
 * Every photo is a reference placeholder (`verifiedVenueId: null`); never imply it
 * shows the venue named next to it. Files live in public/images/photos.
 */
import registry from '~/design/mock/photos/credits.json'

export interface PhotoCredit {
  file: string
  author: string
  license: string
  page: string
  focalPoint: string
  description: string
  usage: string
  verifiedVenueId: string | null
}

export type PhotoKey = 'hero' | 'clayday' | 'bluenight' | 'claynight' | 'aerial'

export const PHOTOS = registry as Record<PhotoKey, PhotoCredit>

export const photoSrc = (key: PhotoKey) => `/images/photos/${key}.jpg`

/** CC license deed URL for a registry license string such as "CC BY-SA 3.0". */
export const licenseUrl = (license: string) =>
  `https://creativecommons.org/licenses/by-sa/${license.trim().endsWith('4.0') ? '4.0' : '3.0'}/`
