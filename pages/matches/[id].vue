<template>
  <div class="min-h-screen">
    <!-- Navigation -->
    <AppNavigation />

    <div class="h-16"></div>

    <div class="section-padding">
      <div class="container-medium px-6">
        <div v-if="loading" class="text-center py-12">
          <p class="text-size-3 text-foreground-muted">Cargando partido...</p>
        </div>

        <div v-else-if="error" class="text-center py-12">
          <p class="text-size-3 text-red-400">{{ error.message || 'Error al cargar el partido' }}</p>
          <NuxtLink to="/matches" class="btn-secondary text-size-3 mt-4 inline-block">
            Volver a Partidos
          </NuxtLink>
        </div>

        <div v-else-if="match" class="max-w-4xl mx-auto space-y-6">
          <!-- Header -->
          <div class="flex items-center justify-between mb-6">
            <NuxtLink to="/matches" class="text-size-3 text-foreground-muted hover:text-foreground">
              ← Volver a Partidos
            </NuxtLink>
            <div class="flex items-center gap-3">
              <span
                :class="[
                  'px-3 py-1 rounded-full text-size-4 font-semibold',
                  statusBadgeClass
                ]"
              >
                {{ statusLabel }}
              </span>
            </div>
          </div>

          <!-- Match Info Card -->
          <div class="glass-card-elevated p-6">
            <h1 class="text-size-1 font-semibold text-foreground mb-6">Detalles del Partido</h1>
            
            <div class="space-y-4">
              <!-- Players -->
              <div>
                <p class="text-size-4 font-semibold text-foreground-muted mb-2">Jugadores</p>
                <div class="flex items-center gap-4">
                  <div class="flex-1 p-4 rounded-xl bg-surface border border-border-subtle">
                    <NuxtLink
                      v-if="match.player1"
                      :to="`/players/${match.player1.id}`"
                      class="text-size-3 font-semibold text-foreground hover:text-accent hover:underline transition-all cursor-pointer block"
                    >
                      {{ match.player1.name }}
                    </NuxtLink>
                    <p v-else class="text-size-3 font-semibold text-foreground">
                      Jugador 1
                    </p>
                    <p v-if="match.player1?.category" class="text-size-4 text-foreground-muted mt-1">
                      {{ match.player1.category.name }}
                    </p>
                  </div>
                  <span class="text-size-2 font-bold text-foreground-muted">VS</span>
                  <div class="flex-1 p-4 rounded-xl bg-surface border border-border-subtle">
                    <NuxtLink
                      v-if="match.player2"
                      :to="`/players/${match.player2.id}`"
                      class="text-size-3 font-semibold text-foreground hover:text-accent hover:underline transition-all cursor-pointer block"
                    >
                      {{ match.player2.name }}
                    </NuxtLink>
                    <NuxtLink
                      v-else-if="match.pending_player2"
                      :to="`/players/${match.pending_player2.id}`"
                      class="text-size-3 font-semibold text-foreground hover:text-accent hover:underline transition-all cursor-pointer block"
                    >
                      {{ match.pending_player2.name }}
                    </NuxtLink>
                    <p v-else class="text-size-3 font-semibold text-foreground">
                      Oponente
                    </p>
                    <p v-if="match.player2?.category || match.pending_player2?.category" class="text-size-4 text-foreground-muted mt-1">
                      {{ match.player2?.category?.name || match.pending_player2?.category?.name }}
                    </p>
                    <p v-if="match.pending_player2" class="text-size-4 text-yellow-400 mt-1">
                      (Pendiente de registro)
                    </p>
                  </div>
                </div>
              </div>

              <!-- Scheduled Time -->
              <div>
                <p class="text-size-4 font-semibold text-foreground-muted mb-2">Fecha y Hora Programada</p>
                <p class="text-size-3 text-foreground">
                  {{ formatDateTime(match.scheduled_at) }}
                </p>
              </div>

              <!-- Location -->
              <div v-if="match.location">
                <p class="text-size-4 font-semibold text-foreground-muted mb-2">Ubicación</p>
                <p class="text-size-3 text-foreground">{{ match.location }}</p>
              </div>

              <!-- Score (if proposed or completed) -->
              <div v-if="match.score">
                <p class="text-size-4 font-semibold text-foreground-muted mb-2">Resultado</p>
                <p class="text-size-3 text-foreground">{{ match.score }}</p>
                <p v-if="match.winner" class="text-size-4 text-foreground-muted mt-1">
                  Ganador: 
                  <NuxtLink
                    :to="`/players/${match.winner.id}`"
                    class="text-accent hover:underline hover:opacity-80 transition-all cursor-pointer"
                  >
                    {{ match.winner.name }}
                  </NuxtLink>
                </p>
              </div>

              <!-- Score Proposal Status -->
              <div v-if="match.status === 'active' && match.score_proposed_by">
                <div class="p-4 rounded-xl bg-accent-subtle/50 border border-accent/30">
                  <p class="text-size-3 font-semibold text-foreground mb-2">
                    Puntuación Propuesta
                  </p>
                  <p class="text-size-4 text-foreground-muted">
                    {{ match.score_proposed_by_player?.name }} propuso: {{ match.score }}
                  </p>
                  <p v-if="match.winner" class="text-size-4 text-foreground-muted mt-1">
                    Ganador: 
                    <NuxtLink
                      :to="`/players/${match.winner.id}`"
                      class="text-accent hover:underline hover:opacity-80 transition-all cursor-pointer"
                    >
                      {{ match.winner.name }}
                    </NuxtLink>
                  </p>
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div class="mt-6 pt-6 border-t border-border-subtle space-y-3">
              <!-- Start Match Button (if scheduled and opponent registered) -->
              <button
                v-if="match.status === 'scheduled' && !match.pending_player2_id"
                @click="handleStartMatch"
                :disabled="actionLoading"
                class="btn-primary text-size-3 w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Iniciar Partido
              </button>

              <!-- Score Proposal (if active and no score proposed yet) -->
              <div v-if="match.status === 'active' && !match.score_proposed_by && isPlayerInMatch">
                <button
                  @click="showScoreForm = true"
                  class="btn-primary text-size-3 w-full"
                >
                  Proponer Puntuación
                </button>
              </div>

              <!-- Score Approval/Rejection (if score proposed by opponent) -->
              <div v-if="match.status === 'active' && match.score_proposed_by && match.score_proposed_by !== currentPlayerId">
                <div class="flex gap-3">
                  <button
                    @click="handleApproveScore"
                    :disabled="actionLoading"
                    class="btn-primary text-size-3 flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Aprobar Puntuación
                  </button>
                  <button
                    @click="handleRejectScore"
                    :disabled="actionLoading"
                    class="btn-secondary text-size-3 flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Rechazar
                  </button>
                </div>
              </div>

              <!-- Cancel Match (if scheduled or active) -->
              <button
                v-if="(match.status === 'scheduled' || match.status === 'active') && isPlayerInMatch"
                @click="handleCancelMatch"
                :disabled="actionLoading"
                class="btn-secondary text-size-3 w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar Partido
              </button>
            </div>
          </div>

          <!-- Score Proposal Form Modal -->
          <div v-if="showScoreForm" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div class="glass-card-elevated p-6 max-w-md w-full">
              <h2 class="text-size-2 font-semibold text-foreground mb-4">Proponer Puntuación</h2>
              
              <form @submit.prevent="handleProposeScore" class="space-y-4">
                <div>
                  <label for="score" class="block text-size-4 font-semibold text-foreground mb-2">
                    Resultado
                  </label>
                  <input
                    id="score"
                    v-model="scoreForm.score"
                    type="text"
                    required
                    class="w-full px-4 py-3 rounded-xl bg-surface border border-border-subtle text-foreground placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                    placeholder="Ej: 6-4, 6-3"
                  />
                </div>

                <div>
                  <label for="winner" class="block text-size-4 font-semibold text-foreground mb-2">
                    Ganador
                  </label>
                  <select
                    id="winner"
                    v-model="scoreForm.winner_id"
                    required
                    class="w-full px-4 py-3 rounded-xl bg-surface border border-border-subtle text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                  >
                    <option value="" disabled>Selecciona el ganador</option>
                    <option :value="match.player1_id">{{ match.player1?.name }}</option>
                    <option v-if="match.player2_id" :value="match.player2_id">{{ match.player2?.name }}</option>
                  </select>
                </div>

                <div class="flex gap-3 pt-2">
                  <button
                    type="submit"
                    :disabled="actionLoading"
                    class="btn-primary text-size-3 flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Proponer
                  </button>
                  <button
                    type="button"
                    @click="showScoreForm = false"
                    class="btn-secondary text-size-3 flex-1"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>

          <!-- Chat Section -->
          <div class="glass-card-elevated p-6">
            <h2 class="text-size-2 font-semibold text-foreground mb-4">Chat</h2>
            
            <!-- Messages -->
            <div class="space-y-3 mb-4 max-h-96 overflow-y-auto">
              <div
                v-for="message in chatMessages"
                :key="message.id"
                :class="[
                  'p-3 rounded-xl',
                  message.player_id === currentPlayerId
                    ? 'bg-accent-subtle/50 ml-auto max-w-[80%]'
                    : 'bg-surface max-w-[80%]'
                ]"
              >
                <NuxtLink
                  v-if="message.player"
                  :to="`/players/${message.player.id}`"
                  class="text-size-4 font-semibold text-foreground mb-1 hover:text-accent hover:underline transition-all cursor-pointer block"
                >
                  {{ message.player.name }}
                </NuxtLink>
                <p v-else class="text-size-4 font-semibold text-foreground mb-1">
                  Jugador
                </p>
                <p class="text-size-3 text-foreground">{{ message.message }}</p>
                <p class="text-size-4 text-foreground-muted mt-1">
                  {{ formatTime(message.created_at) }}
                </p>
              </div>
              <div v-if="chatLoading" class="text-center py-4">
                <p class="text-size-4 text-foreground-muted">Cargando mensajes...</p>
              </div>
            </div>

            <!-- Message Input -->
            <form @submit.prevent="handleSendMessage" class="flex gap-3">
              <input
                v-model="messageInput"
                type="text"
                :disabled="chatLoading || !isPlayerInMatch"
                placeholder="Escribe un mensaje..."
                class="flex-1 px-4 py-3 rounded-xl bg-surface border border-border-subtle text-foreground placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent disabled:opacity-50"
              />
              <button
                type="submit"
                :disabled="chatLoading || !messageInput.trim() || !isPlayerInMatch"
                class="btn-primary text-size-3 px-6 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Enviar
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Match } from '~/types'

