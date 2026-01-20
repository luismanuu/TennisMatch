<template>
  <div class="min-h-screen bg-background relative overflow-hidden">
    <!-- Ambient Background Effects -->
    <div class="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <div class="orb orb-accent w-96 h-96 -top-48 -right-48 animate-float opacity-20"></div>
      <div class="orb orb-secondary w-80 h-80 -bottom-40 -left-40 animate-float-delayed opacity-15"></div>
      <div class="grid-pattern absolute inset-0 opacity-30"></div>
    </div>

    <!-- Navigation -->
    <AppNavigation />

    <div class="h-16"></div>

    <div class="section-padding relative z-10">
      <div class="container-medium px-6">
        <!-- Header -->
        <div class="text-center mb-10 animate-fade-up">
          <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-subtle/30 border border-accent/30 backdrop-blur-sm mb-6">
            <Icon name="heroicons:chart-bar-square" class="w-4 h-4 text-accent" />
            <span class="text-size-4 font-semibold text-accent">Mi Ranking</span>
          </div>
          <h1 class="text-size-1 font-semibold text-foreground mb-3">
            Tu Clasificación y Progreso
          </h1>
          <p class="text-size-3 font-regular text-foreground-muted max-w-lg mx-auto">
            Sigue tu evolución, alcanza nuevos tiers y compite por el top
          </p>
        </div>

        <!-- Loading State -->
        <div v-if="loading || playerLoading" class="glass-card-elevated p-12 text-center animate-fade-in-scale">
          <div class="w-16 h-16 rounded-full bg-accent-subtle flex items-center justify-center mx-auto mb-6">
            <Icon name="heroicons:arrow-path" class="w-8 h-8 text-accent animate-spin" />
          </div>
          <p class="text-size-3 font-regular text-foreground-muted">Cargando tu ranking...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="glass-card-elevated p-10 max-w-md mx-auto animate-fade-in-scale">
          <div class="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
            <Icon name="heroicons:exclamation-triangle" class="w-10 h-10 text-red-400" />
          </div>
          <h3 class="text-size-2 font-semibold text-foreground mb-3 text-center">Error</h3>
          <p class="text-size-4 font-regular text-foreground-muted mb-6 text-center">{{ error.message || 'Ocurrió un error' }}</p>
          <button @click="loadAllData" class="btn-primary text-size-3 w-full justify-center group">
            <Icon name="heroicons:arrow-path" class="w-5 h-5 mr-2 group-hover:rotate-180 transition-transform duration-500" />
            Reintentar
          </button>
        </div>

        <!-- No Player State - only show when NOT loading and no player exists -->
        <div v-else-if="!loading && !player" class="glass-card-elevated p-12 text-center max-w-md mx-auto animate-fade-in-scale">
          <div class="w-24 h-24 rounded-2xl bg-gradient-to-br from-accent-subtle to-accent-subtle/50 border-2 border-accent/30 flex items-center justify-center mx-auto mb-6">
            <Icon name="heroicons:user" class="w-12 h-12 text-accent" />
          </div>
          <h3 class="text-size-2 font-semibold text-foreground mb-4">Completa tu perfil</h3>
          <p class="text-size-4 font-regular text-foreground-muted leading-relaxed mb-8">
            Necesitas crear tu perfil de jugador para ver tu ranking.
          </p>
          <NuxtLink to="/onboarding" class="btn-primary text-size-4 inline-flex items-center group">
            <Icon name="heroicons:arrow-right" class="w-4 h-4 mr-2 group-hover:translate-x-1 transition-transform" />
            Crear Perfil
          </NuxtLink>
        </div>

        <!-- Main Content -->
        <template v-else>
          <!-- Section A: Current Rating Card -->
          <div class="glass-card-elevated p-8 mb-6 animate-fade-up">
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <!-- ELO and Tier -->
              <div class="flex items-center gap-5">
                <div class="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 border-2 border-accent/30 flex items-center justify-center">
                  <Icon name="heroicons:trophy" class="w-10 h-10 text-accent" />
                </div>
                <div>
                  <div class="text-size-1 font-bold text-gradient-static mb-1">
                    {{ player.elo }} ELO
                  </div>
                  <RatingTierBadge 
                    :elo="player.elo" 
                    :total-matches-played="player.total_matches_played || 0"
                    :placement-matches-completed="player.placement_matches_completed || 0"
                  />
                </div>
              </div>

              <!-- Percentile and Rank (only show if not in placement) -->
              <div v-if="position && !isInPlacement" class="flex gap-6 text-center md:text-right">
                <div>
                  <p class="text-size-5 text-foreground-muted mb-1">Posición Global</p>
                  <p class="text-size-2 font-bold text-foreground">#{{ position.global_rank }}</p>
                  <p class="text-size-5 text-foreground-muted">de {{ position.total_players }}</p>
                </div>
                <div>
                  <p class="text-size-5 text-foreground-muted mb-1">Percentil</p>
                  <p class="text-size-2 font-bold text-accent">Top {{ position.percentile }}%</p>
                  <p class="text-size-5 text-foreground-muted">de jugadores</p>
                </div>
              </div>
              
              <!-- Placement Message (only show if in placement) -->
              <div v-if="isInPlacement" class="text-center md:text-right">
                <div class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <Icon name="heroicons:information-circle" class="w-5 h-5 text-amber-400" />
                  <p class="text-size-4 text-amber-400 font-semibold">ELO Aproximado</p>
                </div>
                <p class="text-size-5 text-foreground-muted mt-2">
                  Tu ranking final se establecerá después de 3 partidos
                </p>
              </div>
            </div>

            <!-- Placement Progress (if in placement) -->
            <div v-if="isInPlacement" class="mt-6 pt-6 border-t border-border-subtle">
              <div class="flex items-center justify-between mb-3">
                <span class="text-size-4 font-semibold text-foreground">Partidos de Colocación</span>
                <span class="text-size-4 text-accent font-semibold">{{ player.placement_matches_completed || 0 }} / 3</span>
              </div>
              <div class="h-3 bg-surface-elevated rounded-full overflow-hidden">
                <div 
                  class="h-full bg-gradient-to-r from-accent to-accent/80 rounded-full transition-all duration-500"
                  :style="{ width: `${((player.placement_matches_completed || 0) / 3) * 100}%` }"
                ></div>
              </div>
              <p class="text-size-5 text-foreground-muted mt-2">
                Completa 3 partidos para establecer tu ranking definitivo
              </p>
            </div>
          </div>

          <!-- Section B: Next Tier Progress (hide during placement) -->
          <div v-if="!isInPlacement && nextTierProgress && !nextTierProgress.isMaxTier" class="glass-card-elevated p-6 mb-6 animate-fade-up animate-delay-1">
            <div class="flex items-center gap-4 mb-4">
              <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 border border-purple-500/30 flex items-center justify-center">
                <Icon name="heroicons:arrow-trending-up" class="w-6 h-6 text-purple-400" />
              </div>
              <div class="flex-1">
                <h3 class="text-size-3 font-semibold text-foreground">Próximo Tier</h3>
                <p class="text-size-4 text-foreground-muted">
                  <span class="font-semibold" :style="{ color: nextTierProgress.nextTier?.color }">
                    {{ nextTierProgress.nextTier?.tier }}
                  </span>
                  ({{ nextTierProgress.nextTier?.minElo }} ELO)
                </p>
              </div>
              <div class="text-right">
                <span class="text-size-2 font-bold text-foreground">{{ nextTierProgress.eloNeeded }}</span>
                <span class="text-size-4 text-foreground-muted"> ELO más</span>
              </div>
            </div>
            
            <!-- Progress Bar -->
            <div class="relative">
              <div class="h-4 bg-surface-elevated rounded-full overflow-hidden">
                <div 
                  class="h-full rounded-full transition-all duration-700 ease-out"
                  :style="{ 
                    width: `${nextTierProgress.progressPercent}%`,
                    backgroundColor: nextTierProgress.currentTier.color 
                  }"
                ></div>
              </div>
              <div class="flex justify-between mt-2 text-size-5 text-foreground-muted">
                <span>{{ nextTierProgress.currentTier.minElo }}</span>
                <span class="font-semibold text-foreground">{{ player.elo }}</span>
                <span>{{ nextTierProgress.currentTier.maxElo }}</span>
              </div>
            </div>
          </div>

          <!-- Max Tier Badge -->
          <div v-else-if="nextTierProgress?.isMaxTier" class="glass-card-elevated p-6 mb-6 animate-fade-up animate-delay-1">
            <div class="flex items-center gap-4">
              <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-500/20 border-2 border-orange-500/40 flex items-center justify-center">
                <Icon name="heroicons:star" class="w-8 h-8 text-orange-400" />
              </div>
              <div>
                <h3 class="text-size-2 font-bold text-gradient-static">¡Grandmaster!</h3>
                <p class="text-size-4 text-foreground-muted">Has alcanzado el tier más alto. ¡Eres un maestro!</p>
              </div>
            </div>
          </div>

          <!-- Section C: Stats Grid (simplified during placement) -->
          <div v-if="!isInPlacement" class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 animate-fade-up animate-delay-2">
            <!-- Total Matches -->
            <div class="glass-card p-5 text-center hover-lift">
              <div class="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-3">
                <Icon name="heroicons:play" class="w-5 h-5 text-blue-400" />
              </div>
              <p class="text-size-2 font-bold text-foreground">{{ player.total_matches_played || 0 }}</p>
              <p class="text-size-5 text-foreground-muted">Partidos</p>
            </div>

            <!-- Win Rate -->
            <div class="glass-card p-5 text-center hover-lift">
              <div class="w-10 h-10 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-3">
                <Icon name="heroicons:chart-pie" class="w-5 h-5 text-green-400" />
              </div>
              <p class="text-size-2 font-bold text-foreground">{{ winRate }}%</p>
              <p class="text-size-5 text-foreground-muted">Win Rate</p>
            </div>

            <!-- Peak ELO -->
            <div class="glass-card p-5 text-center hover-lift">
              <div class="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-3">
                <Icon name="heroicons:arrow-up-circle" class="w-5 h-5 text-amber-400" />
              </div>
              <p class="text-size-2 font-bold text-foreground">{{ historyStats?.peak_elo || player.elo }}</p>
              <p class="text-size-5 text-foreground-muted">Peak ELO</p>
            </div>

            <!-- Current Streak -->
            <div class="glass-card p-5 text-center hover-lift">
              <div 
                class="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-3"
                :class="player.win_streak > 0 
                  ? 'bg-orange-500/10 border border-orange-500/20' 
                  : player.loss_streak > 0 
                    ? 'bg-cyan-500/10 border border-cyan-500/20'
                    : 'bg-surface-elevated border border-border-subtle'"
              >
                <Icon 
                  :name="player.win_streak > 0 ? 'heroicons:fire' : player.loss_streak > 0 ? 'heroicons:bolt-slash' : 'heroicons:minus'" 
                  class="w-5 h-5"
                  :class="player.win_streak > 0 ? 'text-orange-400' : player.loss_streak > 0 ? 'text-cyan-400' : 'text-foreground-muted'"
                />
              </div>
              <p class="text-size-2 font-bold text-foreground">
                <template v-if="player.win_streak > 0">
                  {{ player.win_streak }} <span class="text-orange-400">🔥</span>
                </template>
                <template v-else-if="player.loss_streak > 0">
                  {{ player.loss_streak }} <span class="text-cyan-400">❄️</span>
                </template>
                <template v-else>
                  0
                </template>
              </p>
              <p class="text-size-5 text-foreground-muted">
                {{ player.win_streak > 0 ? 'Victorias' : player.loss_streak > 0 ? 'Derrotas' : 'Racha' }}
              </p>
            </div>
          </div>

          <!-- Section D: ELO History Chart (hide during placement) -->
          <div v-if="!isInPlacement" class="glass-card-elevated p-6 mb-6 animate-fade-up animate-delay-3">
            <div class="flex items-center justify-between mb-6">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg bg-accent-subtle flex items-center justify-center">
                  <Icon name="heroicons:chart-bar" class="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h3 class="text-size-3 font-semibold text-foreground">Historial de ELO</h3>
                  <p class="text-size-5 text-foreground-muted">Progresión en los últimos {{ ratingHistory.length }} partidos</p>
                </div>
              </div>
            </div>
            
            <EloHistoryChart :history-data="ratingHistory" />
          </div>

          <!-- Section D.1: Recent Competitive Matches (hide during placement) -->
          <div v-if="!isInPlacement" class="glass-card-elevated p-6 mb-6 animate-fade-up animate-delay-3">
            <div class="flex items-center gap-3 mb-6">
              <div class="w-10 h-10 rounded-lg bg-accent-subtle flex items-center justify-center">
                <Icon name="heroicons:clock" class="w-5 h-5 text-accent" />
              </div>
              <div>
                <h3 class="text-size-3 font-semibold text-foreground">Últimas Partidas Competitivas</h3>
                <p class="text-size-5 text-foreground-muted">Historial de tus últimos encuentros</p>
              </div>
            </div>
            
            <!-- Matches List -->
            <div v-if="recentMatches.length > 0" class="space-y-3">
              <div
                v-for="(match, index) in recentMatches"
                :key="match.id"
                class="flex items-center gap-4 p-4 rounded-xl border transition-all hover:border-accent/50 hover:bg-surface-elevated"
                :class="match.was_winner 
                  ? 'bg-green-500/5 border-green-500/20' 
                  : 'bg-red-500/5 border-red-500/20'"
              >
                <!-- Result Icon -->
                <div 
                  class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  :class="match.was_winner 
                    ? 'bg-green-500/20 border border-green-500/30' 
                    : 'bg-red-500/20 border border-red-500/30'"
                >
                  <Icon 
                    :name="match.was_winner ? 'heroicons:check-circle' : 'heroicons:x-circle'" 
                    class="w-6 h-6"
                    :class="match.was_winner ? 'text-green-400' : 'text-red-400'"
                  />
                </div>

                <!-- Opponent Info -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <p class="text-size-3 font-semibold text-foreground truncate">
                      {{ match.opponent?.name || 'Oponente desconocido' }}
                    </p>
                    <span 
                      v-if="match.is_placement_match"
                      class="px-2 py-0.5 rounded-full text-size-5 font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    >
                      Colocación
                    </span>
                  </div>
                  <p class="text-size-5 text-foreground-muted">
                    {{ formatMatchDate(match.created_at) }}
                  </p>
                </div>

                <!-- ELO Change -->
                <div class="text-right flex-shrink-0">
                  <div 
                    class="text-size-2 font-bold"
                    :class="match.elo_change > 0 ? 'text-green-400' : match.elo_change < 0 ? 'text-red-400' : 'text-foreground-muted'"
                  >
                    {{ match.elo_change > 0 ? '+' : '' }}{{ match.elo_change }}
                  </div>
                  <div class="text-size-5 text-foreground-muted">
                    ELO
                  </div>
                </div>
              </div>
            </div>

            <!-- Empty State -->
            <div v-else class="text-center py-12">
              <div class="w-16 h-16 rounded-2xl bg-surface-elevated border border-border-subtle flex items-center justify-center mx-auto mb-4">
                <Icon name="heroicons:calendar" class="w-8 h-8 text-foreground-muted" />
              </div>
              <p class="text-size-3 font-semibold text-foreground mb-2">Sin partidas aún</p>
              <p class="text-size-4 text-foreground-muted mb-6">
                Juega partidas competitivas para ver tu historial aquí
              </p>
              <NuxtLink to="/matchmaking" class="btn-primary text-size-4 inline-flex items-center group">
                <Icon name="heroicons:magnifying-glass" class="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                Buscar Partida
              </NuxtLink>
            </div>
          </div>

          <!-- Section E: Monthly Decay Status -->
          <div v-if="!isInPlacement" class="glass-card-elevated p-6 animate-fade-up animate-delay-4">
            <div class="flex items-center gap-4 mb-4">
              <div 
                class="w-12 h-12 rounded-xl flex items-center justify-center"
                :class="decayStatus?.matches_this_month >= (decayStatus?.matches_required || 2)
                  ? 'bg-green-500/10 border border-green-500/20'
                  : decayStatus?.days_remaining_in_month <= 7
                    ? 'bg-red-500/10 border border-red-500/20'
                    : 'bg-amber-500/10 border border-amber-500/20'"
              >
                <Icon 
                  name="heroicons:clock" 
                  class="w-6 h-6"
                  :class="decayStatus?.matches_this_month >= (decayStatus?.matches_required || 2)
                    ? 'text-green-400'
                    : decayStatus?.days_remaining_in_month <= 7
                      ? 'text-red-400'
                      : 'text-amber-400'"
                />
              </div>
              <div class="flex-1">
                <h3 class="text-size-3 font-semibold text-foreground">Actividad Mensual</h3>
                <p class="text-size-4 text-foreground-muted">
                  Partidos este mes: 
                  <span class="font-semibold text-foreground">
                    {{ decayStatus?.matches_this_month || 0 }} / {{ decayStatus?.matches_required || 2 }}
                  </span>
                </p>
              </div>
              <div class="text-right">
                <p class="text-size-4 font-semibold text-foreground">{{ decayStatus?.days_remaining_in_month || 0 }}</p>
                <p class="text-size-5 text-foreground-muted">días restantes</p>
              </div>
            </div>

            <!-- Progress Bar -->
            <div class="h-2 bg-surface-elevated rounded-full overflow-hidden mb-3">
              <div 
                class="h-full rounded-full transition-all duration-500"
                :class="decayStatus?.matches_this_month >= (decayStatus?.matches_required || 2)
                  ? 'bg-green-500'
                  : 'bg-amber-500'"
                :style="{ width: `${Math.min(((decayStatus?.matches_this_month || 0) / (decayStatus?.matches_required || 2)) * 100, 100)}%` }"
              ></div>
            </div>

            <!-- Status Message -->
            <div 
              class="flex items-center gap-2 text-size-4"
              :class="decayStatus?.matches_this_month >= (decayStatus?.matches_required || 2)
                ? 'text-green-400'
                : 'text-amber-400'"
            >
              <Icon 
                :name="decayStatus?.matches_this_month >= (decayStatus?.matches_required || 2)
                  ? 'heroicons:check-circle'
                  : 'heroicons:exclamation-triangle'" 
                class="w-4 h-4"
              />
              <span v-if="decayStatus?.matches_this_month >= (decayStatus?.matches_required || 2)">
                ¡Meta cumplida! Tu ELO está protegido este mes.
              </span>
              <span v-else>
                Juega {{ (decayStatus?.matches_required || 2) - (decayStatus?.matches_this_month || 0) }} partido{{ (decayStatus?.matches_required || 2) - (decayStatus?.matches_this_month || 0) !== 1 ? 's' : '' }} más para evitar decay de ELO (-{{ decayStatus?.estimated_decay || 25 }} ELO).
              </span>
            </div>
          </div>

          <!-- In Placement - No Decay Message -->
          <div v-else class="glass-card p-4 animate-fade-up animate-delay-4">
            <div class="flex items-center gap-3 text-size-4 text-foreground-muted">
              <Icon name="heroicons:information-circle" class="w-5 h-5 text-accent" />
              <span>Durante los partidos de colocación no hay decay de ELO.</span>
            </div>
          </div>

          <!-- Segment and Tier Ranks (Compact) - Hide during placement -->
          <div v-if="!isInPlacement && (position?.segment_rank || position?.tier_rank)" class="grid md:grid-cols-2 gap-4 mt-6 animate-fade-up animate-delay-5">
            <div v-if="position.segment_rank" class="glass-card p-5 hover-lift">
              <div class="flex items-center gap-4">
                <div class="w-10 h-10 rounded-lg bg-accent-secondary-muted flex items-center justify-center">
                  <Icon name="heroicons:map-pin" class="w-5 h-5 text-accent-secondary" />
                </div>
                <div class="flex-1">
                  <p class="text-size-4 font-semibold text-foreground">{{ position.segment_name || 'Segmento' }}</p>
                  <p class="text-size-5 text-foreground-muted">Ranking del segmento</p>
                </div>
                <div class="text-right">
                  <p class="text-size-2 font-bold text-gradient-static">#{{ position.segment_rank }}</p>
                  <p class="text-size-5 text-foreground-muted">de {{ position.segment_total }}</p>
                </div>
              </div>
            </div>

            <div v-if="position.tier_rank" class="glass-card p-5 hover-lift">
              <div class="flex items-center gap-4">
                <div class="w-10 h-10 rounded-lg bg-accent-subtle flex items-center justify-center">
                  <Icon name="heroicons:star" class="w-5 h-5 text-accent" />
                </div>
                <div class="flex-1">
                  <p class="text-size-4 font-semibold text-foreground">División {{ nextTierProgress?.currentTier?.tier }}</p>
                  <p class="text-size-5 text-foreground-muted">Ranking por tier</p>
                </div>
                <div class="text-right">
                  <p class="text-size-2 font-bold text-gradient-static">#{{ position.tier_rank }}</p>
                  <p class="text-size-5 text-foreground-muted">de {{ position.tier_total }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Quick Action: Find Match -->
          <div class="mt-8 text-center animate-fade-up animate-delay-6">
            <NuxtLink to="/matchmaking" class="btn-primary text-size-3 inline-flex items-center group">
              <Icon name="heroicons:magnifying-glass" class="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
              Buscar Oponente
            </NuxtLink>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MonthlyDecayStatus } from '~/types'

