<template>
  <div class="min-h-screen">
    <!-- Navigation -->
    <AppNavigation />
    
    <!-- Spacer for fixed nav -->
    <div class="h-16"></div>

    <div class="section-padding">
      <div class="container-medium px-6">
        <!-- Header -->
        <div class="text-center mb-12">
          <h1 class="text-size-1 font-semibold text-foreground mb-4">
            Admin Dashboard
          </h1>
          <p class="text-size-3 font-regular text-foreground-muted">
            Manage players, pending invitations, and system administration
          </p>
        </div>


        <!-- Tabs -->
        <div class="flex gap-4 mb-8 border-b border-border">
          <button
            @click="activeTab = 'pending'"
            :class="[
              'px-6 py-3 text-size-3 font-semibold border-b-2 transition-colors',
              activeTab === 'pending'
                ? 'border-accent text-foreground'
                : 'border-transparent text-foreground-muted hover:text-foreground'
            ]"
          >
            Pending Players
          </button>
          <button
            @click="activeTab = 'players'"
            :class="[
              'px-6 py-3 text-size-3 font-semibold border-b-2 transition-colors',
              activeTab === 'players'
                ? 'border-accent text-foreground'
                : 'border-transparent text-foreground-muted hover:text-foreground'
            ]"
          >
            All Players
          </button>
        </div>

        <!-- Pending Players Tab -->
        <div v-show="activeTab === 'pending'">
        <!-- Invite Player Form -->
        <div class="glass-card-elevated p-6 mb-8">
          <h2 class="text-size-2 font-semibold text-foreground mb-4">Invite New Player</h2>
          <form @submit.prevent="handleInvite" class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-size-4 font-semibold text-foreground mb-2">
                  Name *
                </label>
                <input
                  v-model="inviteForm.name"
                  type="text"
                  required
                  class="w-full px-4 py-2 rounded-lg bg-surface border-2 border-border text-foreground focus:border-accent focus:outline-none"
                  placeholder="Player name"
                />
              </div>
              <div>
                <label class="block text-size-4 font-semibold text-foreground mb-2">
                  Email *
                </label>
                <input
                  v-model="inviteForm.email"
                  type="email"
                  required
                  class="w-full px-4 py-2 rounded-lg bg-surface border-2 border-border text-foreground focus:border-accent focus:outline-none"
                  placeholder="player@example.com"
                />
              </div>
            </div>
            <div class="flex items-center gap-4">
              <button
                type="submit"
                :disabled="inviting || !inviteForm.name || !inviteForm.email"
                class="btn-primary text-size-4 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span v-if="inviting">Sending Invitation...</span>
                <span v-else>Send Invitation</span>
              </button>
              <button
                type="button"
                @click="resetInviteForm"
                class="btn-secondary text-size-4"
              >
                Clear
              </button>
            </div>
          </form>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="glass-card-elevated p-12 text-center">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
          <p class="text-size-4 font-regular text-foreground-muted mt-4">Loading pending players...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="glass-card-elevated p-8">
          <div class="flex items-center gap-4 mb-4">
            <div class="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
              <span class="text-2xl">⚠️</span>
            </div>
            <div>
              <h3 class="text-size-2 font-semibold text-foreground mb-1">Error</h3>
              <p class="text-size-4 font-regular text-foreground-muted">{{ error.message || 'An error occurred' }}</p>
            </div>
          </div>
          <button @click="loadPendingPlayers" class="btn-primary text-size-4">
            Retry
          </button>
        </div>

        <!-- Success Message -->
        <div v-if="successMessage" class="glass-card-elevated p-4 mb-6 bg-green-500/10 border border-green-500/20">
          <div class="flex items-center gap-3">
            <span class="text-xl">✅</span>
            <p class="text-size-4 font-regular text-foreground">{{ successMessage }}</p>
          </div>
        </div>

        <!-- Invite Error Message -->
        <div v-if="inviteError" class="glass-card-elevated p-4 mb-6 bg-red-500/10 border border-red-500/20">
          <div class="flex items-center gap-3">
            <span class="text-xl">⚠️</span>
            <p class="text-size-4 font-regular text-red-400">{{ inviteError }}</p>
          </div>
        </div>

        <!-- Pending Players Table -->
        <div v-else-if="pendingPlayers.length > 0" class="glass-card-elevated overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-surface border-b border-border-subtle">
                <tr>
                  <th class="text-left p-4 text-size-4 font-semibold text-foreground">Name</th>
                  <th class="text-left p-4 text-size-4 font-semibold text-foreground">Email</th>
                  <th class="text-left p-4 text-size-4 font-semibold text-foreground">Category</th>
                  <th class="text-left p-4 text-size-4 font-semibold text-foreground">Status</th>
                  <th class="text-left p-4 text-size-4 font-semibold text-foreground">Invited By</th>
                  <th class="text-left p-4 text-size-4 font-semibold text-foreground">Created</th>
                  <th class="text-left p-4 text-size-4 font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr 
                  v-for="player in pendingPlayers" 
                  :key="player.id"
                  class="border-b border-border-subtle hover:bg-surface/50 transition-colors"
                >
                  <td class="p-4 text-size-4 font-regular text-foreground">{{ player.name }}</td>
                  <td class="p-4 text-size-4 font-regular text-foreground">{{ player.email }}</td>
                  <td class="p-4 text-size-4 font-regular text-foreground">
                    {{ player.category?.name || 'N/A' }}
                  </td>
                  <td class="p-4">
                    <span 
                      :class="[
                        'px-3 py-1 rounded-lg text-size-4 font-semibold',
                        player.status === 'pending' ? 'bg-yellow-500/20 text-yellow-600' :
                        player.status === 'accepted' ? 'bg-green-500/20 text-green-600' :
                        'bg-red-500/20 text-red-600'
                      ]"
                    >
                      {{ player.status }}
                    </span>
                  </td>
                  <td class="p-4 text-size-4 font-regular text-foreground">
                    {{ player.invited_by_player?.name || 'N/A' }}
                  </td>
                  <td class="p-4 text-size-4 font-regular text-foreground-muted">
                    {{ formatDate(player.created_at) }}
                  </td>
                  <td class="p-4">
                    <div class="flex gap-2">
                      <button
                        v-if="player.status === 'pending' && !(player as any).revoked"
                        @click="handleResend(player.clerk_invitation_id || player.id)"
                        :disabled="loading || resendingIds.has(player.clerk_invitation_id || player.id) || deletingPendingIds.has(player.clerk_invitation_id || player.id)"
                        class="btn-primary text-size-4 !py-2 !px-4 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span v-if="resendingIds.has(player.clerk_invitation_id || player.id)">Sending...</span>
                        <span v-else>Resend</span>
                      </button>
                      <button
                        @click="handleDeletePending(player.clerk_invitation_id || player.id, player.name, player.email)"
                        :disabled="loading || deletingPendingIds.has(player.clerk_invitation_id || player.id) || resendingIds.has(player.clerk_invitation_id || player.id)"
                        class="btn-danger text-size-4 !py-2 !px-4 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span v-if="deletingPendingIds.has(player.clerk_invitation_id || player.id)">Deleting...</span>
                        <span v-else>Delete</span>
                      </button>
                      <span v-if="player.status !== 'pending' || (player as any).revoked" class="text-size-4 font-regular text-foreground-muted flex items-center">
                        {{ (player as any).revoked ? 'Revoked' : player.status === 'accepted' ? 'Accepted' : 'Expired' }}
                      </span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="glass-card-elevated p-12 text-center">
          <div class="w-16 h-16 rounded-2xl bg-accent-subtle flex items-center justify-center mx-auto mb-4">
            <span class="text-3xl">📭</span>
          </div>
          <h3 class="text-size-2 font-semibold text-foreground mb-2">No Pending Players</h3>
          <p class="text-size-4 font-regular text-foreground-muted">
            There are no pending player invitations at this time.
          </p>
        </div>
        </div>

        <!-- All Players Tab -->
        <div v-show="activeTab === 'players'">
          <!-- Loading State -->
          <div v-if="loading" class="glass-card-elevated p-12 text-center">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
            <p class="text-size-4 font-regular text-foreground-muted mt-4">Loading players...</p>
          </div>

          <!-- Error State -->
          <div v-else-if="error" class="glass-card-elevated p-8">
            <div class="flex items-center gap-4 mb-4">
              <div class="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
                <span class="text-2xl">⚠️</span>
              </div>
              <div>
                <h3 class="text-size-2 font-semibold text-foreground mb-1">Error</h3>
                <p class="text-size-4 font-regular text-foreground-muted">{{ error.message || 'An error occurred' }}</p>
              </div>
            </div>
            <button @click="loadPlayers" class="btn-primary text-size-4">
              Retry
            </button>
          </div>

          <!-- Success Message -->
          <div v-if="successMessage" class="glass-card-elevated p-4 mb-6 bg-green-500/10 border border-green-500/20">
            <div class="flex items-center gap-3">
              <span class="text-xl">✅</span>
              <p class="text-size-4 font-regular text-foreground">{{ successMessage }}</p>
            </div>
          </div>

          <!-- Players Table -->
          <div v-else-if="players.length > 0" class="glass-card-elevated overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead class="bg-surface border-b border-border-subtle">
                  <tr>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">Name</th>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">Email (Clerk ID)</th>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">Category</th>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">ELO</th>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">Phone</th>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">Created</th>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr 
                    v-for="player in players" 
                    :key="player.id"
                    class="border-b border-border-subtle hover:bg-surface/50 transition-colors"
                  >
                    <td class="p-4 text-size-4 font-regular text-foreground">{{ player.name }}</td>
                    <td class="p-4 text-size-4 font-regular text-foreground-muted font-mono text-xs">
                      {{ player.clerk_id }}
                    </td>
                    <td class="p-4 text-size-4 font-regular text-foreground">
                      {{ player.category?.name || 'N/A' }}
                    </td>
                    <td class="p-4 text-size-4 font-regular text-foreground">{{ player.elo }}</td>
                    <td class="p-4 text-size-4 font-regular text-foreground-muted">
                      {{ player.phone_number || 'N/A' }}
                    </td>
                    <td class="p-4 text-size-4 font-regular text-foreground-muted">
                      {{ formatDate(player.created_at) }}
                    </td>
                    <td class="p-4">
                      <button
                        @click="handleDeletePlayer(player.id, player.name)"
                        :disabled="loading || deletingIds.has(player.id)"
                        class="btn-danger text-size-4 !py-2 !px-4 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span v-if="deletingIds.has(player.id)">Deleting...</span>
                        <span v-else>Delete</span>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else class="glass-card-elevated p-12 text-center">
            <div class="w-16 h-16 rounded-2xl bg-accent-subtle flex items-center justify-center mx-auto mb-4">
              <span class="text-3xl">👥</span>
            </div>
            <h3 class="text-size-2 font-semibold text-foreground mb-2">No Players</h3>
            <p class="text-size-4 font-regular text-foreground-muted">
              There are no registered players in the system.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PendingPlayer } from '~/types'