definePageMeta({
  middleware: 'auth'
})

const route = useRoute()
const matchId = route.params.id as string

const { isLoaded, userId } = useAuthState()
const { player, fetchPlayer } = usePlayer()
const { getMatch, updateMatchStatus, proposeScore, approveScore, rejectScore, cancelMatch, loading, error } = useMatches()
const { fetchMessages, sendMessage, messages: chatMessages, loading: chatLoading } = useMatchChat()

const match = ref<Match | null>(null)
const actionLoading = ref(false)
const showScoreForm = ref(false)
const messageInput = ref('')
const scoreForm = ref({
  score: '',
  winner_id: ''
})

const currentPlayerId = computed(() => player.value?.id)
const isPlayerInMatch = computed(() => {
  if (!match.value || !currentPlayerId.value) return false
  return match.value.player1_id === currentPlayerId.value || 
         match.value.player2_id === currentPlayerId.value
})

const statusLabel = computed(() => {
  if (!match.value) return ''
  const labels: Record<string, string> = {
    scheduled: 'Programado',
    active: 'En Curso',
    completed: 'Completado',
    cancelled: 'Cancelado'
  }
  return labels[match.value.status] || match.value.status
})

const statusBadgeClass = computed(() => {
  if (!match.value) return ''
  const classes: Record<string, string> = {
    scheduled: 'bg-blue-500/20 text-blue-400 border border-blue-500/50',
    active: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50',
    completed: 'bg-green-500/20 text-green-400 border border-green-500/50',
    cancelled: 'bg-red-500/20 text-red-400 border border-red-500/50'
  }
  return classes[match.value.status] || ''
})

