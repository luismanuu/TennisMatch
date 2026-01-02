export default defineNuxtPlugin(() => {
  const router = useRouter()
  const { isAuthenticated, userId } = useAuthState()

  // Watch for when user becomes authenticated (after sign-up)
  watch(isAuthenticated, async (authenticated) => {
    if (!authenticated || !userId.value) return

    // Check if we're on the invitation page - if so, the invitation page will handle it
    const currentPath = router.currentRoute.value.path
    if (currentPath.startsWith('/invitation/')) {
      return
    }

    // Check if user just signed up via Clerk invitation
    // We'll check by trying to accept any pending invitation for this user's email
    try {
      const response = await $fetch('/api/pending-players/accept-by-email', {
        method: 'POST',
        body: {
          clerk_id: userId.value
        }
      })

      if (response.hasInvitation && response.success) {
        console.log('✅ Automatically accepted invitation after sign-up')
        // Optionally redirect to profile or show a success message
        // The invitation page will handle this if user is redirected there
      }
    } catch (error) {
      // No pending invitation found or error - that's okay
      // User might be signing up normally, not from an invitation
      console.log('No pending invitation found or error:', error)
    }
  }, { immediate: false })
})

