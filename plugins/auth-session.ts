import type { AuthUser } from '~/utils/auth-client'

// Loads the Better Auth session once per page load. On the server the request cookies are forwarded,
// so SSR and route middleware see the same user the API will see.
export default defineNuxtPlugin(async () => {
  const user = useState<AuthUser | null>('auth-user', () => null)
  const loaded = useState<boolean>('auth-loaded', () => false)
  if (loaded.value) {
    return
  }
  try {
    const data = await useRequestFetch()<{ user: AuthUser } | null>('/api/auth/get-session')
    user.value = data?.user ?? null
  } catch {
    user.value = null
  } finally {
    loaded.value = true
  }
})
