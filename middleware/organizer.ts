// UX only: every organizer API route checks the role on the server.
export default defineNuxtRouteMiddleware((to) => {
  const { isAuthenticated, role } = useAuthState()
  if (!isAuthenticated.value) {
    return navigateTo({ path: '/sign-in', query: { redirect: to.fullPath } })
  }
  if (role.value !== 'tournament_organizer') {
    return navigateTo('/')
  }
})
