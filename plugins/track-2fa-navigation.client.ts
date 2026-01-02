export default defineNuxtPlugin(() => {
  if (!process.client) return

  const twoFactorCodeSentKey = 'clerk-2fa-code-sent'
  const twoFactorInitiatedKey = 'clerk-2fa-initiated'
  
  // SET UP FETCH INTERCEPTION FIRST - before anything else
  // This ensures we catch code-sending requests as early as possible
  const originalFetch = window.fetch
  window.fetch = async function(...args) {
    const url = args[0]?.toString() || ''
    const options = args[1] || {}
    const method = options.method || 'GET'

    // Log Clerk requests in development
    if (process.dev && url.includes('clerk') && method === 'POST') {
      console.log('🔍 Clerk POST request intercepted:', {
        url: url.toString(),
        method,
        pathname: window.location.pathname
      })
    }

    // Check if this is a POST request that sends a 2FA code
    const isCodeSendingRequest = url.includes('clerk') &&
                                 method === 'POST' &&
                                 (url.includes('prepare_second_factor') ||
                                  url.includes('prepare-second-factor') ||
                                  url.includes('prepareSecondFactor') ||
                                  (url.includes('/v1/client/sign_ins') && (url.includes('prepare') || url.includes('challenge'))) ||
                                  (url.includes('/v1/client') && url.includes('sign_ins') && url.includes('prepare')))

    if (isCodeSendingRequest) {
      const isOnFactorTwo = window.location.pathname.includes('factor-two') ||
                           window.location.hash.includes('factor-two')

      if (process.dev) {
        console.log('🔍 Code sending request detected:', {
          url: url.toString(),
          method,
          isOnFactorTwo,
          codeSentTimestamp: sessionStorage.getItem(twoFactorCodeSentKey),
          twoFactorInitiated: sessionStorage.getItem(twoFactorInitiatedKey)
        })
      }

      if (isOnFactorTwo) {
        const codeSentTimestamp = sessionStorage.getItem(twoFactorCodeSentKey)
        const twoFactorInitiated = sessionStorage.getItem(twoFactorInitiatedKey)
        const now = Date.now()
        const codeSentRecently = codeSentTimestamp && (now - parseInt(codeSentTimestamp)) < 10 * 60 * 1000

        // BLOCK the request if code was sent recently and this is NOT a new sign-in (no initiated flag)
        if (codeSentRecently && !twoFactorInitiated) {
          console.log('🚫 BLOCKED duplicate 2FA code send on page reload')

          // Return a mock response that matches what Clerk expects
          const mockResponse = {
            status: 'complete',
            response: {
              status: 'complete',
              supported_first_factors: [],
              supported_second_factors: [],
              id: null,
              identifier: null
            }
          }

          const response = new Response(JSON.stringify(mockResponse), {
            status: 200,
            statusText: 'OK',
            headers: new Headers({
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            })
          })

          Object.defineProperty(response, 'ok', { value: true, writable: false })
          Object.defineProperty(response, 'statusText', { value: 'OK', writable: false })

          return Promise.resolve(response)
        }
      }

      // If not blocked, proceed with the request and detect when code is sent
      try {
        const response = await originalFetch.apply(this, args)

        if (response.status === 200) {
          const clonedResponse = response.clone()
          const data = await clonedResponse.json().catch(() => null)

          if (data && (data.status || data.response)) {
            const isOnFactorTwo = window.location.pathname.includes('factor-two') ||
                                 window.location.hash.includes('factor-two')
            if (isOnFactorTwo) {
              sessionStorage.setItem(twoFactorCodeSentKey, Date.now().toString())
              if (process.dev) console.log('📧 2FA code was sent, marking timestamp')
              setTimeout(() => {
                sessionStorage.removeItem(twoFactorInitiatedKey)
              }, 2000)
            }
          }
        }

        return response
      } catch (error) {
        console.error('Error in fetch interception:', error)
        return originalFetch.apply(this, args)
      }
    }

    return originalFetch.apply(this, args)
  }
  
  const router = useRouter()
  
  // Detect if this is a page reload using Performance API
  const isPageReload = () => {
    try {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      if (navigation) {
        return navigation.type === 'reload'
      }
      // Fallback for older browsers
      return performance.navigation?.type === 1
    } catch {
      return false
    }
  }
  
  // Check initial load - if we're already on factor-two route
  const checkInitialLoad = () => {
    const currentPath = window.location.pathname
    const currentHash = window.location.hash

    if (currentPath.includes('factor-two') || currentHash.includes('factor-two')) {
      const isReload = isPageReload()
      const codeSentTimestamp = sessionStorage.getItem(twoFactorCodeSentKey)

      // Check if code was sent a long time ago (expired)
      const now = Date.now()
      const codeExpired = codeSentTimestamp && (now - parseInt(codeSentTimestamp)) > 10 * 60 * 1000

      if (codeExpired) {
        // Code has expired, clear flags to allow fresh attempt
        sessionStorage.removeItem(twoFactorCodeSentKey)
        sessionStorage.removeItem(twoFactorInitiatedKey)
        console.log('⏰ Code expired, clearing flags for fresh attempt')
        return
      }

      if (isReload && codeSentTimestamp) {
        // This is a reload on factor-two with existing code
        // Don't set initiated flag - this prevents code from being sent
        console.log('🔄 Initial page load detected as reload on factor-two, preventing code send')
        return
      }

      // If not a reload or no code sent, check if we should allow code sending
      // This would be set by navigation from sign-in
      if (!sessionStorage.getItem(twoFactorInitiatedKey)) {
        console.log('📍 On factor-two route but no initiated flag - likely direct access or reload')
      }
    }
  }
  
  // Check on plugin initialization
  checkInitialLoad()
  
  // Track when user navigates to factor-two route FROM sign-in (completing first factor)
  router.afterEach((to, from) => {
    // Check if user navigated to factor-two route
    if (to.path.includes('factor-two') || to.fullPath.includes('factor-two')) {
      // Check if this is a navigation from sign-in (user completed first factor)
      const isFromSignIn = from.path === '/sign-in' || 
                          (from.path.startsWith('/sign-in') && !from.path.includes('factor-two'))
      
      // Check if this is a reload
      // - No from.path means initial load
      // - Same path means reload
      // - Both paths include factor-two means reload
      const isReload = !from.path || 
                      from.path === to.path || 
                      (from.path.includes('factor-two') && to.path.includes('factor-two')) ||
                      isPageReload()
      
      if (!isReload && isFromSignIn) {
        // User successfully completed first factor and is now on 2FA
        // Mark that 2FA was initiated - this allows code to be sent
        sessionStorage.setItem(twoFactorInitiatedKey, 'true')
        console.log('✅ User completed sign-in, allowing 2FA code to be sent')
      } else if (isReload) {
        // This is a page reload - don't set initiated flag
        // This prevents code from being sent on reload
        console.log('🔄 Page reload detected on factor-two, preventing code send')
      }
    } else if (from.path && from.path.includes('factor-two') && !to.path.includes('factor-two')) {
      // User is leaving factor-two route
      // Clear flags when leaving to allow fresh sign-in attempts
      setTimeout(() => {
        sessionStorage.removeItem(twoFactorInitiatedKey)
        // Also clear code sent flag so user can start fresh next time
        sessionStorage.removeItem(twoFactorCodeSentKey)
        console.log('🧹 Cleared 2FA flags when leaving factor-two route')
      }, 1000)
    }
  })
  
})