const formatDateTime = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatTime = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

const loadMatch = async () => {
  if (!userId.value) return
  
  try {
    const data = await getMatch(matchId)
    match.value = data
    
    // Load messages
    if (userId.value) {
      await fetchMessages(matchId, userId.value)
    }
  } catch (err) {
    console.error('Error loading match:', err)
  }
}

const handleStartMatch = async () => {
  if (!userId.value || !match.value) return
  
  actionLoading.value = true
  try {
    await updateMatchStatus(userId.value, match.value.id, 'active')
    await loadMatch()
  } catch (err) {
    console.error('Error starting match:', err)
  } finally {
    actionLoading.value = false
  }
}

const handleProposeScore = async () => {
  if (!userId.value || !match.value) return
  
  actionLoading.value = true
  try {
    await proposeScore(userId.value, match.value.id, {
      score: scoreForm.value.score,
      winner_id: scoreForm.value.winner_id
    })
    showScoreForm.value = false
    scoreForm.value = { score: '', winner_id: '' }
    await loadMatch()
  } catch (err) {
    console.error('Error proposing score:', err)
  } finally {
    actionLoading.value = false
  }
}

const handleApproveScore = async () => {
  if (!userId.value || !match.value) return
  
  actionLoading.value = true
  try {
    await approveScore(userId.value, match.value.id)
    await loadMatch()
  } catch (err) {
    console.error('Error approving score:', err)
  } finally {
    actionLoading.value = false
  }
}

const handleRejectScore = async () => {
  if (!userId.value || !match.value) return
  
  actionLoading.value = true
  try {
    await rejectScore(userId.value, match.value.id)
    await loadMatch()
  } catch (err) {
    console.error('Error rejecting score:', err)
  } finally {
    actionLoading.value = false
  }
}

const handleCancelMatch = async () => {
  if (!userId.value || !match.value) return
  
  if (!confirm('¿Estás seguro de que quieres cancelar este partido?')) return
  
  actionLoading.value = true
  try {
    await cancelMatch(userId.value, match.value.id)
    await loadMatch()
  } catch (err) {
    console.error('Error cancelling match:', err)
  } finally {
    actionLoading.value = false
  }
}

const handleSendMessage = async () => {
  if (!userId.value || !messageInput.value.trim()) return
  
  try {
    await sendMessage(matchId, userId.value, {
      message: messageInput.value.trim()
    })
    messageInput.value = ''
  } catch (err) {
    console.error('Error sending message:', err)
  }
}

onMounted(async () => {
  if (isLoaded.value && userId.value) {
    await fetchPlayer(userId.value)
    await loadMatch()
  }
})

watch([isLoaded, userId], async () => {
  if (isLoaded.value && userId.value) {
    await fetchPlayer(userId.value)
    await loadMatch()
  }
})
</script>