import { watch } from 'vue'

definePageMeta({
  middleware: ['admin']
})

const { 
  loading, 
  error, 
  pendingPlayers,
  players,
  fetchPendingPlayers, 
  resendInvitation,
  invitePlayer,
  fetchPlayers,
  deletePlayer,
  deletePendingPlayer
} = useAdmin()


// Tab management
const activeTab = ref<'pending' | 'players'>('pending')

const successMessage = ref<string | null>(null)
const resendingIds = ref<Set<string>>(new Set())
const deletingIds = ref<Set<string>>(new Set())
const deletingPendingIds = ref<Set<string>>(new Set())
const inviting = ref(false)
const inviteError = ref<string | null>(null)

const inviteForm = ref({
  name: '',
  email: ''
})

const resetInviteForm = () => {
  inviteForm.value = {
    name: '',
    email: ''
  }
  inviteError.value = null
}

const handleInvite = async () => {
  try {
    inviting.value = true
    inviteError.value = null
    successMessage.value = null
    
    await invitePlayer({
      name: inviteForm.value.name,
      email: inviteForm.value.email
    })
    
    successMessage.value = `Invitation sent successfully to ${inviteForm.value.email}!`
    resetInviteForm()
    
    // Clear success message after 5 seconds
    setTimeout(() => {
      successMessage.value = null
    }, 5000)
  } catch (err: any) {
    console.error('Error inviting player:', err)
    inviteError.value = err.data?.message || err.message || 'Failed to send invitation'
  } finally {
    inviting.value = false
  }
}

