export default defineNuxtPlugin(() => {
  const router = useRouter()
  const auth = useAuth()
  const { isSignedIn } = auth
  const { user } = useUser()
  
  // Track if user came from admin sign-in page
  let cameFromAdminSignIn = false
  
  // Check if we're coming from admin sign-in page
  if (process.client) {
    const fromPath = sessionStorage.getItem('admin-sign-in-redirect')
    if (fromPath === 'true') {
      cameFromAdminSignIn = true
      sessionStorage.removeItem('admin-sign-in-redirect')
    }
  }
  
  // Watch for sign-in completion - only redirect if came from admin sign-in
  watch([isSignedIn, () => user.value], ([signedIn, currentUser]) => {
    if (signedIn && currentUser && cameFromAdminSignIn) {
      const role = currentUser.publicMetadata?.role as string | undefined
      const currentPath = router.currentRoute.value.path
      
      // Only redirect if user came from admin sign-in page
      if (role === 'admin' && currentPath === '/') {
        router.replace('/admin')
        cameFromAdminSignIn = false
      }
    }
  }, { immediate: true })
  
  // Also check on route changes - but only if came from admin sign-in
  router.afterEach((to, from) => {
    // If coming from admin sign-in page, set the flag
    if (from.path === '/admin/sign-in') {
      cameFromAdminSignIn = true
      if (process.client) {
        sessionStorage.setItem('admin-sign-in-redirect', 'true')
      }
    }
    
    // Only redirect if we came from admin sign-in
    if (isSignedIn.value && user.value && cameFromAdminSignIn) {
      const role = user.value.publicMetadata?.role as string | undefined
      
      // If admin signs in from admin page and gets redirected to home, send them to admin
      if (role === 'admin' && to.path === '/') {
        router.replace('/admin')
        cameFromAdminSignIn = false
        if (process.client) {
          sessionStorage.removeItem('admin-sign-in-redirect')
        }
      }
    }
  })
})

