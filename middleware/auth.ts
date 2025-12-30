export default defineNuxtRouteMiddleware((to, from) => {
  const { isSignedIn } = useClerk()
  
  if (!isSignedIn.value) {
    return navigateTo('/sign-in')
  }
})

