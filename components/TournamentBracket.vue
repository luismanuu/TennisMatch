<template>
  <div class="tournament-bracket">
    <!-- Group Stage -->
    <div v-if="bracketData?.groups && bracketData.groups.length > 0" class="mb-12">
      <h3 class="panel-title">Fase de Grupos</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="group in bracketData.groups"
          :key="group.id"
          class="panel transition-all"
        >
          <div class="flex items-center justify-between mb-4">
            <h4 class="text-size-3 font-semibold text-foreground">{{ group.group_name }}</h4>
            <button
              @click="openGroupMatches(group.id)"
              class="p-2 rounded-lg hover:bg-surface transition-colors"
            >
              <Icon name="heroicons:arrow-right" class="w-5 h-5 text-foreground-muted" />
            </button>
          </div>
          
          <!-- Standings Table - Always show table if we have players -->
          <div class="mb-4">
            <div class="overflow-x-auto -mx-2 px-2">
              <table class="w-full text-size-4">
                <thead>
                  <tr class="border-b border-border-subtle">
                    <th class="text-left py-2.5 px-2 text-foreground-muted font-semibold text-size-5">Pos</th>
                    <th class="text-left py-2.5 px-2 text-foreground-muted font-semibold text-size-5">Jugador</th>
                    <th class="text-center py-2.5 px-2 text-foreground-muted font-semibold text-size-5">V</th>
                    <th class="text-center py-2.5 px-2 text-foreground-muted font-semibold text-size-5">P</th>
                    <th class="text-center py-2.5 px-2 text-foreground-muted font-semibold text-size-5">DG</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(player, index) in getGroupPlayersWithStandings(group)"
                    :key="player.id || player.player_id"
                    :class="[
                      'border-b border-border-subtle/30 last:border-b-0 transition-colors',
                      isCurrentPlayer(player.player_id || player.player?.id)
                        ? 'bg-accent-subtle/10 hover:bg-accent-subtle/20'
                        : 'hover:bg-surface-subtle/50'
                    ]"
                  >
                    <td class="py-2.5 px-2 text-foreground-muted font-medium">{{ Number(index) + 1 }}</td>
                    <td class="py-2.5 px-2">
                      <span
                        :class="[
                          'font-semibold text-size-4',
                          isCurrentPlayer(player.player_id || player.player?.id)
                            ? 'text-accent'
                            : 'text-foreground'
                        ]"
                      >
                        {{ player.player?.name || player.name }}
                        <Icon
                          v-if="isCurrentPlayer(player.player_id || player.player?.id)"
                          name="heroicons:user"
                          class="w-3.5 h-3.5 inline ml-1.5 text-accent"
                        />
                      </span>
                    </td>
                    <td class="py-2.5 px-2 text-center text-foreground font-medium">{{ player.wins ?? 0 }}</td>
                    <td class="py-2.5 px-2 text-center">
                      <span class="text-accent font-bold text-size-4">{{ player.points ?? 0 }}</span>
                    </td>
                    <td class="py-2.5 px-2 text-center text-foreground-muted font-medium">
                      <span :class="Number(player.game_difference ?? 0) >= 0 ? 'text-success' : 'text-error'">
                        {{ Number(player.game_difference ?? 0) >= 0 ? '+' : '' }}{{ player.game_difference ?? 0 }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <!-- Fallback: Show players with standings info if available, otherwise just players -->
          <div v-if="false" class="space-y-2">
            <div
              v-for="player in group.players"
              :key="player.id"
              :class="[
                'flex items-center justify-between p-3 rounded-lg border',
                isCurrentPlayer(player.player?.id)
                  ? 'bg-accent-subtle/30 border-accent border'
                  : 'bg-surface border-border-subtle'
              ]"
            >
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
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
                  <span v-if="player.seed_position" class="text-size-5 text-foreground-muted">
                    #{{ player.seed_position }}
                  </span>
                </div>
                <!-- Show points and game difference if standings exist for this player -->
                <div v-if="getPlayerStanding(player.player?.id, group.standings)" class="flex items-center gap-4 text-size-4">
                  <span class="text-foreground-muted">
                    V: <span class="text-foreground font-semibold">{{ getPlayerStanding(player.player?.id, group.standings)?.wins || 0 }}</span>
                    D: <span class="text-foreground font-semibold">{{ getPlayerStanding(player.player?.id, group.standings)?.losses || 0 }}</span>
                  </span>
                  <span class="text-accent font-semibold">
                    Pts: {{ getPlayerStanding(player.player?.id, group.standings)?.points || 0 }}
                  </span>
                  <span class="text-foreground-muted">
                    GD: <span class="font-semibold">{{ getPlayerStanding(player.player?.id, group.standings)?.game_difference >= 0 ? '+' : '' }}{{ getPlayerStanding(player.player?.id, group.standings)?.game_difference || 0 }}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Bracket -->
    <div v-if="bracketData?.main && bracketData.main.length > 0" class="mb-12">
      <h3 class="text-size-2 font-semibold text-foreground mb-6 flex items-center gap-2">
        <Icon name="heroicons:trophy" class="w-6 h-6 text-accent" />
        Bracket Main
      </h3>
      
      <!-- Current Round Deadline Info -->
      <div v-if="mainCurrentRoundDeadline" class="mb-6 panel rounded-xl">
        <div class="flex items-center gap-3">
          <Icon name="heroicons:calendar-days" class="w-5 h-5 text-accent" />
          <div>
            <span class="text-size-4 font-semibold text-foreground">Fecha límite de {{ mainCurrentRoundDeadline.roundName }}:</span>
            <span class="text-size-4 text-foreground-muted ml-2">{{ mainCurrentRoundDeadline.formattedDate }}</span>
          </div>
        </div>
      </div>
      
      <ClientOnly>
        <div ref="mainBracketContainer" class="bracketry-container"></div>
        <template #fallback>
          <div class="bracketry-container flex items-center justify-center">
            <Icon name="heroicons:arrow-path" class="w-8 h-8 text-foreground-muted animate-spin" />
          </div>
        </template>
      </ClientOnly>
    </div>

    <!-- Backdraw Bracket -->
    <div v-if="bracketData?.backdraw && bracketData.backdraw.length > 0" class="mb-12">
      <h3 class="text-size-2 font-semibold text-foreground mb-6 flex items-center gap-2">
        <Icon name="heroicons:trophy" class="w-6 h-6 text-accent-secondary" />
        Bracket Back
      </h3>
      
      <!-- Current Round Deadline Info -->
      <div v-if="backdrawCurrentRoundDeadline" class="mb-6 panel rounded-xl">
        <div class="flex items-center gap-3">
          <Icon name="heroicons:calendar-days" class="w-5 h-5 text-accent-secondary" />
          <div>
            <span class="text-size-4 font-semibold text-foreground">Fecha límite de {{ backdrawCurrentRoundDeadline.roundName }}:</span>
            <span class="text-size-4 text-foreground-muted ml-2">{{ backdrawCurrentRoundDeadline.formattedDate }}</span>
          </div>
        </div>
      </div>
      
      <ClientOnly>
        <div ref="backdrawBracketContainer" class="bracketry-container"></div>
        <template #fallback>
          <div class="bracketry-container flex items-center justify-center">
            <Icon name="heroicons:arrow-path" class="w-8 h-8 text-foreground-muted animate-spin" />
          </div>
        </template>
      </ClientOnly>
    </div>

    <!-- Empty State -->
    <div v-if="!bracketData || (!bracketData.groups?.length && !bracketData.main?.length && !bracketData.backdraw?.length)" class="text-center py-12">
      <Icon name="heroicons:trophy" class="w-24 h-24 text-foreground-muted mx-auto mb-4 opacity-50" />
      <p class="text-size-3 font-regular text-foreground-muted">Los brackets aún no han sido generados</p>
    </div>

    <!-- Group Matches Modal -->
    <Teleport to="body">
      <div
        v-if="selectedGroupId"
        class="te-modal"
        @click.self="closeGroupMatches"
      >
        <div class="te-modal__panel te-modal__panel--xl">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-size-2 font-semibold text-foreground">
              Partidos del Grupo
            </h3>
            <button
              type="button"
              aria-label="Cerrar"
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
              class="p-4 rounded-xl bg-surface border border-border-subtle hover:border-accent transition-all"
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
                      tm.match?.status === 'scheduled' && tm.match?.scheduled_at ? 'bg-blue-500/20 text-blue-400' :
                      tm.match?.status === 'scheduled' && !tm.match?.scheduled_at ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-gray-500/20 text-gray-400'
                    ]"
                  >
                    {{ tm.match?.status === 'completed' ? 'Completado' :
                        tm.match?.status === 'active' ? 'En Curso' :
                        tm.match?.status === 'scheduled' && tm.match?.scheduled_at ? 'Programado' :
                        tm.match?.status === 'scheduled' && !tm.match?.scheduled_at ? 'Sin agendar' :
                        'Pendiente' }}
                  </span>
                </div>
              </div>
              <div v-if="tm.match && canViewMatchDetails(tm.match)" class="mt-3 flex justify-end">
                <NuxtLink
                  :to="`/matches/${tm.match.id}${props.tournamentId ? `?from=tournament&tournamentId=${props.tournamentId}` : ''}`"
                  class="btn-primary"
                >
                  Ver Detalles
                </NuxtLink>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else class="text-center py-12">
            <Icon name="heroicons:calendar-days" class="w-24 h-24 text-foreground-muted mx-auto mb-4 opacity-50" />
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
  isOrganizer?: boolean
  tournamentOrganizerId?: string | null
}

