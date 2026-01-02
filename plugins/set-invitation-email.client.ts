export default defineNuxtPlugin(() => {
  // This plugin runs on client-side only, before Clerk initializes
  // It ensures the invitation email is set in Clerk's state before any components render
  
  if (process.client) {
    const route = useRoute()
    const emailFromQuery = route.query.email as string | undefined
    const invitationToken = route.query.invitation_token as string | undefined
    
    // Only store email if we have BOTH email and invitation_token (coming from invitation)
    if (emailFromQuery && invitationToken) {
      // Clear any existing Clerk sign-up state that might have a different email
      try {
        // Clear sessionStorage
        const sessionKeys = Object.keys(sessionStorage).filter(key => 
          key.startsWith('__clerk') && 
          (key.includes('sign-up') || key.includes('signup') || key.includes('email'))
        )
        sessionKeys.forEach(key => sessionStorage.removeItem(key))
        
        // Clear localStorage sign-up related keys
        const localKeys = Object.keys(localStorage).filter(key => 
          key.startsWith('__clerk') && 
          (key.includes('sign-up') || key.includes('signup') || key.includes('email'))
        )
        localKeys.forEach(key => localStorage.removeItem(key))
        
        // Store the invitation email so it can be used by Clerk components
        sessionStorage.setItem('__invitation_email', emailFromQuery)
        sessionStorage.setItem('__invitation_token', invitationToken)
        
        console.log('[Invitation Email Plugin] Set invitation email:', emailFromQuery)
      } catch (e) {
        console.warn('[Invitation Email Plugin] Could not clear Clerk cache:', e)
      }
    } else {
      // If no invitation, clear any stored invitation email and Clerk cache
      try {
        sessionStorage.removeItem('__invitation_email')
        sessionStorage.removeItem('__invitation_token')
        
        // Also clear Clerk's sign-up cache to prevent showing old email
        const sessionKeys = Object.keys(sessionStorage).filter(key => 
          key.startsWith('__clerk') && 
          (key.includes('sign-up') || key.includes('signup') || key.includes('email'))
        )
        sessionKeys.forEach(key => sessionStorage.removeItem(key))
        
        const localKeys = Object.keys(localStorage).filter(key => 
          key.startsWith('__clerk') && 
          (key.includes('sign-up') || key.includes('signup') || key.includes('email'))
        )
        localKeys.forEach(key => localStorage.removeItem(key))
      } catch (e) {
        // Ignore errors
      }
    }
  }
})

