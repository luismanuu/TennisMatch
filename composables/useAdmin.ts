import type { PendingPlayer, Player } from '~/types'
import { useAuthState } from './useAuthState'

export const useAdmin = () => {
  const { userId } = useAuthState()
  const { role } = useAuthState()
  
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
    return role.value === 'admin'
  })
  
  // Fetch pending invitations (admin only)
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
      const data = await $fetch<{ invitations: any[], allInvitations: any[], total: number, page: number, page_size: number }>(
        `/api/admin/invitations?limit=${pendingPlayersPageSize.value}&offset=${offset}`
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
        invitation_token: null,
        status: inv.status,
        created_at: inv.created_at,
        updated_at: inv.updated_at
      })) as PendingPlayer[]
      pendingPlayersTotal.value = data.total || 0
      return pendingPlayers.value
    } catch (err: any) {
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }
  
  // Resend invitation (pending player id)
  const resendInvitation = async (invitationId: string) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }
    
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<{ success: boolean; message: string; invitation_id: string; invitation_url?: string; email_sent?: boolean }>(
        `/api/admin/invitations/${invitationId}/resend`,
        {
          method: 'POST',
          body: {
          }
        }
      )
      
      // Refresh pending players list after resending
      await fetchPendingPlayers()
      
      return data
    } catch (err: any) {
      error.value = err
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
      const data = await $fetch<{ success: boolean; message: string; pendingPlayer: PendingPlayer; invitation_url?: string; email_sent?: boolean }>(
        '/api/admin/pending-players/invite',
        {
          method: 'POST',
          body: {
            ...payload
          }
        }
      )
      
      // Refresh pending players list after inviting
      await fetchPendingPlayers()
      
      return data
    } catch (err: any) {
      error.value = err
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
        ? `/api/admin/players?include_deleted=true&limit=${playersPageSize.value}&offset=${offset}`
        : `/api/admin/players?limit=${playersPageSize.value}&offset=${offset}`
      const data = await $fetch<{ data: Player[], total: number, page: number, page_size: number }>(url)
      players.value = data.data
      playersTotal.value = data.total || 0
      return data.data
    } catch (err: any) {
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }

  // Revoke an invitation (pending player id)
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
          }
        }
      )
      
      // Refresh pending players list after deletion
      await fetchPendingPlayers()
      
      return data
    } catch (err: any) {
      error.value = err
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
          }
        }
      )
      
      // Refresh players list after deletion
      await fetchPlayers()
      
      return data
    } catch (err: any) {
      error.value = err
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
          }
        }
      )
      
      // Refresh players list after restoration
      await fetchPlayers()
      
      return data
    } catch (err: any) {
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }
  
  // Category management functions
  const categories = ref<any[]>([])

  const fetchCategories = async () => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }
    
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<any[]>(`/api/admin/categories`)
      categories.value = data
      return data
    } catch (err: any) {
      error.value = err
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
      const data = await $fetch<{ success: boolean; message: string; category: any }>(
        '/api/admin/categories',
        {
          method: 'POST',
          body: {
            ...payload
          }
        }
      )
      
      await fetchCategories()
      return data
    } catch (err: any) {
      error.value = err
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
      const data = await $fetch<{ success: boolean; message: string; category: any }>(
        `/api/admin/categories/${categoryId}`,
        {
          method: 'PUT',
          body: {
            ...payload
          }
        }
      )
      
      await fetchCategories()
      return data
    } catch (err: any) {
      error.value = err
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
          }
        }
      )
      
      await fetchCategories()
      return data
    } catch (err: any) {
      error.value = err
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
            category_orders: categoryOrders
          }
        }
      )
      
      await fetchCategories()
      return data
    } catch (err: any) {
      error.value = err
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
            ...payload
          }
        }
      )
      
      // Refresh players list after update
      await fetchPlayers(lastIncludeDeleted.value)
      
      return data
    } catch (err: any) {
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }

  // Fetch all matches (admin only)
  const allMatches = ref<any[]>([])

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
      queryParams.append('limit', matchesPageSize.value.toString())
      queryParams.append('offset', offset.toString())
      if (filters?.status) queryParams.append('status', filters.status)
      if (filters?.player_id) queryParams.append('player_id', filters.player_id)
      if (filters?.start_date) queryParams.append('start_date', filters.start_date)
      if (filters?.end_date) queryParams.append('end_date', filters.end_date)

      const data = await $fetch<{ data: any[], total: number, page: number, page_size: number }>(`/api/admin/matches?${queryParams.toString()}`)
      allMatches.value = data.data
      matchesTotal.value = data.total || 0
      return data.data
    } catch (err: any) {
      error.value = err
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
      const data = await $fetch<any>(`/api/admin/stats`)
      stats.value = data
      return data
    } catch (err: any) {
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }

  // Organizer management functions
  const organizers = ref<any[]>([])
  const pendingOrganizerInvitations = ref<any[]>([])

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
      const data = await $fetch<{ organizers: any[]; pendingInvitations: any[]; total: number; total_pending: number; page: number; page_size: number }>(
        `/api/admin/organizers?limit=${organizersPageSize.value}&offset=${offset}`
      )
      organizers.value = data.organizers || []
      pendingOrganizerInvitations.value = data.pendingInvitations || []
      organizersTotal.value = data.total || 0
      organizersPendingTotal.value = data.total_pending || 0
      return data
    } catch (err: any) {
      error.value = err
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
      const data = await $fetch<{ success: boolean; message: string; invitation: any }>(
        '/api/admin/organizers',
        {
          method: 'POST',
          body: {
            ...payload
          }
        }
      )
      
      await fetchOrganizers()
      return data
    } catch (err: any) {
      error.value = err
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
          }
        }
      )
      
      await fetchOrganizers()
      return data
    } catch (err: any) {
      error.value = err
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
    organizers: readonly(organizers),
    pendingOrganizerInvitations: readonly(pendingOrganizerInvitations),
    fetchOrganizers,
    inviteOrganizer,
    deleteOrganizer
  }
}

