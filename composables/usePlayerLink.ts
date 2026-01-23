/**
 * Composable to generate player profile links with optional return path
 */
export const usePlayerLink = () => {
  const route = useRoute()
  
  /**
   * Generate a link to a player profile with optional return path
   * @param playerId - The player ID
   * @param includeFrom - Whether to include the current route as the 'from' parameter
   * @returns The player profile link
   */
  const getPlayerLink = (playerId: string, includeFrom: boolean = true): string => {
    if (includeFrom && process.client) {
      const currentPath = route.fullPath
      return `/players/${playerId}?from=${encodeURIComponent(currentPath)}`
    }
    return `/players/${playerId}`
  }
  
  return {
    getPlayerLink
  }
}
