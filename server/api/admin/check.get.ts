import { requireAdmin } from '~/server/utils/session'

// Like every route under /api/admin, this answers only admins: 401 without a session, 403 for any
// other role. A 200 therefore always means isAdmin: true.
export default defineEventHandler(async (event) => {
  const user = await requireAdmin(event)

  return {
    isAdmin: user.role === 'admin',
    userId: user.id,
    role: user.role
  }
})
