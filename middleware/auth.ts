export default defineNuxtRouteMiddleware((to, from) => {
  const auth = useAuth()
  const { isSignedIn } = auth
  
  if (!isSignedIn.value) {
    return navigateTo('/sign-in')
  }
})

