import type { PendingPlayer, Player } from '~/types'
import { useAuthState } from './useAuthState'

export const useAdmin = () => {
  const { userId } = useAuthState()
  const { user } = useUser()
  
  const loading = ref(false)
  const error = ref<Error | null>(null)
  const pendingPlayers = ref<PendingPlayer[]>([])
  const players = ref<Player[]>([])
  
  // Check if current user is admin
  const isAdmin = computed(() => {
    const role = user.value?.publicMetadata?.role as string | undefined
    return role === 'admin'
  })
  
  // Fetch all pending invitations directly from Clerk (admin only)
  const fetchPendingPlayers = async () => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }
    
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<{ invitations: any[], allInvitations: any[], total: number }>(
        `/api/admin/invitations?clerk_id=${userId.value}`
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
      })) as PendingPlayer[]
      return pendingPlayers.value
    } catch (err: any) {
      error.value = err
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
  const fetchPlayers = async (includeDeleted: boolean = false) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }
    
    lastIncludeDeleted.value = includeDeleted
    loading.value = true
    error.value = null
    
    try {
      const url = includeDeleted 
        ? `/api/admin/players?clerk_id=${userId.value}&include_deleted=true`
        : `/api/admin/players?clerk_id=${userId.value}`
      const data = await $fetch<Player[]>(url)
      players.value = data
      return data
    } catch (err: any) {
      error.value = err
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
    } catch (err: any) {
      error.value = err
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
          clerkOnlyInvitations: any[]
          dbOnlyInvitations: any[]
          mismatchedInvitations: any[]
        }
        actions: any[]
      }>('/api/admin/invitations/sync', {
        method: 'POST',
        body: {
          clerk_id: userId.value
        }
      })
      
      // Refresh pending players list after sync
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
            clerk_id: userId.value
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
            clerk_id: userId.value
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
      const data = await $fetch<any[]>(`/api/admin/categories?clerk_id=${userId.value}`)
      categories.value = data
      return data
    } catch (err: any) {
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }

  const createCategory = async (payload: { name: string; description?: string; order?: number }) => {
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
            clerk_id: userId.value,
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

  const updateCategory = async (categoryId: string, payload: { name?: string; description?: string; order?: number }) => {
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
            clerk_id: userId.value,
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
            clerk_id: userId.value
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
            clerk_id: userId.value,
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
            clerk_id: userId.value,
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

  const fetchAllMatches = async (filters?: { status?: string; player_id?: string; start_date?: string; end_date?: string }) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }
    
    loading.value = true
    error.value = null
    
    try {
      const queryParams = new URLSearchParams()
      queryParams.append('clerk_id', userId.value)
      if (filters?.status) queryParams.append('status', filters.status)
      if (filters?.player_id) queryParams.append('player_id', filters.player_id)
      if (filters?.start_date) queryParams.append('start_date', filters.start_date)
      if (filters?.end_date) queryParams.append('end_date', filters.end_date)

      const data = await $fetch<any[]>(`/api/admin/matches?${queryParams.toString()}`)
      allMatches.value = data
      return data
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
      const data = await $fetch<any>(`/api/admin/stats?clerk_id=${userId.value}`)
      stats.value = data
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
    fetchStats
  }
}