definePageMeta({
  middleware: 'auth'
})

// Composables
const { isAuthenticated, userId } = useAuthState()
const { player, loading: playerLoading, fetchPlayer } = usePlayer()
const { fetchDecayStatus, status: decayStatus } = useMonthlyDecay()

// State
const loading = ref(true)
const error = ref<Error | null>(null)
const position = ref<{
  global_rank: number
  total_players: number
  segment_rank?: number
  segment_total?: number
  segment_name?: string
  tier_rank?: number
  tier_total?: number
  players_above: number
  players_below: number
  percentile: number
} | null>(null)
const ratingHistory = ref<any[]>([])
const recentMatches = ref<any[]>([])
const historyStats = ref<{
  wins: number
  losses: number
  win_rate: number
  total_elo_change: number
  peak_elo: number
} | null>(null)
const nextTierProgress = ref<{
  currentTier: { tier: string; minElo: number; maxElo: number; color: string }
  nextTier: { tier: string; minElo: number; maxElo: number; color: string } | null
  eloNeeded: number
  progressPercent: number
  isMaxTier: boolean
} | null>(null)

// Computed
const isInPlacement = computed(() => {
  return (player.value?.placement_matches_completed || 0) < 3
})

const winRate = computed(() => {
  if (!historyStats.value) return 0
  return Math.round(historyStats.value.win_rate)
})

