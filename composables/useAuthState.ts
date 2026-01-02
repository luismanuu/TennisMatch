/**
 * Shared authentication state composable
 * Provides consistent auth state across all pages to prevent navigation flickering
 */
export const useAuthState = () => {
  const auth = useAuth()
  const { isLoaded: authLoaded, isSignedIn, userId: clerkUserId } = auth
  const { isLoaded: userLoaded, user } = useUser()

  // Combined isLoaded - both auth and user must be loaded
  const isLoaded = computed(() => authLoaded.value && userLoaded.value)

  // Use userId from useAuth (preferred) or fallback to user.id
  const userId = computed(() => clerkUserId.value || user.value?.id || null)

  // Consistent authentication check
  // Use isSignedIn directly from Clerk (available immediately) to prevent flickering
  // Once signed in, navigation should remain stable
  const isAuthenticated = computed(() => {
    // If auth is loaded and signed in, user is authenticated
    if (authLoaded.value && isSignedIn.value) {
      return true
    }
    // If auth is loaded but not signed in, user is not authenticated
    if (authLoaded.value && !isSignedIn.value) {
      return false
    }
    // While loading, return false to show guest navigation
    // This prevents showing authenticated nav before we know for sure
    return false
  })

  return {
    isLoaded: readonly(isLoaded),
    isAuthenticated: readonly(isAuthenticated),
    userId: readonly(userId),
    user: readonly(user),
    isSignedIn: readonly(isSignedIn),
    authLoaded: readonly(authLoaded),
    userLoaded: readonly(userLoaded)
  }
}

