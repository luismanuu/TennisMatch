export default defineNuxtRouteMiddleware(async (to, from) => {
  // Only run on client side
  if (process.server) {
    return
  }
  
  const auth = useAuth()
  const { isLoaded: authLoaded, isSignedIn } = auth
  const { isLoaded: userLoaded, user } = useUser()
  
  // Wait for auth to be loaded (with timeout)
  let attempts = 0
  while (!authLoaded.value && attempts < 10) {
    await new Promise(resolve => setTimeout(resolve, 50))
    attempts++
  }
  
  // Check if user is signed in
  if (!isSignedIn.value) {
    return navigateTo('/admin/sign-in')
  }
  
  // Wait for user data to be loaded (with longer timeout for metadata)
  attempts = 0
  while (!userLoaded.value && attempts < 20) {
    await new Promise(resolve => setTimeout(resolve, 100))
    attempts++
  }
  
  // Additional wait for metadata to be available
  if (user.value && !user.value.publicMetadata) {
    attempts = 0
    while (!user.value.publicMetadata && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 100))
      attempts++
    }
  }
  
  // Check admin status from user metadata
  // Note: This is a client-side check for UX. Server-side API endpoints will verify admin status.
  const role = user.value?.publicMetadata?.role as string | undefined
  
  // Debug log in development
  if (process.dev) {
    console.log('[Admin Middleware]', {
      isSignedIn: isSignedIn.value,
      hasUser: !!user.value,
      userLoaded: userLoaded.value,
      role,
      publicMetadata: user.value?.publicMetadata,
      fullUser: user.value
    })
  }
  
  if (role !== 'admin') {
    // Redirect non-admins to home page
    console.warn('[Admin Middleware] User is not admin, redirecting to home. Role:', role)
    return navigateTo('/')
  }
})

