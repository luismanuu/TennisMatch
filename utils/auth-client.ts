import { createAuthClient } from 'better-auth/vue'
import { inferAdditionalFields } from 'better-auth/client/plugins'

export const authClient = createAuthClient({
  plugins: [inferAdditionalFields({ user: { role: { type: 'string', required: false, input: false } } })],
})

export type AuthUser = {
  id: string
  name: string
  email: string
  emailVerified: boolean
  role: 'player' | 'admin' | 'tournament_organizer'
}
