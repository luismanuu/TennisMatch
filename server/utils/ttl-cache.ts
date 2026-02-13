type CacheEntry<T> = {
  value: Promise<T>
  expiresAt: number
}

const CACHE_KEY = '__tennismatch_ttl_cache__'

function getCacheMap(): Map<string, CacheEntry<unknown>> {
  const g = globalThis as typeof globalThis & {
    [CACHE_KEY]?: Map<string, CacheEntry<unknown>>
  }
  if (!g[CACHE_KEY]) {
    g[CACHE_KEY] = new Map<string, CacheEntry<unknown>>()
  }
  return g[CACHE_KEY]
}

/**
 * Simple in-memory TTL cache with promise coalescing.
 * - Best-effort: per-node-process only (fine for Nitro node-server).
 * - If factory rejects, cache entry is cleared so next call can retry.
 */
export async function getOrSetTtlCache<T>(
  key: string,
  ttlMs: number,
  factory: () => Promise<T>
): Promise<T> {
  const now = Date.now()
  const cache = getCacheMap()
  const existing = cache.get(key) as CacheEntry<T> | undefined

  if (existing && existing.expiresAt > now) {
    return await existing.value
  }

  const valuePromise = factory().catch((err) => {
    // don't cache failures
    cache.delete(key)
    throw err
  })

  cache.set(key, { value: valuePromise, expiresAt: now + ttlMs })
  return await valuePromise
}