const props = defineProps<Props>()

const { getBracket, loading } = useTournaments()
const bracketData = ref<any>(null)
const mainCurrentRoundDeadline = ref<{ roundName: string; formattedDate: string } | null>(null)
const backdrawCurrentRoundDeadline = ref<{ roundName: string; formattedDate: string } | null>(null)

// Bracketry container refs
const mainBracketContainer = ref<HTMLElement | null>(null)
const backdrawBracketContainer = ref<HTMLElement | null>(null)

// Match maps for click handling
const mainBracketMatchMap = ref<Map<string, any>>(new Map())
const backdrawBracketMatchMap = ref<Map<string, any>>(new Map())

// Lazy load Bracketry only on client side
let createBracket: any = null
const loadBracketry = async () => {
  if (process.client && !createBracket) {
    const bracketryModule = await import('bracketry')
    createBracket = bracketryModule.createBracket
  }
  return createBracket
}

// Group matches modal state
const selectedGroupId = ref<string | null>(null)
const groupMatches = ref<any[]>([])
const loadingGroupMatches = ref(false)

// Helper to check if a player name should be highlighted
const isCurrentPlayer = (playerId: string | null | undefined) => {
  if (!props.playerId || !playerId) return false
  return props.playerId === playerId
}

// Helper to check if user can view match details
const canViewMatchDetails = (match: any) => {
  if (!match) return false
  
  // If user is organizer of this tournament, they can view all matches
  if (props.isOrganizer && props.tournamentOrganizerId) {
    return true
  }
  
  // If user is a player in the match, they can view it
  if (props.playerId) {
    return match.player1_id === props.playerId || match.player2_id === props.playerId
  }
  
  return false
}

const getRoundName = (roundNumber?: number) => {
  if (!roundNumber) return 'Ronda'
  const names: Record<number, string> = {
    1: `${roundNumber}st Round`,
    2: `${roundNumber}nd Round`,
    3: `${roundNumber}rd Round`
  }
  return names[roundNumber] || `${roundNumber}th Round`
}

// Organize matches by rounds for bracket visualization
const getBracketRounds = (matches: any[]) => {
  if (!matches || matches.length === 0) return []
  
  const roundsMap = new Map<number, any[]>()
  
  matches.forEach(match => {
    const roundNum = match.round_number || 1
    if (!roundsMap.has(roundNum)) {
      roundsMap.set(roundNum, [])
    }
    roundsMap.get(roundNum)!.push(match)
  })
  
  // Convert to array and sort by round number
  return Array.from(roundsMap.entries())
    .map(([number, matches]) => ({ number, matches }))
    .sort((a, b) => a.number - b.number)
}

