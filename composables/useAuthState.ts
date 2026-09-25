import type { AuthUser } from '~/utils/auth-client'

export const useAuthState = () => {
  const user = useState<AuthUser | null>('auth-user', () => null)
  const isLoaded = useState<boolean>('auth-loaded', () => false)

  const isAuthenticated = computed(() => user.value !== null)
  const userId = computed(() => user.value?.id ?? null)
  const role = computed(() => user.value?.role ?? null)

  async function refresh() {
    const data = await $fetch<{ user: AuthUser } | null>('/api/auth/get-session').catch(() => null)
    user.value = data?.user ?? null
    isLoaded.value = true
    return user.value
  }

  async function signOut() {
    await authClient.signOut()
    user.value = null
    await navigateTo('/sign-in')
  }

  return {
    isLoaded: readonly(isLoaded),
    authLoaded: readonly(isLoaded),
    isAuthenticated,
    isSignedIn: isAuthenticated,
    userId,
    user: readonly(user),
    role,
    refresh,
    signOut,
  }
}