const loadPendingPlayers = async () => {
  try {
    successMessage.value = null
    await fetchPendingPlayers()
  } catch (err) {
    console.error('Error loading pending players:', err)
  }
}

const handleResend = async (pendingPlayerId: string) => {
  try {
    resendingIds.value.add(pendingPlayerId)
    successMessage.value = null
    
    await resendInvitation(pendingPlayerId)
    
    successMessage.value = 'Invitation email resent successfully!'
    
    // Clear success message after 5 seconds
    setTimeout(() => {
      successMessage.value = null
    }, 5000)
  } catch (err: any) {
    console.error('Error resending invitation:', err)
    // Error will be shown via the error state in the composable
  } finally {
    resendingIds.value.delete(pendingPlayerId)
  }
}

const handleDeletePending = async (pendingPlayerId: string, playerName: string, playerEmail: string) => {
  if (!confirm(`Are you sure you want to delete the invitation for "${playerName}" (${playerEmail})? This will also revoke the invitation in Clerk.`)) {
    return
  }

  try {
    deletingPendingIds.value.add(pendingPlayerId)
    successMessage.value = null
    
    await deletePendingPlayer(pendingPlayerId)
    
    successMessage.value = `Invitation for "${playerName}" has been deleted successfully.`
    
    // Clear success message after 5 seconds
    setTimeout(() => {
      successMessage.value = null
    }, 5000)
  } catch (err: any) {
    console.error('Error deleting pending player:', err)
    alert(err.data?.message || err.message || 'Failed to delete invitation')
  } finally {
    deletingPendingIds.value.delete(pendingPlayerId)
  }
}

const loadPlayers = async () => {
  try {
    successMessage.value = null
    await fetchPlayers()
  } catch (err) {
    console.error('Error loading players:', err)
  }
}


const handleDeletePlayer = async (playerId: string, playerName: string) => {
  if (!confirm(`Are you sure you want to delete "${playerName}"? This action cannot be undone and will also delete all associated matches.`)) {
    return
  }

  try {
    deletingIds.value.add(playerId)
    successMessage.value = null
    
    await deletePlayer(playerId)
    
    successMessage.value = `Player "${playerName}" has been deleted successfully.`
    
    // Clear success message after 5 seconds
    setTimeout(() => {
      successMessage.value = null
    }, 5000)
  } catch (err: any) {
    console.error('Error deleting player:', err)
    alert(err.data?.message || err.message || 'Failed to delete player')
  } finally {
    deletingIds.value.delete(playerId)
  }
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Watch for tab changes to load data
watch(activeTab, (newTab) => {
  if (newTab === 'players') {
    loadPlayers()
  } else if (newTab === 'pending') {
    loadPendingPlayers()
  }
})

// Load pending players on mount
onMounted(async () => {
  await loadPendingPlayers()
})
</script>