// Parse player scores from match score string - returns array of score objects for bracketry
const parsePlayerScores = (score: string, playerNumber: number): Array<{ mainScore: string; subscore?: number; isWinner?: boolean }> => {
  if (!score) return []
  
  // Handle walkover
  if (score.trim().toUpperCase() === 'WO') {
    return []
  }
  
  // Normalize score string (aligned with calculateGroupStandings logic)
  let scoreToParse = score.trim()
  
  // Replace multiple spaces with single space
  scoreToParse = scoreToParse.replace(/\s+/g, ' ')
  
  // Normalize comma spacing: "6-4, 6-3" → "6-4,6-3"
  scoreToParse = scoreToParse.replace(/\s*,\s*/g, ',')
  
  // If no comma but has space, treat space as separator: "6-4 6-3" → split by space
  if (!scoreToParse.includes(',') && scoreToParse.includes(' ')) {
    scoreToParse = scoreToParse.replace(/\s+/g, ',')
  }
  
  // Split by comma or treat as single set (pro set)
  const sets = scoreToParse.includes(',')
    ? scoreToParse.split(',').map(s => s.trim()).filter(s => s.length > 0)
    : [scoreToParse.trim()]
  
  const playerScores: Array<{ mainScore: string; subscore?: number; isWinner?: boolean }> = []
  
  sets.forEach(set => {
    // Clean up the set string: remove extra spaces, handle various dash formats
    const cleanedSet = set.trim().replace(/\s*-\s*/g, '-')
    
    // Split by dash
    const parts = cleanedSet.split('-')
    if (parts.length !== 2) {
      return // Invalid format, skip this set
    }
    
    // Parse games, handling tiebreak format like "7-6(5)"
    const p1ScoreStr = parts[0].trim()
    const p2ScoreStr = parts[1].trim()
    
    // Extract main score (remove tiebreak info)
    const p1MainScore = p1ScoreStr.replace(/\(.*\)/, '').replace(/[^0-9]/g, '')
    const p2MainScore = p2ScoreStr.replace(/\(.*\)/, '').replace(/[^0-9]/g, '')
    
    // Extract tiebreak subscore if present (format: "7-6(5)" or "6-7(5)")
    let subscore: number | undefined
    const tiebreakMatch = p1ScoreStr.match(/\((\d+)\)/) || p2ScoreStr.match(/\((\d+)\)/)
    if (tiebreakMatch) {
      subscore = parseInt(tiebreakMatch[1], 10)
    }
    
    const p1Games = parseInt(p1MainScore, 10) || 0
    const p2Games = parseInt(p2MainScore, 10) || 0
    
    if (p1Games === 0 && p2Games === 0) {
      return // Invalid, skip
    }
    
    // Determine which player's score to return and if they won
    const playerScore = playerNumber === 1 ? p1Games : p2Games
    const opponentScore = playerNumber === 1 ? p2Games : p1Games
    const isWinner = playerScore > opponentScore
    
    const scoreObj: { mainScore: string; subscore?: number; isWinner?: boolean } = {
      mainScore: playerScore.toString(),
      isWinner
    }
    
    // Add subscore if tiebreak (only if this player won the tiebreak)
    if (subscore !== undefined && (p1Games === 7 || p2Games === 7)) {
      // In a tiebreak set, the winner has 7 and the subscore is the tiebreak score
      if (isWinner && (playerScore === 7 || opponentScore === 7)) {
        scoreObj.subscore = subscore
      }
    }
    
    playerScores.push(scoreObj)
  })
  
  return playerScores
}


