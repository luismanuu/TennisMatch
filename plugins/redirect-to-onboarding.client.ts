export default defineNuxtPlugin(() => {
  const router = useRouter()
  const { isAuthenticated, userId } = useAuthState()
  const { player, fetchPlayer, loading: playerLoading } = usePlayer()
  
  // Track if we've already checked to prevent multiple redirects
  let hasCheckedOnboarding = false
  
  // Watch for when user becomes authenticated (after sign-up or sign-in)
  watch([isAuthenticated, userId], async ([authenticated, currentUserId]) => {
    if (!authenticated || !currentUserId || hasCheckedOnboarding) return
    
    const currentPath = router.currentRoute.value.path
    
    // Don't redirect if already on onboarding, sign-up, sign-in, or invitation pages
    if (
      currentPath === '/onboarding' ||
      currentPath.startsWith('/sign-up') ||
      currentPath.startsWith('/sign-in') ||
      currentPath.startsWith('/invitation/') ||
      currentPath.startsWith('/admin')
    ) {
      return
    }
    
    // Wait a bit for the session to settle
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Check if user has a player profile
    try {
      await fetchPlayer(currentUserId)
      
      // If no player profile exists, redirect to onboarding
      if (!player.value && !playerLoading.value) {
        hasCheckedOnboarding = true
        console.log('🔄 Redirecting new user to onboarding')
        await navigateTo('/onboarding', { replace: true })
      } else {
        hasCheckedOnboarding = true
      }
    } catch (error) {
      // If there's an error fetching player, assume profile doesn't exist
      // and redirect to onboarding
      console.log('Error fetching player profile, redirecting to onboarding:', error)
      if (!hasCheckedOnboarding) {
        hasCheckedOnboarding = true
        await navigateTo('/onboarding', { replace: true })
      }
    }
  }, { immediate: false })
  
  // Also check on route changes to home page
  router.afterEach(async (to) => {
    // Only check if going to home page and user is authenticated
    if (to.path === '/' && isAuthenticated.value && userId.value && !hasCheckedOnboarding) {
      // Wait a bit for any pending operations
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Check if user has a player profile
      try {
        await fetchPlayer(userId.value)
        
        // If no player profile exists, redirect to onboarding
        if (!player.value && !playerLoading.value) {
          hasCheckedOnboarding = true
          console.log('🔄 Redirecting new user to onboarding from home page')
          await navigateTo('/onboarding', { replace: true })
        } else {
          hasCheckedOnboarding = true
        }
      } catch (error) {
        // If there's an error, assume profile doesn't exist
        if (!hasCheckedOnboarding) {
          hasCheckedOnboarding = true
          await navigateTo('/onboarding', { replace: true })
        }
      }
    }
  })
})
