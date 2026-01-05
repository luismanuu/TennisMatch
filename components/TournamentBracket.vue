<template>
  <div class="tournament-bracket">
    <!-- Group Stage -->
    <div v-if="bracketData?.groups && bracketData.groups.length > 0" class="mb-12">
      <h3 class="text-size-2 font-semibold text-foreground mb-6">Fase de Grupos</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="group in bracketData.groups"
          :key="group.id"
          @click="openGroupMatches(group.id)"
          class="glass-card-elevated p-6 rounded-xl hover-lift transition-all cursor-pointer"
        >
          <div class="flex items-center justify-between mb-4">
            <h4 class="text-size-3 font-semibold text-foreground">{{ group.group_name }}</h4>
            <Icon name="heroicons:arrow-right" class="w-5 h-5 text-foreground-muted" />
          </div>
          <div class="space-y-2">
            <div
              v-for="player in group.players"
              :key="player.id"
              :class="[
                'flex items-center justify-between p-2 rounded-lg border',
                isCurrentPlayer(player.player?.id)
                  ? 'bg-accent-subtle/30 border-accent border-2'
                  : 'bg-surface border-border-subtle'
              ]"
            >
              <span
                :class="[
                  'text-size-4 font-semibold',
                  isCurrentPlayer(player.player?.id)
                    ? 'text-accent'
                    : 'text-foreground'
                ]"
              >
                {{ player.player?.name }}
                <Icon
                  v-if="isCurrentPlayer(player.player?.id)"
                  name="heroicons:user"
                  class="w-4 h-4 inline ml-1 text-accent"
                />
              </span>
              <span v-if="player.seed_position" class="text-size-4 text-foreground-muted">
                #{{ player.seed_position }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Bracket -->
    <div v-if="bracketData?.main && bracketData.main.length > 0" class="mb-12">
      <h3 class="text-size-2 font-semibold text-foreground mb-6 flex items-center gap-2">
        <Icon name="heroicons:trophy" class="w-6 h-6 text-accent" />
        Bracket Principal
      </h3>
      <div class="bracket-tree">
        <div
          v-for="match in bracketData.main"
          :key="match.id"
          class="bracket-match glass-card-elevated p-4 rounded-xl mb-4 hover-lift transition-all"
        >
          <div class="flex items-center justify-between">
            <div class="flex-1">
              <div class="text-size-4 text-foreground-muted mb-1">
                {{ getRoundName(match.round_number) }}
              </div>
              <div class="text-size-3 font-semibold text-foreground">
                <span
                  :class="[
                    isCurrentPlayer(match.match?.player1_id) ? 'text-accent' : ''
                  ]"
                >
                  {{ match.match?.player1?.name || 'TBD' }}
                  <Icon
                    v-if="isCurrentPlayer(match.match?.player1_id)"
                    name="heroicons:user"
                    class="w-4 h-4 inline ml-1 text-accent"
                  />
                </span>
                <span class="mx-2">vs</span>
                <span
                  :class="[
                    isCurrentPlayer(match.match?.player2_id) ? 'text-accent' : ''
                  ]"
                >
                  {{ match.match?.player2?.name || 'TBD' }}
                  <Icon
                    v-if="isCurrentPlayer(match.match?.player2_id)"
                    name="heroicons:user"
                    class="w-4 h-4 inline ml-1 text-accent"
                  />
                </span>
              </div>
              <div v-if="match.match?.score" class="text-size-4 text-accent mt-1">
                {{ match.match.score }}
              </div>
              <div v-if="match.match?.winner" class="text-size-4 text-accent mt-1 font-semibold">
                Ganador: {{ match.match.winner.name }}
              </div>
            </div>
            <div v-if="match.round_deadline" class="text-size-4 text-foreground-muted">
              <Icon name="heroicons:clock" class="w-4 h-4 inline" />
              {{ formatDeadline(match.round_deadline) }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Backdraw Bracket -->
    <div v-if="bracketData?.backdraw && bracketData.backdraw.length > 0">
      <h3 class="text-size-2 font-semibold text-foreground mb-6 flex items-center gap-2">
        <Icon name="heroicons:trophy" class="w-6 h-6 text-accent-secondary" />
        Bracket Consolación
      </h3>
      <div class="bracket-tree">
        <div
          v-for="match in bracketData.backdraw"
          :key="match.id"
          class="bracket-match glass-card-elevated p-4 rounded-xl mb-4 hover-lift transition-all border-2 border-accent-secondary/30"
        >
          <div class="flex items-center justify-between">
            <div class="flex-1">
              <div class="text-size-4 text-foreground-muted mb-1">
                {{ getRoundName(match.round_number) }}
              </div>
              <div class="text-size-3 font-semibold text-foreground">
                <span
                  :class="[
                    isCurrentPlayer(match.match?.player1_id) ? 'text-accent-secondary' : ''
                  ]"
                >
                  {{ match.match?.player1?.name || 'TBD' }}
                  <Icon
                    v-if="isCurrentPlayer(match.match?.player1_id)"
                    name="heroicons:user"
                    class="w-4 h-4 inline ml-1 text-accent-secondary"
                  />
                </span>
                <span class="mx-2">vs</span>
                <span
                  :class="[
                    isCurrentPlayer(match.match?.player2_id) ? 'text-accent-secondary' : ''
                  ]"
                >
                  {{ match.match?.player2?.name || 'TBD' }}
                  <Icon
                    v-if="isCurrentPlayer(match.match?.player2_id)"
                    name="heroicons:user"
                    class="w-4 h-4 inline ml-1 text-accent-secondary"
                  />
                </span>
              </div>
              <div v-if="match.match?.score" class="text-size-4 text-accent-secondary mt-1">
                {{ match.match.score }}
              </div>
              <div v-if="match.match?.winner" class="text-size-4 text-accent-secondary mt-1 font-semibold">
                Ganador: {{ match.match.winner.name }}
              </div>
            </div>
            <div v-if="match.round_deadline" class="text-size-4 text-foreground-muted">
              <Icon name="heroicons:clock" class="w-4 h-4 inline" />
              {{ formatDeadline(match.round_deadline) }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="!bracketData || (!bracketData.groups?.length && !bracketData.main?.length && !bracketData.backdraw?.length)" class="text-center py-12">
      <Icon name="heroicons:trophy-cup" class="w-24 h-24 text-foreground-muted mx-auto mb-4 opacity-50" />
      <p class="text-size-3 font-regular text-foreground-muted">Los brackets aún no han sido generados</p>
    </div>

    <!-- Group Matches Modal -->
    <Teleport to="body">
      <div
        v-if="selectedGroupId"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        @click.self="closeGroupMatches"
      >
        <div class="glass-card-elevated p-6 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-fade-in-scale">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-size-2 font-semibold text-foreground">
              Partidos del Grupo
            </h3>
            <button
              @click="closeGroupMatches"
              class="p-2 rounded-xl hover:bg-surface transition-colors"
            >
              <Icon name="heroicons:x-mark" class="w-6 h-6 text-foreground-muted" />
            </button>
          </div>

          <!-- Loading State -->
          <div v-if="loadingGroupMatches" class="text-center py-12">
            <Icon name="heroicons:arrow-path" class="w-12 h-12 text-accent mx-auto mb-4 animate-spin" />
            <p class="text-size-3 font-regular text-foreground-muted">Cargando partidos...</p>
          </div>

          <!-- Matches List -->
          <div v-else-if="groupMatches.length > 0" class="space-y-3">
            <div
              v-for="tm in groupMatches"
              :key="tm.id"
              class="p-4 rounded-xl bg-surface border-2 border-border-subtle hover:border-accent transition-all"
            >
              <div class="flex items-center justify-between">
                <div class="flex-1">
                  <div class="flex items-center gap-3 mb-2">
                    <span
                      :class="[
                        'text-size-3 font-semibold',
                        isCurrentPlayer(tm.match?.player1_id) ? 'text-accent' : 'text-foreground'
                      ]"
                    >
                      {{ tm.match?.player1?.name || 'TBD' }}
                      <Icon
                        v-if="isCurrentPlayer(tm.match?.player1_id)"
                        name="heroicons:user"
                        class="w-4 h-4 inline ml-1 text-accent"
                      />
                    </span>
                    <span class="text-foreground-muted">vs</span>
                    <span
                      :class="[
                        'text-size-3 font-semibold',
                        isCurrentPlayer(tm.match?.player2_id) ? 'text-accent' : 'text-foreground'
                      ]"
                    >
                      {{ tm.match?.player2?.name || 'TBD' }}
                      <Icon
                        v-if="isCurrentPlayer(tm.match?.player2_id)"
                        name="heroicons:user"
                        class="w-4 h-4 inline ml-1 text-accent"
                      />
                    </span>
                  </div>
                  <div v-if="tm.match?.score" class="text-size-4 text-accent font-semibold mb-1">
                    {{ tm.match.score }}
                  </div>
                  <div v-if="tm.match?.scheduled_at" class="text-size-4 text-foreground-muted flex items-center gap-2">
                    <Icon name="heroicons:calendar" class="w-4 h-4" />
                    {{ formatDeadline(tm.match.scheduled_at) }}
                  </div>
                  <div v-else class="text-size-4 text-yellow-400 flex items-center gap-2">
                    <Icon name="heroicons:clock" class="w-4 h-4" />
                    Sin programar
                  </div>
                  <div v-if="tm.round_deadline" class="text-size-5 text-foreground-muted mt-1">
                    Fecha límite: {{ formatDeadline(tm.round_deadline) }}
                  </div>
                </div>
                <div class="ml-4">
                  <span
                    :class="[
                      'px-3 py-1 rounded-full text-size-4 font-semibold',
                      tm.match?.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                      tm.match?.status === 'active' ? 'bg-yellow-500/20 text-yellow-400' :
                      tm.match?.status === 'scheduled' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-gray-500/20 text-gray-400'
                    ]"
                  >
                    {{ tm.match?.status === 'completed' ? 'Completado' :
                        tm.match?.status === 'active' ? 'En Curso' :
                        tm.match?.status === 'scheduled' ? 'Programado' : 'Pendiente' }}
                  </span>
                </div>
              </div>
              <div v-if="tm.match" class="mt-3 flex justify-end">
                <NuxtLink
                  :to="`/matches/${tm.match.id}`"
                  class="px-4 py-2 rounded-xl bg-accent text-foreground text-size-4 font-semibold hover-lift transition-all"
                >
                  Ver Detalles
                </NuxtLink>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else class="text-center py-12">
            <Icon name="heroicons:calendar-x-mark" class="w-24 h-24 text-foreground-muted mx-auto mb-4 opacity-50" />
            <p class="text-size-3 font-regular text-foreground-muted">No hay partidos en este grupo aún</p>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