const formatMatchDate = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - date.getTime())
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) {
    return 'Hoy'
  } else if (diffDays === 1) {
    return 'Ayer'
  } else if (diffDays < 7) {
    return `Hace ${diffDays} días`
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    return `Hace ${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30)
    return `Hace ${months} ${months === 1 ? 'mes' : 'meses'}`
  } else {
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
  }
}

// Methods
const loadAllData = async () => {
  if (!player.value?.id) {
    return
  }

  try {
    error.value = null

    // Load all data in parallel
    const [rankingResponse, historyResponse, tierResponse] = await Promise.all([
      // Ranking position
      $fetch<{
        success: boolean
        is_unrated: boolean
        position: typeof position.value
      }>(`/api/players/${player.value.id}/ranking-position`).catch(() => null),
      
      // Rating history (get 20 for chart, we'll use first 10 for recent matches)
      $fetch<{
        success: boolean
        history: any[]
        stats: typeof historyStats.value
      }>(`/api/players/${player.value.id}/rating-history`, {
        query: { limit: 20 }
      }).catch(() => null),
      
      // Next tier progress (custom endpoint or calculate client-side)
      $fetch<{
        success: boolean
        progress: typeof nextTierProgress.value
      }>(`/api/players/${player.value.id}/tier-progress`).catch(() => null)
    ])

    // Also fetch decay status (not in placement)
    if (!isInPlacement.value) {
      await fetchDecayStatus(player.value.id).catch(() => null)
    }

    // Set data
    if (rankingResponse?.success) {
      position.value = rankingResponse.position
    }

    if (historyResponse?.success) {
      ratingHistory.value = historyResponse.history.slice().reverse() // Oldest first for chart
      historyStats.value = historyResponse.stats
      
      // Get last 10 competitive matches (rating_history only contains competitive matches)
      recentMatches.value = historyResponse.history
        .slice(0, 10) // Already sorted by created_at DESC, so first 10 are most recent
        .map((h: any) => ({
          id: h.id,
          match_id: h.match_id,
          opponent: h.opponent,
          was_winner: h.was_winner,
          elo_change: h.elo_change || (h.elo_after - h.elo_before), // Calculate if not present
          elo_before: h.elo_before,
          elo_after: h.elo_after,
          is_placement_match: h.is_placement_match,
          created_at: h.created_at
        }))
    }

    if (tierResponse?.success) {
      nextTierProgress.value = tierResponse.progress
    } else {
      // Calculate client-side if endpoint doesn't exist
      nextTierProgress.value = calculateTierProgress(player.value.elo)
    }

  } catch (err: any) {
    console.error('Error loading ranking data:', err)
    error.value = err
    throw err // Re-throw so initialize can handle it
  }
}

// Client-side tier progress calculation as fallback
const RATING_TIERS = [
  { tier: 'Bronze', minElo: 1, maxElo: 1499, color: '#CD7F32' },
  { tier: 'Silver', minElo: 1500, maxElo: 1999, color: '#C0C0C0' },
  { tier: 'Gold', minElo: 2000, maxElo: 2499, color: '#FFD700' },
  { tier: 'Platinum', minElo: 2500, maxElo: 2999, color: '#E5E4E2' },
  { tier: 'Diamond', minElo: 3000, maxElo: 3499, color: '#B9F2FF' },
  { tier: 'Master', minElo: 3500, maxElo: 3999, color: '#9932CC' },
  { tier: 'Grandmaster', minElo: 4000, maxElo: Infinity, color: '#FF4500' },
]

const calculateTierProgress = (elo: number) => {
  const currentTierData = RATING_TIERS.find(t => elo >= t.minElo && elo <= t.maxElo) || RATING_TIERS[0]
  const currentIndex = RATING_TIERS.findIndex(t => t.tier === currentTierData.tier)
  
  if (currentIndex === RATING_TIERS.length - 1 || currentTierData.tier === 'Grandmaster') {
    return {
      currentTier: currentTierData,
      nextTier: null,
      eloNeeded: 0,
      progressPercent: 100,
      isMaxTier: true
    }
  }
  
  const nextTierData = RATING_TIERS[currentIndex + 1]
  const eloNeeded = nextTierData.minElo - elo
  const tierRange = currentTierData.maxElo - currentTierData.minElo
  const eloInTier = elo - currentTierData.minElo
  const progressPercent = tierRange > 0 ? Math.round((eloInTier / tierRange) * 100) : 0
  
  return {
    currentTier: currentTierData,
    nextTier: nextTierData,
    eloNeeded,
    progressPercent,
    isMaxTier: false
  }
}

// Initial load
const initialize = async () => {
  if (!isAuthenticated.value || !userId.value) {
    loading.value = false
    return
  }

  try {
    loading.value = true
    error.value = null

    // First, fetch the player if we have a user ID
    if (!player.value) {
      await fetchPlayer(userId.value)
    }

    // Then load all ranking data if player exists
    if (player.value?.id) {
      await loadAllData()
    } else {
      // Player doesn't exist - show appropriate message
      loading.value = false
    }
  } catch (err: any) {
    console.error('Error initializing ranking page:', err)
    error.value = err
  } finally {
    loading.value = false
  }
}

// Watch for player changes (in case player is loaded elsewhere)
watch(() => player.value?.id, (newId, oldId) => {
  if (newId && newId !== oldId && !loading.value) {
    loadAllData().catch(err => {
      console.error('Error loading ranking data:', err)
      error.value = err
    })
  }
})

// Watch for auth/user changes
watch([isAuthenticated, userId], async ([authenticated, uid]) => {
  if (authenticated && uid) {
    await initialize()
  } else {
    loading.value = false
  }
}, { immediate: true })
</script>
