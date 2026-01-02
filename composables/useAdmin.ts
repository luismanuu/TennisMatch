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

  // Fetch all players (admin only)
  const fetchPlayers = async () => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }
    
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<Player[]>(`/api/admin/players?clerk_id=${userId.value}`)
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

  // Delete a player (admin only)
  const deletePlayer = async (playerId: string) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }
    
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<{ success: boolean; message: string; deletedPlayer: { id: string; name: string } }>(
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
  
  return {
    isAdmin: readonly(isAdmin),
    loading: readonly(loading),
    error: readonly(error),
    pendingPlayers: readonly(pendingPlayers),
    players: readonly(players),
    fetchPendingPlayers,
    resendInvitation,
    invitePlayer,
    fetchPlayers,
    deletePlayer,
    deletePendingPlayer,
    syncInvitations
  }
}