interface Props {
  tournamentId: string
  playerId?: string | null
}

const props = defineProps<Props>()

const { getBracket, loading } = useTournaments()
const bracketData = ref<any>(null)

// Helper to check if a player name should be highlighted
const isCurrentPlayer = (playerId: string | null | undefined) => {
  if (!props.playerId || !playerId) return false
  return props.playerId === playerId
}

const getRoundName = (roundNumber?: number) => {
  if (!roundNumber) return 'Ronda'
  const names: Record<number, string> = {
    1: 'Cuartos de Final',
    2: 'Semifinales',
    3: 'Final'
  }
  return names[roundNumber] || `Ronda ${roundNumber}`
}

const formatDeadline = (deadline: string) => {
  return new Date(deadline).toLocaleDateString('es-ES', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const loadBracket = async () => {
  try {
    bracketData.value = await getBracket(props.tournamentId)
  } catch (err) {
    console.error('Error loading bracket:', err)
  }
}

watch(() => props.tournamentId, () => {
  if (props.tournamentId) {
    loadBracket()
  }
}, { immediate: true })

onMounted(() => {
  if (props.tournamentId) {
    loadBracket()
  }
})
</script>

<style scoped>
.bracket-tree {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.bracket-match {
  position: relative;
  transition: all 0.3s ease;
}

.bracket-match:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
}
</style>

