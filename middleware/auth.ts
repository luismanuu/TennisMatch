export default defineNuxtRouteMiddleware((to) => {
  const { isAuthenticated } = useAuthState()
  if (!isAuthenticated.value) {
    return navigateTo({ path: '/sign-in', query: { redirect: to.fullPath } })
  }
})
