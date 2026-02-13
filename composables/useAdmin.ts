import type { Category, Match, PendingPlayer, Player } from '~/types'
import { useAuthState } from './useAuthState'

interface AdminInvitationRow {
  id: string
  name: string
  email: string
  category_id?: string | null
  category?: unknown
  clerk_invitation_id?: string
  status: string
  created_at: string
  updated_at: string
}

export const useAdmin = () => {
  const { userId } = useAuthState()
  const { user } = useUser()
  
  const loading = ref(false)
  const error = ref<Error | null>(null)
  const pendingPlayers = ref<PendingPlayer[]>([])
  const players = ref<Player[]>([])
  
  // Pagination state
  const pendingPlayersPage = ref(1)
  const pendingPlayersPageSize = ref(15)
  const pendingPlayersTotal = ref(0)
  
  const playersPage = ref(1)
  const playersPageSize = ref(15)
  const playersTotal = ref(0)
  
  const matchesPage = ref(1)
  const matchesPageSize = ref(15)
  const matchesTotal = ref(0)
  
  // Check if current user is admin
  const isAdmin = computed(() => {
    const role = user.value?.publicMetadata?.role as string | undefined
    return role === 'admin'
  })

  const toError = (err: unknown): Error =>
    err instanceof Error ? err : new Error(typeof err === 'string' ? err : 'Unknown error')

  // Fetch all pending invitations directly from Clerk (admin only)
  const fetchPendingPlayers = async (page?: number, pageSize?: number) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }
    
    if (page !== undefined) pendingPlayersPage.value = page
    if (pageSize !== undefined) pendingPlayersPageSize.value = pageSize
    
    loading.value = true
    error.value = null
    
    try {
      const offset = (pendingPlayersPage.value - 1) * pendingPlayersPageSize.value
      const data = await $fetch<{ invitations: AdminInvitationRow[]; allInvitations: AdminInvitationRow[]; total: number; page: number; page_size: number }>(
        `/api/admin/invitations?clerk_id=${userId.value}&limit=${pendingPlayersPageSize.value}&offset=${offset}`
      )
      // Transform to match PendingPlayer type for compatibility
      pendingPlayers.value = data.invitations.map(inv => ({
        id: inv.id,
        name: inv.name,
        email: inv.email,
        category_id: inv.category_id,
        category: inv.category,
        invited_by_player_id: null,
        invited_by_player: null,
        clerk_invitation_id: inv.clerk_invitation_id,
        invitation_token: null,
        status: inv.status,
        created_at: inv.created_at,
        updated_at: inv.updated_at
      })) as unknown as PendingPlayer[]
      pendingPlayersTotal.value = data.total || 0
      return pendingPlayers.value
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }
  
  // Resend invitation (using Clerk invitation ID)
  const resendInvitation = async (invitationId: string) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }
    
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<{ success: boolean; message: string; invitation_id: string }>(
        `/api/admin/invitations/${invitationId}/resend`,
        {
          method: 'POST',
          body: {
            clerk_id: userId.value
          }
        }
      )
      
      // Refresh pending players list after resending
      await fetchPendingPlayers()
      
      return data
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }
  
  // Invite a new player (admin only)
  const invitePlayer = async (payload: { name: string; email: string }) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }
    
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<{ success: boolean; message: string; pendingPlayer: PendingPlayer }>(
        '/api/admin/pending-players/invite',
        {
          method: 'POST',
          body: {
            clerk_id: userId.value,
            ...payload
          }
        }
      )
      
      // Refresh pending players list after inviting
      await fetchPendingPlayers()
      
      return data
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  // Store the last includeDeleted value
  const lastIncludeDeleted = ref(false)

  // Fetch all players (admin only)
  const fetchPlayers = async (includeDeleted: boolean = false, page?: number, pageSize?: number) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }
    
    if (page !== undefined) playersPage.value = page
    if (pageSize !== undefined) playersPageSize.value = pageSize
    
    lastIncludeDeleted.value = includeDeleted
    loading.value = true
    error.value = null
    
    try {
      const offset = (playersPage.value - 1) * playersPageSize.value
      const url = includeDeleted 
        ? `/api/admin/players?clerk_id=${userId.value}&include_deleted=true&limit=${playersPageSize.value}&offset=${offset}`
        : `/api/admin/players?clerk_id=${userId.value}&limit=${playersPageSize.value}&offset=${offset}`
      const data = await $fetch<{ data: Player[], total: number, page: number, page_size: number }>(url)
      players.value = data.data
      playersTotal.value = data.total || 0
      return data.data
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  // Delete an invitation (using Clerk invitation ID)
  const deletePendingPlayer = async (invitationId: string) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }
    
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<{ success: boolean; message: string; deletedInvitation: { id: string; name: string; email: string } }>(
        `/api/admin/invitations/${invitationId}`,
        {
          method: 'DELETE',
          body: {
            clerk_id: userId.value
          }
        }
      )
      
      // Refresh pending players list after deletion
      await fetchPendingPlayers()
      
      return data
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  // Sync invitations with Clerk (admin only)
  const syncInvitations = async () => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }
    
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<{
        success: boolean
        summary: {
          clerkTotal: number
          dbTotal: number
          clerkOnly: number
          dbOnly: number
          mismatched: number
          synced: number
        }
        details: {
          clerkOnlyInvitations: AdminInvitationRow[]
          dbOnlyInvitations: AdminInvitationRow[]
          mismatchedInvitations: AdminInvitationRow[]
        }
        actions: unknown[]
      }>('/api/admin/invitations/sync', {
        method: 'POST',
        body: {
          clerk_id: userId.value
        }
      })
      
      // Refresh pending players list after sync
      await fetchPendingPlayers()
      
      return data
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  // Delete a player (admin only) - soft delete
  const deletePlayer = async (playerId: string) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }
    
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<{ success: boolean; message: string; deletedPlayer: { id: string; name: string; status: string } }>(
        `/api/admin/players/${playerId}`,
        {
          method: 'DELETE',
          body: {
            clerk_id: userId.value
          }
        }
      )
      
      // Refresh players list after deletion
      await fetchPlayers()
      
      return data
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  // Restore a deleted player (admin only)
  const restorePlayer = async (playerId: string) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }
    
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<{ success: boolean; message: string; restoredPlayer: { id: string; name: string; status: string } }>(
        `/api/admin/players/${playerId}/restore`,
        {
          method: 'POST',
          body: {
            clerk_id: userId.value
          }
        }
      )
      
      // Refresh players list after restoration
      await fetchPlayers()
      
      return data
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }
  
  // Category management functions
  const categories = ref<Category[]>([])

  const fetchCategories = async () => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }
    
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<Category[]>(`/api/admin/categories?clerk_id=${userId.value}`)
      categories.value = data
      return data
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const createCategory = async (payload: { name: string; description?: string; order?: number; default_elo?: number }) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }
    
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<{ success: boolean; message: string; category: Category }>(
        '/api/admin/categories',
        {
          method: 'POST',
          body: {
            clerk_id: userId.value,
            ...payload
          }
        }
      )
      
      await fetchCategories()
      return data
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const updateCategory = async (categoryId: string, payload: { name?: string; description?: string; order?: number; default_elo?: number }) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }
    
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<{ success: boolean; message: string; category: Category }>(
        `/api/admin/categories/${categoryId}`,
        {
          method: 'PUT',
          body: {
            clerk_id: userId.value,
            ...payload
          }
        }
      )
      
      await fetchCategories()
      return data
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const deleteCategory = async (categoryId: string) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }
    
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<{ success: boolean; message: string; deletedCategory: { id: string; name: string } }>(
        `/api/admin/categories/${categoryId}`,
        {
          method: 'DELETE',
          body: {
            clerk_id: userId.value
          }
        }
      )
      
      await fetchCategories()
      return data
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const reorderCategories = async (categoryOrders: Array<{ id: string; order: number }>) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }
    
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<{ success: boolean; message: string; updated: number }>(
        '/api/admin/categories/reorder',
        {
          method: 'POST',
          body: {
            clerk_id: userId.value,
            category_orders: categoryOrders
          }
        }
      )
      
      await fetchCategories()
      return data
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  // Update a player (admin only)
  const updatePlayer = async (playerId: string, payload: { name?: string; phone_number?: string; category_id?: string; elo?: number }) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }
    
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<{ success: boolean; message: string; player: Player }>(
        `/api/admin/players/${playerId}`,
        {
          method: 'PUT',
          body: {
            clerk_id: userId.value,
            ...payload
          }
        }
      )
      
      // Refresh players list after update
      await fetchPlayers(lastIncludeDeleted.value)
      
      return data
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  // Fetch all matches (admin only)
  const allMatches = ref<Match[]>([])

  const fetchAllMatches = async (filters?: { status?: string; player_id?: string; start_date?: string; end_date?: string }, page?: number, pageSize?: number) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }
    
    if (page !== undefined) matchesPage.value = page
    if (pageSize !== undefined) matchesPageSize.value = pageSize
    
    loading.value = true
    error.value = null
    
    try {
      const offset = (matchesPage.value - 1) * matchesPageSize.value
      const queryParams = new URLSearchParams()
      queryParams.append('clerk_id', userId.value)
      queryParams.append('limit', matchesPageSize.value.toString())
      queryParams.append('offset', offset.toString())
      if (filters?.status) queryParams.append('status', filters.status)
      if (filters?.player_id) queryParams.append('player_id', filters.player_id)
      if (filters?.start_date) queryParams.append('start_date', filters.start_date)
      if (filters?.end_date) queryParams.append('end_date', filters.end_date)

      const data = await $fetch<{ data: Match[]; total: number; page: number; page_size: number }>(`/api/admin/matches?${queryParams.toString()}`)
      allMatches.value = data.data
      matchesTotal.value = data.total || 0
      return data.data
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  // Fetch statistics (admin only)
  const stats = ref<any>(null)

  const fetchStats = async () => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }
    
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<any>(`/api/admin/stats?clerk_id=${userId.value}`)
      stats.value = data
      return data
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  // Fallback matches state
  const fallbackMatches = ref<Match[]>([])
  const fallbackMatchesPage = ref(1)
  const fallbackMatchesPageSize = ref(15)
  const fallbackMatchesTotal = ref(0)

  // Fetch fallback matches (admin only)
  const fetchFallbackMatches = async (page?: number, pageSize?: number) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }
    
    if (page !== undefined) fallbackMatchesPage.value = page
    if (pageSize !== undefined) fallbackMatchesPageSize.value = pageSize
    
    loading.value = true
    error.value = null
    
    try {
      const offset = (fallbackMatchesPage.value - 1) * fallbackMatchesPageSize.value
      const data = await $fetch<{ data: Match[]; total: number; page: number; page_size: number }>(
        `/api/admin/matches/fallback?clerk_id=${userId.value}&limit=${fallbackMatchesPageSize.value}&offset=${offset}`
      )
      fallbackMatches.value = data.data
      fallbackMatchesTotal.value = data.total || 0
      return data.data
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  // Reprocess a single match (admin only)
  const reprocessMatch = async (matchId: string) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }
    
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<{
        success: boolean
        message: string
        match_id: string
        processed?: number
        errors?: number
        skipped?: number
        results?: Array<{
          match_id: string
          status: 'success' | 'error' | 'skipped'
          message: string
          error?: string
        }>
      }>(
        `/api/admin/matches/reprocess-fallback?clerk_id=${userId.value}&match_id=${matchId}`,
        {
          method: 'POST'
        }
      )
      
      // Refresh fallback matches list after reprocessing
      await fetchFallbackMatches()
      
      return data
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }
  
  // Organizer management functions
  const organizers = ref<any[]>([])
  const pendingOrganizerInvitations = ref<AdminInvitationRow[]>([])

  const organizersPage = ref(1)
  const organizersPageSize = ref(15)
  const organizersTotal = ref(0)
  const organizersPendingTotal = ref(0)

  const fetchOrganizers = async (page?: number, pageSize?: number) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }
    
    if (page !== undefined) organizersPage.value = page
    if (pageSize !== undefined) organizersPageSize.value = pageSize
    
    loading.value = true
    error.value = null
    
    try {
      const offset = (organizersPage.value - 1) * organizersPageSize.value
      const data = await $fetch<{ organizers: Record<string, unknown>[]; pendingInvitations: AdminInvitationRow[]; total: number; total_pending: number; page: number; page_size: number }>(
        `/api/admin/organizers?clerk_id=${userId.value}&limit=${organizersPageSize.value}&offset=${offset}`
      )
      organizers.value = data.organizers || []
      pendingOrganizerInvitations.value = data.pendingInvitations || []
      organizersTotal.value = data.total || 0
      organizersPendingTotal.value = data.total_pending || 0
      return data
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const inviteOrganizer = async (payload: { name: string; email: string }) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }
    
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<{ success: boolean; message: string; invitation: AdminInvitationRow }>(
        '/api/admin/organizers',
        {
          method: 'POST',
          body: {
            clerk_id: userId.value,
            ...payload
          }
        }
      )
      
      await fetchOrganizers()
      return data
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const deleteOrganizer = async (organizerId: string) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }
    
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<{ success: boolean; message: string }>(
        `/api/admin/organizers/${organizerId}`,
        {
          method: 'DELETE',
          query: {
            clerk_id: userId.value
          }
        }
      )
      
      await fetchOrganizers()
      return data
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    isAdmin: readonly(isAdmin),
    loading: readonly(loading),
    error: readonly(error),
    pendingPlayers: readonly(pendingPlayers),
    players: readonly(players),
    categories: readonly(categories),
    // Pagination state
    pendingPlayersPage: readonly(pendingPlayersPage),
    pendingPlayersPageSize: readonly(pendingPlayersPageSize),
    pendingPlayersTotal: readonly(pendingPlayersTotal),
    playersPage: readonly(playersPage),
    playersPageSize: readonly(playersPageSize),
    playersTotal: readonly(playersTotal),
    matchesPage: readonly(matchesPage),
    matchesPageSize: readonly(matchesPageSize),
    matchesTotal: readonly(matchesTotal),
    fallbackMatchesPage: readonly(fallbackMatchesPage),
    fallbackMatchesPageSize: readonly(fallbackMatchesPageSize),
    fallbackMatchesTotal: readonly(fallbackMatchesTotal),
    organizersPage: readonly(organizersPage),
    organizersPageSize: readonly(organizersPageSize),
    organizersTotal: readonly(organizersTotal),
    organizersPendingTotal: readonly(organizersPendingTotal),
    // Methods
    fetchPendingPlayers,
    resendInvitation,
    invitePlayer,
    fetchPlayers,
    deletePlayer,
    restorePlayer,
    deletePendingPlayer,
    syncInvitations,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
    updatePlayer,
    allMatches: readonly(allMatches),
    fetchAllMatches,
    stats: readonly(stats),
    fetchStats,
    fallbackMatches: readonly(fallbackMatches),
    fetchFallbackMatches,
    reprocessMatch,
    organizers: readonly(organizers),
    pendingOrganizerInvitations: readonly(pendingOrganizerInvitations),
    fetchOrganizers,
    inviteOrganizer,
    deleteOrganizer
  }
}

