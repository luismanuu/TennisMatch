// UX only: every admin API route checks the role on the server.
export default defineNuxtRouteMiddleware(() => {
  const { isAuthenticated, role } = useAuthState()
  if (!isAuthenticated.value) {
    return navigateTo('/admin/sign-in')
  }
  if (role.value !== 'admin') {
    return navigateTo('/')
  }
})