const formatDeadline = (deadline: string) => {
  // Use Ecuador timezone for display
  return new Date(deadline).toLocaleDateString('es-ES', {
    timeZone: 'America/Guayaquil',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Get standing for a specific player
const getPlayerStanding = (playerId: string | null | undefined, standings: any[]) => {
  if (!playerId || !standings || standings.length === 0) return null
  return standings.find((s: any) => s.player_id === playerId)
}

// Get group players with their standings merged
const getGroupPlayersWithStandings = (group: any) => {
  if (!group) return []
  
  // Create a map of standings by player_id
  const standingsMap = new Map()
  if (group.standings && group.standings.length > 0) {
    group.standings.forEach((s: any) => {
      const playerId = s.player_id || s.player?.id
      if (playerId) {
        standingsMap.set(playerId, s)
      }
    })
  }
  
  // Merge players with standings
  const playersWithStandings = (group.players || []).map((p: any) => {
    const playerId = p.player?.id || p.player_id
    const standing = playerId ? standingsMap.get(playerId) : null
    
    if (standing) {
      // Use standing data, ensuring all fields are present
      return {
        id: p.id || standing.id,
        player_id: standing.player_id || playerId,
        player: standing.player || p.player,
        wins: standing.wins ?? 0,
        losses: standing.losses ?? 0,
        points: standing.points ?? 0,
        game_difference: standing.game_difference ?? 0,
        sets_won: standing.sets_won ?? 0,
        sets_lost: standing.sets_lost ?? 0,
        games_won: standing.games_won ?? 0,
        games_lost: standing.games_lost ?? 0
      }
    }
    
    // No standing found, return player with zeros
    return {
      id: p.id,
      player_id: playerId,
      player: p.player,
      wins: 0,
      losses: 0,
      points: 0,
      game_difference: 0,
      sets_won: 0,
      sets_lost: 0,
      games_won: 0,
      games_lost: 0
    }
  })
  
  // Sort by tie-breaker order
  return getSortedStandings(playersWithStandings)
}

// Sort standings by tie-breaker order: Wins → Points → Game Difference → Head-to-head → Sets Difference
const getSortedStandings = (standings: any[]) => {
  if (!standings || standings.length === 0) return []
  
  return [...standings].sort((a, b) => {
    // 1. Wins (descending)
    if (a.wins !== b.wins) {
      return b.wins - a.wins
    }
    
    // 2. Points (descending)
    const pointsA = a.points || 0
    const pointsB = b.points || 0
    if (pointsA !== pointsB) {
      return pointsB - pointsA
    }
    
    // 3. Game difference (descending)
    const gameDiffA = a.game_difference || 0
    const gameDiffB = b.game_difference || 0
    if (gameDiffA !== gameDiffB) {
      return gameDiffB - gameDiffA
    }
    
    // 4. Head-to-head (if applicable - would need match data to calculate)
    // For now, skip this as it requires match history
    
    // 5. Sets difference (descending)
    const setsDiffA = (a.sets_won || 0) - (a.sets_lost || 0)
    const setsDiffB = (b.sets_won || 0) - (b.sets_lost || 0)
    if (setsDiffA !== setsDiffB) {
      return setsDiffB - setsDiffA
    }
    
    return 0
  })
}

// Convert bracket data to Bracketry format
const convertToBracketryFormat = (matches: any[]) => {
  if (!matches || matches.length === 0) return null

  // Build contestants object (required by bracketry)
  const contestants: Record<string, { players: Array<{ title: string }> }> = {}
  // Map to store original match data for click handling
  const matchMap = new Map<string, any>()
  
  // Collect all unique players from matches
  matches.forEach((tm) => {
    const match = tm.match
    
    // Handle BYE matches
    if (tm.is_bye) {
      const byeId = `bye_${tm.id}`
      if (!contestants[byeId]) {
        contestants[byeId] = {
          players: [{ title: "<div style='margin-left: 60px'>BYE</div>" }]
        }
      }
    } else {
      // Player 1
      if (match?.player1_id) {
        if (!contestants[match.player1_id]) {
          contestants[match.player1_id] = {
            players: [{ title: match?.player1?.name || 'TBD' }]
          }
        }
      } else if (!match?.player1_id && match?.player2_id) {
        // TBD player
        const tbdId = `tbd_p1_${tm.id}`
        if (!contestants[tbdId]) {
          contestants[tbdId] = {
            players: [{ title: 'TBD' }]
          }
        }
      }
      
      // Player 2
      if (match?.player2_id) {
        if (!contestants[match.player2_id]) {
          contestants[match.player2_id] = {
            players: [{ title: match?.player2?.name || 'TBD' }]
          }
        }
      } else if (!match?.player2_id && match?.player1_id) {
        // TBD player
        const tbdId = `tbd_p2_${tm.id}`
        if (!contestants[tbdId]) {
          contestants[tbdId] = {
            players: [{ title: 'TBD' }]
          }
        }
      }
    }
  })

  // Convert to Bracketry format: { matches: [...], contestants: {...} }
  // Filter out matches without proper data
  const validMatches = matches.filter((tm) => {
    // Skip if no match data and not a BYE
    if (!tm.is_bye && !tm.match) {
      return false
    }
    return true
  })
  
  const bracketryMatches = validMatches.map((tm, index) => {
    const match = tm.match
    
    // Handle BYE matches
    if (tm.is_bye) {
      const byeId = `bye_${tm.id}`
      const playerId = match?.player1_id || match?.player2_id || `tbd_bye_${tm.id}`
      
      // Ensure player is in contestants if it exists
      if (playerId && !playerId.startsWith('tbd_') && !playerId.startsWith('bye_')) {
        if (!contestants[playerId]) {
          contestants[playerId] = {
            players: [{ title: match?.player1?.name || match?.player2?.name || 'TBD' }]
          }
        }
      } else if (playerId.startsWith('tbd_')) {
        if (!contestants[playerId]) {
          contestants[playerId] = {
            players: [{ title: 'TBD' }]
          }
        }
      }
      
      const bracketryMatchId = tm.id || `bye_match_${index}`
      
      // Store match data in map for click handling (even for BYE matches)
      if (tm.match) {
        matchMap.set(bracketryMatchId, tm.match)
      }
      
      return {
        matchId: bracketryMatchId,
        roundIndex: (tm.round_number || 1) - 1,
        order: tm.bracket_position || index,
        sides: [
          {
            contestantId: playerId,
            isWinner: false
          },
          {
            contestantId: byeId,
            isWinner: false
          }
        ]
      }
    }
    
    // Normal matches
    const player1Id = match?.player1_id || `tbd_p1_${tm.id}`
    const player2Id = match?.player2_id || `tbd_p2_${tm.id}`
    
    // Ensure TBD contestants are in the contestants object
    if (!match?.player1_id && !contestants[player1Id]) {
      contestants[player1Id] = {
        players: [{ title: 'TBD' }]
      }
    }
    if (!match?.player2_id && !contestants[player2Id]) {
      contestants[player2Id] = {
        players: [{ title: 'TBD' }]
      }
    }
    
    const player1Scores = match?.score ? parsePlayerScores(match.score, 1) : null
    const player2Scores = match?.score ? parsePlayerScores(match.score, 2) : null
    
    const sides: any[] = [
      {
        contestantId: player1Id,
        isWinner: match?.winner_id === match?.player1_id
      },
      {
        contestantId: player2Id,
        isWinner: match?.winner_id === match?.player2_id
      }
    ]
    
    // Only add scores if they exist (bracketry doesn't accept empty arrays)
    if (player1Scores && player1Scores.length > 0) {
      sides[0].scores = player1Scores
    }
    if (player2Scores && player2Scores.length > 0) {
      sides[1].scores = player2Scores
    }
    
    const bracketryMatchId = match?.id || tm.id || `match_${index}`
    
    // Store match data in map for click handling
    if (match) {
      matchMap.set(bracketryMatchId, match)
    }
    
    return {
      matchId: bracketryMatchId,
      roundIndex: (tm.round_number || 1) - 1,
      order: tm.bracket_position || index,
      sides
    }
  })

  // Validate that all contestantIds in matches exist in contestants
  bracketryMatches.forEach((match) => {
    match.sides.forEach((side: any) => {
      if (side.contestantId && !contestants[side.contestantId]) {
        console.warn(`Missing contestant for ID: ${side.contestantId}`)
        // Add missing contestant
        contestants[side.contestantId] = {
          players: [{ title: 'TBD' }]
        }
      }
    })
  })

  // Build rounds array based on unique roundIndex values in matches
  const uniqueRoundIndexes = [...new Set(bracketryMatches.map(m => m.roundIndex))].sort((a, b) => a - b)
  const maxRoundIndex = Math.max(...uniqueRoundIndexes, 0)
  
  // Calculate total rounds needed
  let roundsToCreate = uniqueRoundIndexes.length
  
  // If we only have round 0 (first round), calculate how many rounds we need
  // based on the actual number of unique players in the first round
  if (roundsToCreate === 1 && uniqueRoundIndexes[0] === 0) {
    // Get all unique players from round 1 matches (from original matches data, not converted)
    const round1Matches = matches.filter((tm: any) => (tm.round_number || 1) === 1)
    const uniquePlayers = new Set<string>()
    
    round1Matches.forEach((tm: any) => {
      const match = tm.match
      if (match?.player1_id && !tm.is_bye) {
        uniquePlayers.add(match.player1_id)
      }
      if (match?.player2_id && !tm.is_bye) {
        uniquePlayers.add(match.player2_id)
      }
    })
    
    const totalPlayers = uniquePlayers.size
    
    if (totalPlayers > 0) {
      // Calculate total rounds needed for single elimination bracket
      // Formula: ceil(log2(totalPlayers))
      // Examples:
      // - 2 players = 1 round (Final)
      // - 4 players = 2 rounds (Semifinales + Final)
      // - 8 players = 3 rounds (Cuartos + Semifinales + Final)
      // - 16 players = 4 rounds
      roundsToCreate = Math.ceil(Math.log2(totalPlayers))
    } else {
      // Fallback: use number of matches * 2
      const round1MatchCount = round1Matches.length
      if (round1MatchCount > 0) {
        roundsToCreate = Math.ceil(Math.log2(round1MatchCount * 2))
      }
    }
  } else {
    // Use actual max round index + 1 (since roundIndex is 0-based)
    roundsToCreate = maxRoundIndex + 1
  }
  
  // Extract round deadlines from matches
  const roundDeadlines = new Map<number, string>()
  matches.forEach((tm: any) => {
    const roundNum = tm.round_number || 1
    if (tm.round_deadline && !roundDeadlines.has(roundNum)) {
      roundDeadlines.set(roundNum, tm.round_deadline)
    }
  })
  
  const rounds = []
  for (let i = 0; i < roundsToCreate; i++) {
    // Determine round name based on position (from end to beginning)
    const positionFromEnd = roundsToCreate - 1 - i
    let roundName = ''
    const roundNumber = i + 1 // 1-based round number
    
    if (positionFromEnd === 0) {
      // Last round = Final
      roundName = 'Final'
    } else if (positionFromEnd === 1) {
      // Second to last = Semifinales
      roundName = 'Semifinales'
    } else if (positionFromEnd === 2) {
      // Third to last = Cuartos de Final
      roundName = 'Cuartos de Final'
    } else {
      // Earlier rounds = numbered
      roundName = `${roundNumber}ª Ronda`
    }
    
    rounds.push({ name: roundName })
  }
  
  return {
    rounds,
    matches: bracketryMatches,
    contestants,
    matchMap
  }
}

// Helper function to get current round deadline (first round with pending matches)
const getCurrentRoundDeadline = (matches: any[], roundsToCreate: number): { roundName: string; formattedDate: string } | null => {
  const roundDeadlines = new Map<number, string>()
  
  // Extract deadlines from matches, prioritizing rounds with incomplete matches
  matches.forEach((tm: any) => {
    const roundNum = tm.round_number || 1
    const match = tm.match
    // Only consider rounds with matches that are not completed
    if (tm.round_deadline && !roundDeadlines.has(roundNum) && 
        (!match || match.status !== 'completed')) {
      roundDeadlines.set(roundNum, tm.round_deadline)
    }
  })
  
  // Find the earliest round (lowest round number) with a deadline
  const sortedRounds = Array.from(roundDeadlines.keys()).sort((a, b) => a - b)
  if (sortedRounds.length === 0) return null
  
  const currentRoundNumber = sortedRounds[0]
  const deadline = roundDeadlines.get(currentRoundNumber)
  if (!deadline) return null
  
  // Determine round name based on position
  const positionFromEnd = roundsToCreate - currentRoundNumber
  let roundName = ''
  
  if (positionFromEnd === 0) {
    roundName = 'Final'
  } else if (positionFromEnd === 1) {
    roundName = 'Semifinales'
  } else if (positionFromEnd === 2) {
    roundName = 'Cuartos de Final'
  } else {
    roundName = `${currentRoundNumber}ª Ronda`
  }
  
  const deadlineDate = new Date(deadline)
  // Use Ecuador timezone for display
  const formattedDate = deadlineDate.toLocaleDateString('es-ES', {
    timeZone: 'America/Guayaquil',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
  
  return { roundName, formattedDate }
}

const loadBracket = async () => {
  try {
    bracketData.value = await getBracket(props.tournamentId)
    
    // Debug: Log bracket matches by round
    if (bracketData.value?.main && bracketData.value.main.length > 0) {
      console.log(`[TournamentBracket] Total main matches received: ${bracketData.value.main.length}`)
      const matchesByRound = new Map<number, any[]>()
      bracketData.value.main.forEach((tm: any) => {
        const roundNum = tm.round_number || 1
        if (!matchesByRound.has(roundNum)) {
          matchesByRound.set(roundNum, [])
        }
        matchesByRound.get(roundNum)!.push(tm)
      })
      const matchesByRoundArray = Array.from(matchesByRound.entries()).map(([round, matches]) => ({
        round,
        count: matches.length,
        matches: matches.map((m: any) => ({
          id: m.match_id,
          round: m.round_number,
          position: m.bracket_position,
          bracket_type: m.bracket_type,
          player1: m.match?.player1?.name || m.match?.player1_id || 'TBD',
          player2: m.match?.player2?.name || m.match?.player2_id || 'TBD',
          winner: m.match?.winner?.name || m.match?.winner_id || null,
          hasMatch: !!m.match,
          matchId: m.match?.id || 'NO MATCH ID',
          isBye: m.is_bye
        }))
      }))
      console.log('Main bracket matches by round:', matchesByRoundArray)
      console.log('Total rounds found:', matchesByRoundArray.length)
      console.log('Round numbers:', matchesByRoundArray.map(r => r.round))
      
      // Also log raw data for debugging
      console.log('Raw main matches:', bracketData.value.main.map((m: any) => ({
        tournament_match_id: m.id,
        match_id: m.match_id,
        round: m.round_number,
        position: m.bracket_position,
        bracket_type: m.bracket_type,
        hasMatch: !!m.match,
        matchData: m.match ? {
          id: m.match.id,
          status: m.match.status,
          player1_id: m.match.player1_id,
          player2_id: m.match.player2_id,
          winner_id: m.match.winner_id,
          score: m.match.score
        } : null,
        isBye: m.is_bye
      })))
      
      // Check if any matches are completed
      const completedMatches = bracketData.value.main.filter((m: any) => 
        m.match?.status === 'completed' && m.match?.winner_id
      )
      console.log(`[TournamentBracket] Completed matches in main bracket: ${completedMatches.length}`, completedMatches.map((m: any) => ({
        match_id: m.match_id,
        round: m.round_number,
        winner: m.match?.winner_id
      })))
    } else {
      console.log('[TournamentBracket] No main matches found in bracketData')
    }
    
    // Extract round deadlines for main bracket
    if (bracketData.value?.main && bracketData.value.main.length > 0) {
      const uniqueRoundIndexes = [...new Set(bracketData.value.main.map((tm: any) => (tm.round_number || 1) - 1))].sort((a, b) => (a as number) - (b as number)) as number[]
      const maxRoundIndex = Math.max(...(uniqueRoundIndexes.length > 0 ? uniqueRoundIndexes : [0]), 0)
      let roundsToCreate = uniqueRoundIndexes.length
      
      if (roundsToCreate === 1 && uniqueRoundIndexes[0] === 0) {
        const round1Matches = bracketData.value.main.filter((tm: any) => (tm.round_number || 1) === 1)
        const uniquePlayers = new Set<string>()
        round1Matches.forEach((tm: any) => {
          const match = tm.match
          if (match?.player1_id && !tm.is_bye) uniquePlayers.add(match.player1_id)
          if (match?.player2_id && !tm.is_bye) uniquePlayers.add(match.player2_id)
        })
        const totalPlayers = uniquePlayers.size
        if (totalPlayers > 0) {
          roundsToCreate = Math.ceil(Math.log2(totalPlayers))
        }
      } else {
        roundsToCreate = maxRoundIndex + 1
      }
      
      mainCurrentRoundDeadline.value = getCurrentRoundDeadline(bracketData.value.main, roundsToCreate)
    }
    
    // Extract round deadlines for backdraw bracket
    if (bracketData.value?.backdraw && bracketData.value.backdraw.length > 0) {
      const uniqueRoundIndexes = [...new Set(bracketData.value.backdraw.map((tm: any) => (tm.round_number || 1) - 1))].sort((a, b) => (a as number) - (b as number)) as number[]
      const maxRoundIndex = Math.max(...(uniqueRoundIndexes.length > 0 ? uniqueRoundIndexes : [0]), 0)
      let roundsToCreate = uniqueRoundIndexes.length
      
      if (roundsToCreate === 1 && uniqueRoundIndexes[0] === 0) {
        const round1Matches = bracketData.value.backdraw.filter((tm: any) => (tm.round_number || 1) === 1)
        const uniquePlayers = new Set<string>()
        round1Matches.forEach((tm: any) => {
          const match = tm.match
          if (match?.player1_id && !tm.is_bye) uniquePlayers.add(match.player1_id)
          if (match?.player2_id && !tm.is_bye) uniquePlayers.add(match.player2_id)
        })
        const totalPlayers = uniquePlayers.size
        if (totalPlayers > 0) {
          roundsToCreate = Math.ceil(Math.log2(totalPlayers))
        }
      } else {
        roundsToCreate = maxRoundIndex + 1
      }
      
      backdrawCurrentRoundDeadline.value = getCurrentRoundDeadline(bracketData.value.backdraw, roundsToCreate)
    }

    // Initialize Bracketry for main bracket (only on client side)
    if (process.client) {
      await nextTick()
      await loadBracketry()
      
      if (bracketData.value?.main && bracketData.value.main.length > 0 && mainBracketContainer.value && createBracket) {
        // Clear container first
        mainBracketContainer.value.innerHTML = ''
        const mainBracketData = convertToBracketryFormat(bracketData.value.main)
        if (mainBracketData && mainBracketData.matches && mainBracketData.matches.length > 0) {
          // Store match map for click handling
          if (mainBracketData.matchMap) {
            mainBracketMatchMap.value = mainBracketData.matchMap
          }
          
          try {
            // Pass options to createBracket with font settings
            // Using 'inherit' to inherit Geist from the page
            const bracketOptions = {
              rootFontFamily: 'inherit', // Inherits Geist from the page
              roundTitlesFontFamily: 'inherit',
              playerTitleFontFamily: 'inherit',
              scoreFontFamily: 'inherit',
              roundTitlesFontSize: 18,
              matchFontSize: 14,
              matchTextColor: 'oklch(0.95 0 0)',
              highlightedPlayerTitleColor: 'oklch(0.70 0.22 150)',
              connectionLinesColor: 'oklch(0.55 0.01 250)', // Lighter color for visibility on dark background
              highlightedConnectionLinesColor: 'oklch(0.70 0.22 150)', // Accent color for highlighted lines
              onMatchClick: (match: any) => {
                const matchId = match.matchId
                const matchData = mainBracketMatchMap.value.get(matchId)
                if (matchData && canViewMatchDetails(matchData)) {
                  navigateTo(`/matches/${matchId}${props.tournamentId ? `?from=tournament&tournamentId=${props.tournamentId}` : ''}`)
                }
              }
            }
            createBracket(mainBracketData, mainBracketContainer.value, bracketOptions)
            
            // Fix width after bracketry renders to prevent overflow
            await nextTick()
            const bracketRoot = mainBracketContainer.value?.querySelector('.bracket-root') as HTMLElement
            if (bracketRoot) {
              bracketRoot.style.setProperty('--width', '100%', 'important')
              bracketRoot.style.width = '100%'
              bracketRoot.style.maxWidth = '100%'
              bracketRoot.style.overflow = 'hidden'
            }
          } catch (error) {
            console.error('Error creating main bracket:', error)
          }
        } else {
          console.warn('Main bracket data is invalid or empty:', mainBracketData)
        }
      }

      // Initialize Bracketry for backdraw bracket
      if (bracketData.value?.backdraw && bracketData.value.backdraw.length > 0 && backdrawBracketContainer.value && createBracket) {
        // Clear container first
        backdrawBracketContainer.value.innerHTML = ''
        const backdrawBracketData = convertToBracketryFormat(bracketData.value.backdraw)
        if (backdrawBracketData && backdrawBracketData.matches && backdrawBracketData.matches.length > 0) {
          // Store match map for click handling
          if (backdrawBracketData.matchMap) {
            backdrawBracketMatchMap.value = backdrawBracketData.matchMap
          }
          
          try {
            // Pass options to createBracket with font settings
            // Using 'inherit' to inherit Geist from the page
            const bracketOptions = {
              rootFontFamily: 'inherit', // Inherits Geist from the page
              roundTitlesFontFamily: 'inherit',
              playerTitleFontFamily: 'inherit',
              scoreFontFamily: 'inherit',
              roundTitlesFontSize: 18,
              matchFontSize: 14,
              matchTextColor: 'oklch(0.95 0 0)',
              highlightedPlayerTitleColor: 'oklch(0.70 0.22 150)',
              connectionLinesColor: 'oklch(0.55 0.01 250)', // Lighter color for visibility on dark background
              highlightedConnectionLinesColor: 'oklch(0.70 0.22 150)', // Accent color for highlighted lines
              onMatchClick: (match: any) => {
                const matchId = match.matchId
                const matchData = backdrawBracketMatchMap.value.get(matchId)
                if (matchData && canViewMatchDetails(matchData)) {
                  navigateTo(`/matches/${matchId}${props.tournamentId ? `?from=tournament&tournamentId=${props.tournamentId}` : ''}`)
                }
              }
            }
            createBracket(backdrawBracketData, backdrawBracketContainer.value, bracketOptions)
            
            // Fix width after bracketry renders to prevent overflow
            await nextTick()
            const bracketRoot = backdrawBracketContainer.value?.querySelector('.bracket-root') as HTMLElement
            if (bracketRoot) {
              bracketRoot.style.setProperty('--width', '100%', 'important')
              bracketRoot.style.width = '100%'
              bracketRoot.style.maxWidth = '100%'
              bracketRoot.style.overflow = 'hidden'
            }
          } catch (error) {
            console.error('Error creating backdraw bracket:', error)
          }
        } else {
          console.warn('Backdraw bracket data is invalid or empty:', backdrawBracketData)
        }
      }
    }
  } catch (err) {
    console.error('Error loading bracket:', err)
  }
}

watch(() => props.tournamentId, () => {
  if (props.tournamentId) {
    loadBracket()
  }
}, { immediate: true })

// Expose refresh method for parent components
defineExpose({
  refresh: loadBracket
})

// Group matches functions
const openGroupMatches = async (groupId: string) => {
  selectedGroupId.value = groupId
  loadingGroupMatches.value = true
  groupMatches.value = []
  
  try {
    const response = await $fetch(`/api/tournaments/${props.tournamentId}/group/${groupId}/matches`)
    groupMatches.value = response || []
  } catch (error) {
    console.error('Error loading group matches:', error)
  } finally {
    loadingGroupMatches.value = false
  }
}

const closeGroupMatches = () => {
  selectedGroupId.value = null
  groupMatches.value = []
}

onMounted(() => {
  if (props.tournamentId) {
    loadBracket()
  }
})
</script>

<style scoped>
/* Bracketry Container */
.bracketry-container {
  height: 700px;
  min-height: 600px;
  width: 100%;
  overflow-x: auto;
  overflow-y: auto;
  padding: 1rem;
  position: relative;
  box-sizing: border-box;
}

/* Ensure bracket root has proper containment - this is the width limit */
.bracketry-container .bracket-root {
  position: relative;
  width: 100% !important; /* Override inline style */
  max-width: 100% !important;
  height: 100%;
  margin: 0;
  /* Clip lines that extend beyond the bracket-root boundaries */
  overflow: hidden !important;
  box-sizing: border-box;
  /* Prevent content from expanding beyond container */
  contain: layout style;
}

/* Override the inline --width style that bracketry sets */
.bracketry-container .bracket-root[style*="--width"] {
  --width: 100% !important;
}

/* Ensure matches container is contained within bracket-root */
.bracketry-container .matches-scroller {
  overflow: hidden !important;
  padding: 0;
  position: relative;
  width: 100% !important;
  max-width: 100% !important;
  box-sizing: border-box;
  contain: layout;
}

.bracketry-container .matches-positioner {
  overflow: hidden !important;
  position: relative;
  padding: 0;
  width: 100% !important;
  max-width: 100% !important;
  box-sizing: border-box;
  contain: layout;
}

/* Override inline width styles from bracketry */
.bracketry-container .matches-positioner[style*="width"] {
  width: 100% !important;
  margin-left: 0% !important;
}

.bracketry-container .round-titles-wrapper[style*="width"] {
  width: 100% !important;
  margin-left: 0% !important;
}

/* Ensure SVG lines are contained within bracket-root */
.bracketry-container .bracket-root svg,
.bracketry-container .bracket-root [class*="connection"],
.bracketry-container .bracket-root [class*="line"] {
  max-width: 100%;
  overflow: hidden;
  position: relative;
  /* Ensure lines don't extend beyond bracket-root */
  box-sizing: border-box;
}

/* Ensure match lines area is contained */
.bracketry-container .match-lines-area {
  position: relative;
  overflow: hidden;
  max-width: 100%;
  box-sizing: border-box;
}

/* Ensure SVG lines don't extend beyond container on mobile */
@media (max-width: 768px) {
  .bracketry-container {
    padding: 1rem 0.5rem;
    overflow-x: auto;
    overflow-y: auto;
  }
  
  .bracketry-container .bracket-root {
    width: 100%;
    max-width: 100%;
    overflow: hidden;
  }
  
  .bracketry-container .matches-scroller {
    padding: 0;
    overflow: hidden;
  }
  
  .bracketry-container .matches-positioner {
    padding: 0;
    overflow: hidden;
  }
}
</style>

<style>
/* Bracketry Custom Styling to match project design - global styles for bracketry elements */
.bracketry-container .bracket-root {
  --rootBgColor: transparent;
  --roundTitleColor: oklch(0.95 0 0);
  --matchTextColor: oklch(0.95 0 0);
  --matchFontSize: 14px;
  --roundTitlesFontSize: 18px;
  --roundTitlesFontFamily: var(--font-sans);
  --matchFontFamily: var(--font-sans);
  --playerTitleFontFamily: var(--font-sans);
  --scoreFontFamily: var(--font-sans);
  --connectionLinesColor: oklch(0.55 0.01 250); /* Lighter color for visibility on dark background */
  --highlightedConnectionLinesColor: oklch(0.70 0.22 150); /* Accent color for highlighted lines */
  --rootBorderColor: oklch(0.22 0.01 250);
  --liveMatchBorderColor: oklch(0.70 0.22 150);
  --matchStatusBgColor: oklch(0.20 0.01 250);
  --scrollbarColor: oklch(0.22 0.01 250 / 0.23);
  --navButtonSvgColor: oklch(0.95 0 0); /* White arrows */
  --scrollButtonSvgColor: oklch(0.95 0 0); /* White arrows */
  background: transparent;
}

/* Don't apply font styles to SVG elements or connection lines */
.bracketry-container .bracket-root svg,
.bracketry-container .bracket-root [class*="connection"],
.bracketry-container .bracket-root [class*="line"],
.bracketry-container .bracket-root path,
.bracketry-container .bracket-root line {
  font-family: initial !important;
  -webkit-font-smoothing: initial !important;
  -moz-osx-font-smoothing: initial !important;
}

.bracketry-container .round-titles-wrapper {
  color: oklch(0.95 0 0) !important;
}

.bracketry-container .round-titles-wrapper > *:not(svg):not([class*="connection"]):not([class*="line"]) {
  font-family: var(--font-sans) !important;
  font-weight: 600 !important;
  -webkit-font-smoothing: antialiased !important;
  -moz-osx-font-smoothing: grayscale !important;
}

/* Style for round titles with deadlines */
.bracketry-container .round-title {
  line-height: 1.4 !important;
}

.bracketry-container .round-title span {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.75em !important;
  opacity: 0.7;
  font-weight: 400 !important;
  color: oklch(0.70 0.01 250) !important;
}

.bracketry-container .match {
  background: oklch(0.20 0.01 250) !important;
  border-color: oklch(0.22 0.01 250) !important;
  color: oklch(0.95 0 0) !important;
  border-radius: 0.75rem !important;
  transition: all 0.2s ease !important;
}

.bracketry-container .match > *:not(svg):not([class*="connection"]):not([class*="line"]):not(path):not(line):not(polyline) {
  font-family: var(--font-sans) !important;
  -webkit-font-smoothing: antialiased !important;
  -moz-osx-font-smoothing: grayscale !important;
}

.bracketry-container .match:hover {
  background: oklch(0.22 0.01 250) !important;
  border-color: oklch(0.70 0.22 150) !important;
}

.bracketry-container .player-title,
.bracketry-container [class*="player"]:not(svg):not([class*="connection"]):not([class*="line"]) {
  color: oklch(0.95 0 0) !important;
  font-weight: 600 !important;
  font-family: var(--font-sans) !important;
  -webkit-font-smoothing: antialiased !important;
  -moz-osx-font-smoothing: grayscale !important;
}

.bracketry-container .player-title.highlighted,
.bracketry-container [class*="highlighted"] {
  color: oklch(0.70 0.22 150) !important;
}

.bracketry-container .score,
.bracketry-container [class*="score"]:not(svg):not([class*="connection"]):not([class*="line"]) {
  color: oklch(0.70 0.01 250) !important;
  font-family: var(--font-sans) !important;
  -webkit-font-smoothing: antialiased !important;
  -moz-osx-font-smoothing: grayscale !important;
}

.bracketry-container .score.is-winner,
.bracketry-container [class*="winner"] {
  color: oklch(0.70 0.22 150) !important;
  font-weight: 600 !important;
}

.bracketry-container .navigation-button,
.bracketry-container .scroll-button,
.bracketry-container [class*="button"] {
  background: oklch(0.20 0.01 250) !important;
  border-color: oklch(0.22 0.01 250) !important;
  color: oklch(0.70 0.01 250) !important;
  transition: all 0.2s ease !important;
  font-family: var(--font-sans) !important;
}

.bracketry-container .navigation-button:hover,
.bracketry-container .scroll-button:hover,
.bracketry-container [class*="button"]:hover {
  background: oklch(0.22 0.01 250) !important;
  color: oklch(0.95 0 0) !important;
  border-color: oklch(0.70 0.22 150) !important;
}

/* Make arrow icons white */
.bracketry-container .navigation-button svg,
.bracketry-container .scroll-button svg,
.bracketry-container [class*="button"] svg,
.bracketry-container [class*="nav-icon"],
.bracketry-container [class*="scroll-icon"] {
  fill: oklch(0.95 0 0) !important;
  color: oklch(0.95 0 0) !important;
  stroke: oklch(0.95 0 0) !important;
}

/* Force font on text elements inside bracket, but exclude SVG and line elements */
.bracketry-container div:not(svg):not([class*="connection"]):not([class*="line"]),
.bracketry-container span:not(svg):not([class*="connection"]):not([class*="line"]),
.bracketry-container p:not(svg):not([class*="connection"]):not([class*="line"]),
.bracketry-container td:not(svg):not([class*="connection"]):not([class*="line"]),
.bracketry-container th:not(svg):not([class*="connection"]):not([class*="line"]) {
  font-family: var(--font-sans) !important;
  -webkit-font-smoothing: antialiased !important;
  -moz-osx-font-smoothing: grayscale !important;
}

/* Ensure SVG and connection elements are not affected by font styles */
.bracketry-container svg,
.bracketry-container svg *,
.bracketry-container [class*="connection"],
.bracketry-container [class*="connection"] *,
.bracketry-container [class*="line"],
.bracketry-container [class*="line"] *,
.bracketry-container path,
.bracketry-container line,
.bracketry-container polyline,
.bracketry-container g,
.bracketry-container [class*="svg"],
.bracketry-container [class*="connector"] {
  font-family: initial !important;
  overflow: visible !important;
  clip-path: none !important;
  clip: auto !important;
  max-width: none !important;
  max-height: none !important;
}

/* Ensure parent containers of SVG don't clip */
.bracketry-container [class*="matches"],
.bracketry-container [class*="matches-positioner"],
.bracketry-container [class*="matches-scroller"] {
  overflow: visible !important;
}
</style>

