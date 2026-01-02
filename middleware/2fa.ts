export default defineNuxtRouteMiddleware((to, from) => {
  // Only run on client side
  if (process.server) {
    return
  }

  // Check if we're trying to access the 2FA route
  if (to.path.includes('factor-two') || to.fullPath.includes('factor-two')) {
    const auth = useAuth()
    const { isSignedIn } = auth

    // If accessing 2FA directly (not coming from sign-in page), always redirect
    if (from.path !== '/sign-in' && !from.path.includes('sign-in')) {
      // Clear any leftover session data
      sessionStorage.removeItem('clerk-2fa-initiated')
      sessionStorage.removeItem('clerk-2fa-code-sent')
      sessionStorage.removeItem('clerk-2fa-continue-existing')
      return navigateTo('/sign-in')
    }

    // Check if user is signed in
    if (!isSignedIn.value) {
      // Not signed in - check if they have started the CURRENT sign-in process
      const initiatedTimestamp = sessionStorage.getItem('clerk-2fa-initiated')
      const codeSentTimestamp = sessionStorage.getItem('clerk-2fa-code-sent')

      // Check if the sign-in session is recent (within last 30 minutes)
      const now = Date.now()
      const thirtyMinutes = 30 * 60 * 1000

      const hasRecentInitiated = initiatedTimestamp && (now - parseInt(initiatedTimestamp)) < thirtyMinutes
      const hasRecentCodeSent = codeSentTimestamp && (now - parseInt(codeSentTimestamp)) < thirtyMinutes

      const hasCurrentSignInSession = hasRecentInitiated || hasRecentCodeSent

      // Clear old session data (older than 30 minutes)
      if (initiatedTimestamp && !hasRecentInitiated) {
        sessionStorage.removeItem('clerk-2fa-initiated')
      }
      if (codeSentTimestamp && !hasRecentCodeSent) {
        sessionStorage.removeItem('clerk-2fa-code-sent')
      }

      if (!hasCurrentSignInSession) {
        return navigateTo('/sign-in')
      }

      // They have a current sign-in session, allow access to 2FA
      return
    }

    // User is already signed in - redirect to home
    return navigateTo('/')
  }
})
