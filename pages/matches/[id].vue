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
        <!-- Loading State -->
        <div v-if="loading" class="max-w-4xl mx-auto">
          <div class="glass-card-elevated p-12 text-center animate-fade-in-scale">
            <div class="w-16 h-16 rounded-full bg-accent-subtle flex items-center justify-center mx-auto mb-6">
              <Icon name="heroicons:arrow-path" class="w-8 h-8 text-accent animate-spin" />
            </div>
            <p class="text-size-3 text-foreground-muted">Cargando partido...</p>
          </div>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="max-w-4xl mx-auto">
          <div class="glass-card-elevated p-10 max-w-md mx-auto animate-fade-in-scale">
            <div class="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
              <Icon name="heroicons:lock-closed" class="w-10 h-10 text-red-400" />
            </div>
            <h2 class="text-size-2 font-semibold text-foreground mb-3 text-center">
              Acceso Denegado
            </h2>
            <p class="text-size-4 text-foreground-muted mb-8 text-center leading-relaxed">
              {{ error.statusCode === 403 
                ? 'No tienes permiso para ver este partido. Solo puedes ver los partidos en los que participas.' 
                : error.message || 'Error al cargar el partido' }}
            </p>
            <NuxtLink 
              :to="getBackUrl()" 
              class="btn-secondary text-size-3 w-full justify-center group"
            >
              <Icon name="heroicons:arrow-left" class="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
              {{ getBackLabel() }}
            </NuxtLink>
          </div>
        </div>

        <!-- Match Content -->
        <div v-else-if="match" class="max-w-5xl mx-auto space-y-8 animate-fade-up">
          <!-- Header with Back Button and Status -->
          <div class="flex items-center justify-between animate-fade-up animate-delay-1">
            <NuxtLink 
              :to="getBackUrl()" 
              class="group flex items-center gap-2 text-size-3 text-foreground-muted hover:text-foreground transition-all"
            >
              <Icon name="heroicons:arrow-left" class="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              <span>{{ getBackLabel() }}</span>
            </NuxtLink>
            <div class="flex items-center gap-3">
              <MatchTournamentBadge :match="match" />
              <div class="flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-sm" :class="statusBadgeClass">
                <Icon :name="statusIcon" class="w-4 h-4" />
                <span class="text-size-4 font-semibold">{{ statusLabel }}</span>
              </div>
            </div>
          </div>

          <!-- Main Match Card -->
          <div class="glass-card-elevated p-8 md:p-10 animate-fade-up animate-delay-2 hover-lift">
            <!-- Title -->
            <div class="mb-8">
              <h1 class="text-size-1 font-semibold text-foreground mb-2">Detalles del Partido</h1>
              <div class="h-1 w-20 bg-gradient-to-r from-accent to-transparent rounded-full"></div>
            </div>
            
            <!-- Players Section -->
            <div class="mb-10">
              <div class="flex items-center justify-center gap-6 md:gap-12 mb-8">
                <!-- Player 1 -->
                <div class="flex-1 max-w-xs">
                  <div class="group relative p-6 rounded-2xl bg-gradient-to-br from-surface to-surface-elevated border border-border-subtle hover:border-accent/50 transition-all hover-lift">
                    <div class="flex flex-col items-center text-center">
                      <div class="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 border-2 border-accent/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <span class="text-2xl font-bold text-accent">
                          {{ getPlayerInitials(match.player1?.name || 'Jugador 1') }}
                        </span>
                      </div>
                      <div v-if="match.player1" class="flex flex-col items-center mb-2">
                        <NuxtLink
                          :to="`/players/${match.player1.id}`"
                          class="text-size-2 font-semibold text-foreground hover:text-accent transition-all group-hover:underline"
                        >
                          {{ match.player1.name }}
                        </NuxtLink>
                        <span 
                          v-if="match.player1.status === 'deleted'"
                          class="mt-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-600 border border-red-500/30"
                        >
                          Eliminado
                        </span>
                      </div>
                      <p v-else class="text-size-2 font-semibold text-foreground mb-2">
                        Jugador 1
                      </p>
                      <div v-if="match.player1?.category" class="px-3 py-1 rounded-full bg-surface border border-border-subtle">
                        <p class="text-size-4 text-foreground-muted">
                          {{ match.player1.category.name }}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- VS Divider -->
                <div class="flex flex-col items-center">
                  <div class="w-16 h-16 rounded-full bg-surface border-2 border-border-subtle flex items-center justify-center">
                    <span class="text-size-3 font-bold text-foreground-muted">VS</span>
                  </div>
                  <div class="h-24 w-px bg-gradient-to-b from-border-subtle via-accent/50 to-border-subtle mt-4"></div>
                </div>

                <!-- Player 2 -->
                <div class="flex-1 max-w-xs">
                  <div class="group relative p-6 rounded-2xl bg-gradient-to-br from-surface to-surface-elevated border border-border-subtle hover:border-accent/50 transition-all hover-lift">
                    <div class="flex flex-col items-center text-center">
                      <div class="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent-secondary/20 to-accent-secondary/5 border-2 border-accent-secondary/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <span class="text-2xl font-bold text-accent-secondary">
                          {{ getPlayerInitials(match.player2?.name || match.pending_player2?.name || 'Oponente') }}
                        </span>
                      </div>
                      <div v-if="match.player2" class="flex flex-col items-center mb-2">
                        <NuxtLink
                          :to="`/players/${match.player2.id}`"
                          class="text-size-2 font-semibold text-foreground hover:text-accent-secondary transition-all group-hover:underline"
                        >
                          {{ match.player2.name }}
                        </NuxtLink>
                        <span 
                          v-if="match.player2.status === 'deleted'"
                          class="mt-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-600 border border-red-500/30"
                        >
                          Eliminado
                        </span>
                      </div>
                      <NuxtLink
                        v-else-if="match.pending_player2"
                        :to="`/players/${match.pending_player2.id}`"
                        class="text-size-2 font-semibold text-foreground hover:text-accent-secondary transition-all mb-2 group-hover:underline"
                      >
                        {{ match.pending_player2.name }}
                      </NuxtLink>
                      <p v-else class="text-size-2 font-semibold text-foreground mb-2">
                        Oponente
                      </p>
                      <div v-if="match.player2?.category || match.pending_player2?.category" class="px-3 py-1 rounded-full bg-surface border border-border-subtle mb-2">
                        <p class="text-size-4 text-foreground-muted">
                          {{ match.player2?.category?.name || match.pending_player2?.category?.name }}
                        </p>
                      </div>
                      <div v-if="match.pending_player2" class="px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30">
                        <p class="text-size-4 text-yellow-400 font-semibold">
                          Pendiente
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Match Details Grid -->
            <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <!-- Scheduled Time -->
              <div class="p-5 rounded-xl bg-surface border border-border-subtle hover:border-accent/30 transition-all">
                <div class="flex items-center gap-3 mb-3">
                  <div class="w-10 h-10 rounded-lg bg-accent-subtle flex items-center justify-center">
                    <Icon name="heroicons:calendar" class="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <p class="text-size-4 font-semibold text-foreground-muted mb-1">Fecha y Hora</p>
                    <p v-if="match.scheduled_at" class="text-size-3 text-foreground font-semibold">
                      {{ formatDateTime(match.scheduled_at) }}
                    </p>
                    <p v-else class="text-size-3 text-yellow-400 font-semibold flex items-center gap-2">
                      <Icon name="heroicons:clock" class="w-5 h-5" />
                      Sin agendar - Los jugadores deben programar este partido
                    </p>
                  </div>
                </div>
              </div>

              <!-- Location -->
              <div v-if="match.location" class="p-5 rounded-xl bg-surface border border-border-subtle hover:border-accent/30 transition-all">
                <div class="flex items-center gap-3 mb-3">
                  <div class="w-10 h-10 rounded-lg bg-accent-secondary-muted flex items-center justify-center">
                    <Icon name="heroicons:map-pin" class="w-5 h-5 text-accent-secondary" />
                  </div>
                  <div>
                    <p class="text-size-4 font-semibold text-foreground-muted mb-1">Ubicación</p>
                    <p class="text-size-3 text-foreground font-semibold">{{ match.location }}</p>
                  </div>
                </div>
              </div>

              <!-- Competitive Status -->
              <div class="p-5 rounded-xl bg-surface border border-border-subtle hover:border-accent/30 transition-all">
                <div class="flex items-center gap-3 mb-3">
                  <div class="w-10 h-10 rounded-lg flex items-center justify-center" :class="match.is_competitive !== false ? 'bg-green-500/20' : 'bg-gray-500/20'">
                    <Icon 
                      :name="match.is_competitive !== false ? 'heroicons:trophy' : 'heroicons:hand-raised'" 
                      class="w-5 h-5" 
                      :class="match.is_competitive !== false ? 'text-green-400' : 'text-gray-400'"
                    />
                  </div>
                  <div>
                    <p class="text-size-4 font-semibold text-foreground-muted mb-1">Tipo de Partido</p>
                    <div class="flex items-center gap-2">
                      <span 
                        class="text-size-3 font-semibold px-3 py-1 rounded-full"
                        :class="match.is_competitive !== false 
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                          : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'"
                      >
                        {{ match.is_competitive !== false ? 'Competitivo' : 'Amistoso' }}
                      </span>
                    </div>
                    <p class="text-size-5 text-foreground-muted mt-2">
                      {{ match.is_competitive !== false 
                        ? 'Cuenta para rankings y placement' 
                        : 'No cuenta para rankings' }}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Score Section - Only show if score is approved (completed match or score_approved_by exists) -->
            <div v-if="match.score && (match.status === 'completed' || match.score_approved_by)" class="mb-8 p-6 rounded-xl bg-gradient-to-br from-accent-subtle/30 to-accent-subtle/10 border border-accent/30">
              <div class="flex items-center gap-3 mb-4">
                <Icon name="heroicons:trophy" class="w-6 h-6 text-accent" />
                <p class="text-size-3 font-semibold text-foreground">Resultado</p>
              </div>
              <p class="text-size-2 font-bold text-foreground mb-3">{{ match.score }}</p>
              <div v-if="match.winner" class="flex items-center gap-2 mb-4">
                <span class="text-size-4 text-foreground-muted">Ganador:</span>
                <div class="flex items-center gap-2">
                  <NuxtLink
                    :to="`/players/${match.winner.id}`"
                    class="text-size-4 font-semibold text-accent hover:underline transition-all"
                  >
                    {{ match.winner.name }}
                  </NuxtLink>
                  <span 
                    v-if="match.winner.status === 'deleted'"
                    class="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-600 border border-red-500/30"
                  >
                    Eliminado
                  </span>
                </div>
              </div>
              
              <!-- ELO Changes - Only show for competitive matches -->
              <div v-if="match.is_competitive && ratingHistory && (ratingHistory.player1 || ratingHistory.player2)" class="pt-4 border-t border-accent/20">
                <p class="text-size-4 font-semibold text-foreground-muted mb-3">Cambio de ELO</p>
                <div class="grid grid-cols-2 gap-4">
                  <!-- Player 1 ELO Change -->
                  <div v-if="ratingHistory.player1 && match.player1" class="p-3 rounded-lg bg-surface/50 border border-border-subtle">
                    <div class="flex items-center gap-2 mb-1">
                      <NuxtLink
                        :to="`/players/${match.player1.id}`"
                        class="text-size-4 font-semibold text-foreground hover:text-accent transition-all"
                      >
                        {{ match.player1.name }}
                      </NuxtLink>
                    </div>
                    <div 
                      class="text-size-2 font-bold"
                      :class="ratingHistory.player1.elo_change > 0 ? 'text-green-400' : ratingHistory.player1.elo_change < 0 ? 'text-red-400' : 'text-foreground-muted'"
                    >
                      {{ ratingHistory.player1.elo_change > 0 ? '+' : '' }}{{ ratingHistory.player1.elo_change }} ELO
                    </div>
                    <div class="text-size-5 text-foreground-muted mt-1">
                      {{ ratingHistory.player1.elo_before }} → {{ ratingHistory.player1.elo_after }}
                    </div>
                  </div>
                  
                  <!-- Player 2 ELO Change -->
                  <div v-if="ratingHistory.player2 && match.player2" class="p-3 rounded-lg bg-surface/50 border border-border-subtle">
                    <div class="flex items-center gap-2 mb-1">
                      <NuxtLink
                        :to="`/players/${match.player2.id}`"
                        class="text-size-4 font-semibold text-foreground hover:text-accent transition-all"
                      >
                        {{ match.player2.name }}
                      </NuxtLink>
                    </div>
                    <div 
                      class="text-size-2 font-bold"
                      :class="ratingHistory.player2.elo_change > 0 ? 'text-green-400' : ratingHistory.player2.elo_change < 0 ? 'text-red-400' : 'text-foreground-muted'"
                    >
                      {{ ratingHistory.player2.elo_change > 0 ? '+' : '' }}{{ ratingHistory.player2.elo_change }} ELO
                    </div>
                    <div class="text-size-5 text-foreground-muted mt-1">
                      {{ ratingHistory.player2.elo_before }} → {{ ratingHistory.player2.elo_after }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Score Proposal Status - Only show if score is proposed but not approved yet -->
            <div v-else-if="match.status === 'active' && match.score_proposed_by && !match.score_approved_by" class="mb-8 p-6 rounded-xl bg-accent-subtle/30 border border-accent/30 animate-fade-in-scale">
              <div class="flex items-center gap-3 mb-4">
                <Icon name="heroicons:clock" class="w-5 h-5 text-accent" />
                <p class="text-size-3 font-semibold text-foreground">
                  Puntuación Propuesta
                </p>
              </div>
              <p class="text-size-4 text-foreground-muted mb-2">
                <span class="font-semibold text-foreground">{{ match.score_proposed_by_player?.name }}</span> propuso: 
                <span class="font-semibold text-foreground">{{ match.score }}</span>
              </p>
              <div v-if="match.winner" class="flex items-center gap-2 mt-3">
                <span class="text-size-4 text-foreground-muted">Ganador:</span>
                <NuxtLink
                  :to="`/players/${match.winner.id}`"
                  class="text-size-4 font-semibold text-accent hover:underline transition-all"
                >
                  {{ match.winner.name }}
                </NuxtLink>
              </div>
            </div>

            <!-- Actions Section -->
            <div class="pt-8 border-t border-border-subtle space-y-4">
              <!-- Match Acceptance Section - Show when match is proposed but not accepted (only for non-tournament matches) -->
              <div v-if="match.status === 'scheduled' && !match.tournament_id && match.match_proposed_by && !match.match_accepted_by && !match.match_rejected_by && match.player2_id && isPlayerInMatch && currentPlayerId === match.player2_id && !isTournamentOrganizer" class="space-y-3 mb-4">
                <div class="p-5 rounded-xl bg-accent-subtle/30 border border-accent/30">
                  <div class="flex items-center gap-3 mb-3">
                    <Icon name="heroicons:envelope" class="w-6 h-6 text-accent flex-shrink-0" />
                    <div class="flex-1">
                      <p class="text-size-4 font-semibold text-foreground mb-1">Partido Propuesto</p>
                      <p class="text-size-5 text-foreground-muted">
                        <NuxtLink v-if="match.match_proposed_by_player" :to="`/players/${match.match_proposed_by_player.id}`" class="text-accent hover:underline font-semibold">
                          {{ match.match_proposed_by_player.name }}
                        </NuxtLink>
                        <span v-else class="font-semibold">El otro jugador</span>
                        <span> te ha propuesto este partido. ¿Aceptas?</span>
                      </p>
                    </div>
                  </div>
                  <div class="flex gap-3">
                    <button
                      @click="openAcceptMatchForm"
                      :disabled="actionLoading"
                      class="btn-primary flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Icon name="heroicons:check-circle" class="w-5 h-5 mr-2" />
                      Aceptar Partido
                    </button>
                    <button
                      @click="openRejectMatchForm"
                      :disabled="actionLoading"
                      class="btn-secondary flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Icon name="heroicons:x-circle" class="w-5 h-5 mr-2" />
                      Rechazar
                    </button>
                  </div>
                </div>
              </div>
              
              <!-- Acceptance Change Proposal - Show when player2 accepted but proposed changes -->
              <!-- Show to player1 (who proposed the match) when player2 has proposed changes -->
              <!-- Condition: match accepted, has proposed changes, not yet approved/rejected, current user is player1 -->
              <div v-if="match.status === 'scheduled' && !match.tournament_id && match.match_accepted_by && (match.acceptance_proposed_scheduled_at || match.acceptance_proposed_location !== null) && !match.acceptance_change_approved_by && !match.acceptance_change_rejected_by && match.player1_id === currentPlayerId && match.match_accepted_by !== currentPlayerId && isPlayerInMatch && !isTournamentOrganizer" class="space-y-3 mb-4">
                <div class="p-5 rounded-xl bg-accent-subtle/30 border border-accent/30">
                  <div class="flex items-center gap-3 mb-3">
                    <Icon name="heroicons:clock" class="w-6 h-6 text-accent flex-shrink-0" />
                    <div class="flex-1">
                      <p class="text-size-4 font-semibold text-foreground mb-1">Propuesta de Cambio</p>
                      <p class="text-size-5 text-foreground-muted">
                        <NuxtLink v-if="match.player2" :to="`/players/${match.player2.id}`" class="text-accent hover:underline font-semibold">
                          {{ match.player2.name }}
                        </NuxtLink>
                        <span v-else class="font-semibold">El otro jugador</span>
                        <span> aceptó el partido pero propone cambios:</span>
                      </p>
                    </div>
                  </div>
                  <div class="pl-9 space-y-3">
                    <div v-if="match.acceptance_proposed_scheduled_at" class="p-3 rounded-lg bg-surface border border-border-subtle">
                      <p class="text-size-5 text-foreground-muted mb-1">Nueva Fecha y Hora:</p>
                      <p class="text-size-4 font-semibold text-foreground">{{ formatDateTime(match.acceptance_proposed_scheduled_at) }}</p>
                      <p class="text-size-5 text-foreground-muted mt-1">Fecha original: {{ formatDateTime(match.scheduled_at) }}</p>
                    </div>
                    <div v-if="match.acceptance_proposed_location !== null" class="p-3 rounded-lg bg-surface border border-border-subtle">
                      <p class="text-size-5 text-foreground-muted mb-1">Nueva Ubicación:</p>
                      <p class="text-size-4 font-semibold text-foreground">{{ match.acceptance_proposed_location || 'Sin ubicación' }}</p>
                      <p class="text-size-5 text-foreground-muted mt-1">Ubicación original: {{ match.location || 'Sin ubicación' }}</p>
                    </div>
                    <div class="flex gap-3">
                      <button
                        @click="handleApproveAcceptanceChange"
                        :disabled="actionLoading"
                        class="btn-primary flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Icon name="heroicons:check-circle" class="w-5 h-5 mr-2" />
                        Aceptar Cambios
                      </button>
                      <button
                        @click="handleRejectAcceptanceChange"
                        :disabled="actionLoading"
                        class="btn-secondary flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Icon name="heroicons:x-circle" class="w-5 h-5 mr-2" />
                        Rechazar Cambios
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Waiting for Acceptance Change Approval - Show when player2 accepted with changes and waiting for player1 to approve -->
              <div v-if="match.status === 'scheduled' && !match.tournament_id && match.match_accepted_by === currentPlayerId && (match.acceptance_proposed_scheduled_at || match.acceptance_proposed_location !== null) && !match.acceptance_change_approved_by && !match.acceptance_change_rejected_by && isPlayerInMatch && !isTournamentOrganizer" class="p-5 rounded-xl bg-accent-subtle/30 border border-accent/30 mb-4">
                <div class="flex items-center gap-3 mb-3">
                  <Icon name="heroicons:clock" class="w-6 h-6 text-accent flex-shrink-0" />
                  <div class="flex-1">
                    <p class="text-size-4 font-semibold text-foreground mb-1">Esperando Aprobación de Cambios</p>
                    <p class="text-size-5 text-foreground-muted">
                      Has aceptado el partido y propuesto cambios. Esperando que 
                      <NuxtLink v-if="match.match_proposed_by_player" :to="`/players/${match.match_proposed_by_player.id}`" class="text-accent hover:underline font-semibold">
                        {{ match.match_proposed_by_player.name }}
                      </NuxtLink>
                      <span v-else class="font-semibold">el otro jugador</span>
                      <span> apruebe o rechace tus propuestas...</span>
                    </p>
                  </div>
                </div>
                <div class="pl-9 space-y-3">
                  <div v-if="match.acceptance_proposed_scheduled_at" class="p-3 rounded-lg bg-surface border border-border-subtle">
                    <p class="text-size-5 text-foreground-muted mb-1">Nueva Fecha y Hora Propuesta:</p>
                    <p class="text-size-4 font-semibold text-foreground">{{ formatDateTime(match.acceptance_proposed_scheduled_at) }}</p>
                  </div>
                  <div v-if="match.acceptance_proposed_location !== null" class="p-3 rounded-lg bg-surface border border-border-subtle">
                    <p class="text-size-5 text-foreground-muted mb-1">Nueva Ubicación Propuesta:</p>
                    <p class="text-size-4 font-semibold text-foreground">{{ match.acceptance_proposed_location || 'Sin ubicación' }}</p>
                  </div>
                </div>
              </div>
              
              <!-- Waiting for Acceptance - Show when you proposed and waiting for response (only for non-tournament matches) -->
              <div v-if="match.status === 'scheduled' && !match.tournament_id && match.match_proposed_by === currentPlayerId && !match.match_accepted_by && !match.match_rejected_by && match.player2_id && isPlayerInMatch && !isTournamentOrganizer" class="p-5 rounded-xl bg-accent-subtle/30 border border-accent/30 mb-4">
                <div class="flex items-center gap-3 mb-3">
                  <Icon name="heroicons:clock" class="w-6 h-6 text-accent flex-shrink-0" />
                  <div class="flex-1">
                    <p class="text-size-4 font-semibold text-foreground mb-1">Esperando respuesta</p>
                    <p class="text-size-5 text-foreground-muted">
                      Has propuesto este partido. Esperando que 
                      <NuxtLink v-if="match.player2" :to="`/players/${match.player2.id}`" class="text-accent hover:underline font-semibold">
                        {{ match.player2.name }}
                      </NuxtLink>
                      <span v-else class="font-semibold">el otro jugador</span>
                      <span> acepte o rechace tu propuesta...</span>
                    </p>
                  </div>
                </div>
              </div>
              
              <!-- Start Match Button - Only show if match is scheduled, accepted (or tournament match), with a date (players only, not organizers) -->
              <!-- Hide if there are pending acceptance changes that haven't been approved -->
              <button
                v-if="match.status === 'scheduled' && match.scheduled_at && !match.pending_player2_id && isPlayerInMatch && !isTournamentOrganizer && (!match.match_proposed_by || match.match_accepted_by || match.tournament_id) && !((match.acceptance_proposed_scheduled_at || match.acceptance_proposed_location !== null) && !match.acceptance_change_approved_by && !match.acceptance_change_rejected_by)"
                @click="handleStartMatch"
                :disabled="actionLoading || (match.match_proposed_by && !match.match_accepted_by && !match.tournament_id)"
                class="btn-primary text-size-3 w-full justify-center group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none"
              >
                <Icon name="heroicons:play" class="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                Iniciar Partido
              </button>
              
              <!-- Message when waiting for acceptance change approval -->
              <div v-if="match.status === 'scheduled' && match.scheduled_at && !match.pending_player2_id && isPlayerInMatch && !isTournamentOrganizer && (match.acceptance_proposed_scheduled_at || match.acceptance_proposed_location !== null) && !match.acceptance_change_approved_by && !match.acceptance_change_rejected_by" class="p-4 rounded-xl bg-accent-subtle/20 border border-accent/30 text-center">
                <p class="text-size-4 text-foreground-muted">
                  <Icon name="heroicons:clock" class="w-5 h-5 inline mr-2 text-accent" />
                  Esperando aprobación de los cambios propuestos para iniciar el partido
                </p>
              </div>
              
              <!-- Schedule Match Button - Show when match is scheduled but has no date and no pending proposal (players only, not organizers) -->
              <button
                v-if="match.status === 'scheduled' && !match.scheduled_at && !match.schedule_proposed_by && isPlayerInMatch && !isTournamentOrganizer"
                @click="openScheduleForm"
                class="btn-primary text-size-3 w-full justify-center group"
              >
                <Icon name="heroicons:calendar" class="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                Proponer Fecha
              </button>
              
              <!-- Schedule Proposal Waiting - Show when you proposed and waiting for response -->
              <div v-if="match.status === 'scheduled' && !match.scheduled_at && match.schedule_proposed_by === currentPlayerId && !match.schedule_approved_by && !match.schedule_rejected_by && isPlayerInMatch && !isTournamentOrganizer" class="p-5 rounded-xl bg-accent-subtle/30 border border-accent/30 mb-4">
                <div class="flex items-center gap-3 mb-3">
                  <Icon name="heroicons:clock" class="w-6 h-6 text-accent flex-shrink-0" />
                  <div class="flex-1">
                    <p class="text-size-4 font-semibold text-foreground mb-1">Esperando respuesta</p>
                    <p class="text-size-5 text-foreground-muted">Has propuesto jugar el:</p>
                  </div>
                </div>
                <div class="pl-9">
                  <p class="text-size-4 font-semibold text-foreground mb-2">
                    {{ formatDateTime(match.schedule_proposed_scheduled_at) }}
                  </p>
                  <p class="text-size-5 text-foreground-subtle">Esperando que el otro jugador acepte o rechace tu propuesta...</p>
                </div>
              </div>
              
              <!-- Schedule Proposal Pending - Show when there's a pending proposal from the other player -->
              <div v-if="match.status === 'scheduled' && !match.scheduled_at && match.schedule_proposed_by && match.schedule_proposed_by !== currentPlayerId && !match.schedule_approved_by && !match.schedule_rejected_by && isPlayerInMatch && !isTournamentOrganizer" class="space-y-3 mb-4">
                <div class="p-5 rounded-xl bg-accent-subtle/30 border border-accent/30">
                  <div class="flex items-center gap-3 mb-3">
                    <Icon name="heroicons:calendar-days" class="w-6 h-6 text-accent flex-shrink-0" />
                    <div class="flex-1">
                      <p class="text-size-4 font-semibold text-foreground mb-1">Propuesta de Fecha</p>
                      <p class="text-size-5 text-foreground-muted">
                        <NuxtLink v-if="match.schedule_proposed_by_player" :to="`/players/${match.schedule_proposed_by_player.id}`" class="text-accent hover:underline font-semibold">
                          {{ match.schedule_proposed_by_player.name }}
                        </NuxtLink>
                        <span v-else class="font-semibold">El otro jugador</span>
                        <span> propone jugar el:</span>
                      </p>
                    </div>
                  </div>
                  <div class="pl-9">
                    <p class="text-size-4 font-semibold text-foreground mb-4">
                      {{ formatDateTime(match.schedule_proposed_scheduled_at) }}
                    </p>
                    <div class="flex gap-3">
                      <button
                        @click="handleApproveSchedule"
                        :disabled="actionLoading"
                        class="btn-primary flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Icon name="heroicons:check-circle" class="w-5 h-5 mr-2" />
                        Aceptar
                      </button>
                      <button
                        @click="handleRejectSchedule"
                        :disabled="actionLoading"
                        class="btn-secondary flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Icon name="heroicons:x-circle" class="w-5 h-5 mr-2" />
                        Rechazar
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Organizer Info Message -->
              <div v-if="isTournamentOrganizer && match.status === 'scheduled' && !match.scheduled_at" class="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-center">
                <Icon name="heroicons:information-circle" class="w-6 h-6 text-yellow-400 mx-auto mb-2" />
                <p class="text-size-4 text-yellow-400 font-semibold mb-1">Partido sin agendar</p>
                <p class="text-size-5 text-foreground-muted">Los jugadores deben programar este partido</p>
              </div>

              <!-- Score Proposal (players only) -->
              <div v-if="match.status === 'active' && !match.score_proposed_by && isPlayerInMatch && !isTournamentOrganizer">
                <button
                  @click="showScoreForm = true"
                  class="btn-primary text-size-3 w-full justify-center group"
                >
                  <Icon name="heroicons:document-text" class="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                  Proponer Puntuación
                </button>
              </div>

              <!-- Score Approval/Rejection (players only) -->
              <div v-if="match.status === 'active' && match.score_proposed_by && match.score_proposed_by !== currentPlayerId && isPlayerInMatch && !isTournamentOrganizer">
                <div class="flex gap-3">
                  <button
                    @click="handleApproveScore"
                    :disabled="actionLoading"
                    class="btn-primary text-size-3 flex-1 justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Icon name="heroicons:check-circle" class="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                    Aprobar
                  </button>
                  <button
                    @click="handleRejectScore"
                    :disabled="actionLoading"
                    class="btn-secondary text-size-3 flex-1 justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Icon name="heroicons:x-circle" class="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                    Rechazar
                  </button>
                </div>
              </div>

              <!-- Organizer Match Administration - Available in any state -->
              <div v-if="isTournamentOrganizer" class="space-y-3">
                <div class="p-4 rounded-xl bg-accent-subtle/20 border border-accent/30">
                  <div class="flex items-center gap-2 mb-3">
                    <Icon name="heroicons:shield-check" class="w-5 h-5 text-accent" />
                    <h3 class="text-size-3 font-semibold text-foreground">Administración del Partido</h3>
                  </div>
                  <p class="text-size-4 text-foreground-muted mb-4">
                    <span v-if="match.status === 'completed'">
                      Como organizador, puedes modificar el resultado del partido en cualquier momento.
                    </span>
                    <span v-else>
                      Como organizador, puedes establecer el resultado del partido en cualquier momento, incluso si no se ha programado o jugado.
                    </span>
                  </p>
                  <button
                    @click="openOrganizerResultForm"
                    class="btn-primary text-size-3 w-full justify-center group"
                  >
                    <Icon 
                      :name="match.status === 'completed' ? 'heroicons:pencil-square' : 'heroicons:document-text'" 
                      class="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" 
                    />
                    {{ match.status === 'completed' ? 'Editar Resultado' : 'Establecer Resultado' }}
                  </button>
                </div>
              </div>

              <!-- Reschedule Match (players only, not organizers) -->
              <div v-if="match.status === 'active' && isPlayerInMatch && !isTournamentOrganizer">
                <button
                  v-if="!match.reschedule_proposed_by || match.reschedule_rejected_by"
                  @click="openRescheduleForm"
                  class="btn-primary text-size-3 w-full justify-center group"
                >
                  <Icon name="heroicons:arrow-path" class="w-5 h-5 mr-2 group-hover:rotate-180 transition-transform duration-500" />
                  Reagendar Partido
                </button>
                
                <!-- Reschedule proposal status (current player) -->
                <div v-if="match.reschedule_proposed_by === currentPlayerId && !match.reschedule_approved_by && !match.reschedule_rejected_by" class="p-5 rounded-xl bg-accent-subtle/30 border border-accent/30">
                  <div class="flex items-center gap-3 mb-3">
                    <Icon name="heroicons:clock" class="w-5 h-5 text-accent" />
                    <p class="text-size-3 font-semibold text-foreground">
                      Reagendamiento Propuesto
                    </p>
                  </div>
                  <p class="text-size-4 text-foreground-muted mb-2">
                    Nueva fecha: <span class="font-semibold text-foreground">{{ formatDateTime(match.reschedule_proposed_scheduled_at!) }}</span>
                  </p>
                  <p class="text-size-4 text-foreground-muted flex items-center gap-2">
                    <Icon name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
                    Esperando respuesta del oponente...
                  </p>
                </div>
                
                <!-- Reschedule proposal (opponent) -->
                <div v-if="match.reschedule_proposed_by && match.reschedule_proposed_by !== currentPlayerId && !match.reschedule_approved_by && !match.reschedule_rejected_by" class="p-5 rounded-xl bg-accent-subtle/30 border border-accent/30 mb-4">
                  <div class="flex items-center gap-3 mb-3">
                    <Icon name="heroicons:clock" class="w-5 h-5 text-accent" />
                    <p class="text-size-3 font-semibold text-foreground">
                      Reagendamiento Propuesto
                    </p>
                  </div>
                  <p class="text-size-4 text-foreground-muted mb-4">
                    <span class="font-semibold text-foreground">{{ match.reschedule_proposed_by_player?.name }}</span> propone cambiar la fecha a: 
                    <span class="font-semibold text-foreground">{{ formatDateTime(match.reschedule_proposed_scheduled_at!) }}</span>
                  </p>
                  <div class="flex gap-3">
                    <button
                      @click="handleApproveReschedule"
                      :disabled="actionLoading"
                      class="btn-primary text-size-3 flex-1 justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Icon name="heroicons:check-circle" class="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                      Aceptar
                    </button>
                    <button
                      @click="handleRejectReschedule"
                      :disabled="actionLoading"
                      class="btn-secondary text-size-3 flex-1 justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Icon name="heroicons:x-circle" class="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                      Rechazar
                    </button>
                  </div>
                </div>
              </div>

              <!-- Cancel Match (players only, not organizers) -->
              <!-- Only player1 can cancel before acceptance, both players can cancel after acceptance -->
              <button
                v-if="match.status === 'scheduled' && isPlayerInMatch && !isTournamentOrganizer && (!match.match_proposed_by || match.match_proposed_by === currentPlayerId || match.match_accepted_by)"
                @click="openCancelMatchForm"
                :disabled="actionLoading"
                class="btn-danger text-size-3 w-full justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Icon name="heroicons:x-mark" class="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                Cancelar Partido
              </button>
            </div>
          </div>

          <!-- Reschedule Form Modal -->
          <Teleport to="body">
            <Transition name="modal">
              <div v-if="showRescheduleForm" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" @click.self="showRescheduleForm = false">
                <div class="glass-card-elevated p-8 max-w-md w-full animate-fade-in-scale">
                  <div class="flex items-center justify-between mb-6">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-lg bg-accent-subtle flex items-center justify-center">
                        <Icon name="heroicons:arrow-path" class="w-5 h-5 text-accent" />
                      </div>
                      <h2 class="text-size-2 font-semibold text-foreground">Reagendar Partido</h2>
                    </div>
                    <button
                      @click="showRescheduleForm = false"
                      class="w-8 h-8 rounded-lg bg-surface border border-border-subtle flex items-center justify-center text-foreground-muted hover:text-foreground hover:border-accent/50 transition-all"
                    >
                      <Icon name="heroicons:x-mark" class="w-5 h-5" />
                    </button>
                  </div>
                  
                  <form @submit.prevent="handleProposeReschedule" class="space-y-6">
                    <div>
                      <label for="reschedule_scheduled_at" class="block text-size-4 font-semibold text-foreground mb-3">
                        Nueva Fecha y Hora
                      </label>
                      <input
                        id="reschedule_scheduled_at"
                        v-model="rescheduleForm.scheduled_at"
                        type="datetime-local"
                        :min="minDateTime"
                        required
                        class="w-full px-4 py-3 rounded-xl bg-surface border-2 border-border-subtle text-foreground placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all"
                      />
                      <p v-if="isRescheduleDateInPast" class="text-size-4 font-regular text-red-400 mt-2 flex items-center gap-2">
                        <Icon name="heroicons:exclamation-triangle" class="w-4 h-4" />
                        No puedes reagendar un partido en el pasado
                      </p>
                    </div>

                    <!-- Error Message -->
                    <div v-if="rescheduleFormError" class="p-4 rounded-xl bg-red-500/20 border border-red-500/50">
                      <p class="text-size-4 font-regular text-red-400">{{ rescheduleFormError }}</p>
                    </div>

                    <div class="flex gap-3 pt-2">
                      <button
                        type="submit"
                        :disabled="actionLoading"
                        class="btn-primary text-size-3 flex-1 justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Icon name="heroicons:check" class="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                        Proponer
                      </button>
                      <button
                        type="button"
                        @click="showRescheduleForm = false"
                        class="btn-secondary text-size-3 flex-1 justify-center"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </Transition>
          </Teleport>
          
          <!-- Schedule Form Modal -->
          <Teleport to="body">
            <Transition name="modal">
              <div v-if="showScheduleForm" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" @click.self="showScheduleForm = false">
                <div class="glass-card-elevated p-8 max-w-md w-full animate-fade-in-scale">
                  <div class="flex items-center justify-between mb-6">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-lg bg-accent-subtle flex items-center justify-center">
                        <Icon name="heroicons:calendar" class="w-5 h-5 text-accent" />
                      </div>
                      <h2 class="text-size-2 font-semibold text-foreground">Programar Partido</h2>
                    </div>
                    <button
                      @click="showScheduleForm = false"
                      class="w-8 h-8 rounded-lg bg-surface border border-border-subtle flex items-center justify-center text-foreground-muted hover:text-foreground hover:border-accent/50 transition-all"
                    >
                      <Icon name="heroicons:x-mark" class="w-5 h-5" />
                    </button>
                  </div>
                  
                  <form @submit.prevent="handleSchedule" class="space-y-6">
                    <div>
                      <label for="schedule_scheduled_at" class="block text-size-4 font-semibold text-foreground mb-3">
                        Fecha y Hora
                      </label>
                      <input
                        id="schedule_scheduled_at"
                        v-model="scheduleForm.scheduled_at"
                        type="datetime-local"
                        :min="minDateTime"
                        required
                        class="w-full px-4 py-3 rounded-xl bg-surface border-2 border-border-subtle text-foreground placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all"
                      />
                      <p v-if="isScheduleDateInPast" class="text-size-4 font-regular text-red-400 mt-2 flex items-center gap-2">
                        <Icon name="heroicons:exclamation-triangle" class="w-4 h-4" />
                        No puedes programar un partido en el pasado
                      </p>
                    </div>

                    <!-- Error Message -->
                    <div v-if="scheduleFormError" class="p-4 rounded-xl bg-red-500/20 border border-red-500/50">
                      <p class="text-size-4 font-regular text-red-400">{{ scheduleFormError }}</p>
                    </div>

                    <div class="flex gap-3 pt-2">
                      <button
                        type="submit"
                        :disabled="actionLoading"
                        class="btn-primary text-size-3 flex-1 justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Icon name="heroicons:check-circle" class="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                        Programar
                      </button>
                      <button
                        type="button"
                        @click="showScheduleForm = false"
                        class="btn-secondary text-size-3 flex-1 justify-center group"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </Transition>
          </Teleport>

          <!-- Score Proposal Form Modal -->
          <Teleport to="body">
            <Transition name="modal">
              <div v-if="showScoreForm" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" @click.self="showScoreForm = false">
                <div class="glass-card-elevated p-8 max-w-md w-full animate-fade-in-scale">
                  <div class="flex items-center justify-between mb-6">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-lg bg-accent-subtle flex items-center justify-center">
                        <Icon name="heroicons:trophy" class="w-5 h-5 text-accent" />
                      </div>
                      <h2 class="text-size-2 font-semibold text-foreground">Proponer Puntuación</h2>
                    </div>
                    <button
                      @click="showScoreForm = false"
                      class="w-8 h-8 rounded-lg bg-surface border border-border-subtle flex items-center justify-center text-foreground-muted hover:text-foreground hover:border-accent/50 transition-all"
                    >
                      <Icon name="heroicons:x-mark" class="w-5 h-5" />
                    </button>
                  </div>
                  
                  <form @submit.prevent="handleProposeScore" class="space-y-6">
                    <div>
                      <label for="score" class="block text-size-4 font-semibold text-foreground mb-3">
                        Resultado
                      </label>
                      <input
                        id="score"
                        v-model="scoreForm.score"
                        type="text"
                        required
                        class="w-full px-4 py-3 rounded-xl bg-surface border-2 border-border-subtle text-foreground placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all"
                        placeholder="Ej: 6-4, 6-3"
                      />
                    </div>

                    <div>
                      <label for="winner" class="block text-size-4 font-semibold text-foreground mb-3">
                        Ganador
                      </label>
                      <select
                        id="winner"
                        v-model="scoreForm.winner_id"
                        required
                        class="w-full px-4 py-3 rounded-xl bg-surface border-2 border-border-subtle text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all"
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
                        class="btn-primary text-size-3 flex-1 justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Icon name="heroicons:check" class="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                        Proponer
                      </button>
                      <button
                        type="button"
                        @click="showScoreForm = false"
                        class="btn-secondary text-size-3 flex-1 justify-center"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </Transition>
          </Teleport>

          <!-- Accept Match Form Modal -->
          <Teleport to="body">
            <Transition name="modal">
              <div v-if="showAcceptMatchForm" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" @click.self="showAcceptMatchForm = false">
                <div class="glass-card-elevated p-8 max-w-md w-full animate-fade-in-scale">
                  <div class="flex items-center justify-between mb-6">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-lg bg-accent-subtle flex items-center justify-center">
                        <Icon name="heroicons:check-circle" class="w-5 h-5 text-accent" />
                      </div>
                      <h2 class="text-size-2 font-semibold text-foreground">Aceptar Partido</h2>
                    </div>
                    <button
                      @click="showAcceptMatchForm = false"
                      class="w-8 h-8 rounded-lg bg-surface border border-border-subtle flex items-center justify-center text-foreground-muted hover:text-foreground hover:border-accent/50 transition-all"
                    >
                      <Icon name="heroicons:x-mark" class="w-5 h-5" />
                    </button>
                  </div>
                  
                  <div class="space-y-6">
                    <div class="p-4 rounded-xl bg-accent-subtle/20 border border-accent/30">
                      <p class="text-size-4 font-semibold text-foreground mb-2">Detalles del Partido</p>
                      <div class="space-y-2 text-size-5 text-foreground-muted">
                        <p><span class="font-semibold text-foreground">Fecha:</span> {{ match.scheduled_at ? formatDateTime(match.scheduled_at) : 'Sin agendar' }}</p>
                        <p><span class="font-semibold text-foreground">Ubicación:</span> {{ match.location || 'Sin ubicación' }}</p>
                      </div>
                    </div>
                    
                    <!-- Change Proposal Form -->
                    <form v-if="acceptMatchForm.proposeChanges" @submit.prevent="handleAcceptMatchWithChanges" class="space-y-4">
                      <div>
                        <label for="accept_scheduled_at" class="block text-size-4 font-semibold text-foreground mb-3">
                          Nueva Fecha y Hora
                        </label>
                        <input
                          id="accept_scheduled_at"
                          v-model="acceptMatchForm.scheduled_at"
                          type="datetime-local"
                          :min="minDateTime"
                          class="w-full px-4 py-3 rounded-xl bg-surface border-2 border-border-subtle text-foreground placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all"
                        />
                        <p class="text-size-5 text-foreground-muted mt-2">
                          Deja vacío si solo quieres cambiar la ubicación
                        </p>
                      </div>
                      
                      <div>
                        <label for="accept_location" class="block text-size-4 font-semibold text-foreground mb-3">
                          Nueva Ubicación
                        </label>
                        <input
                          id="accept_location"
                          v-model="acceptMatchForm.location"
                          type="text"
                          class="w-full px-4 py-3 rounded-xl bg-surface border-2 border-border-subtle text-foreground placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all"
                          placeholder="Ej: Club de Tenis Quito"
                        />
                        <p class="text-size-5 text-foreground-muted mt-2">
                          Deja vacío si solo quieres cambiar la fecha y hora
                        </p>
                      </div>

                      <!-- Error Message -->
                      <div v-if="acceptMatchFormError" class="p-4 rounded-xl bg-red-500/20 border border-red-500/50">
                        <p class="text-size-4 font-regular text-red-400">{{ acceptMatchFormError }}</p>
                      </div>

                      <div class="flex gap-3 pt-2">
                        <button
                          type="submit"
                          :disabled="actionLoading || (!acceptMatchForm.scheduled_at && !acceptMatchForm.location)"
                          class="btn-primary text-size-3 flex-1 justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Icon name="heroicons:check-circle" class="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                          Aceptar y Enviar Propuesta
                        </button>
                        <button
                          type="button"
                          @click="acceptMatchForm.proposeChanges = false"
                          class="btn-secondary text-size-3 flex-1 justify-center"
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>

                    <!-- Action buttons when not proposing changes -->
                    <div v-else class="flex flex-col gap-3">
                      <button
                        type="button"
                        @click="handleAcceptMatchDirectly"
                        :disabled="actionLoading"
                        class="btn-primary text-size-3 w-full justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Icon name="heroicons:check-circle" class="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                        Aceptar Partido
                      </button>
                      <button
                        type="button"
                        @click="acceptMatchForm.proposeChanges = true"
                        :disabled="actionLoading"
                        class="btn-secondary text-size-3 w-full justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Icon name="heroicons:clock" class="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                        Proponer Cambios
                      </button>
                      <button
                        type="button"
                        @click="showAcceptMatchForm = false"
                        class="btn-secondary text-size-3 w-full justify-center"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </Transition>
          </Teleport>
          
          <!-- Reject Match Form Modal -->
          <Teleport to="body">
            <Transition name="modal">
              <div v-if="showRejectMatchForm" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" @click.self="showRejectMatchForm = false">
                <div class="glass-card-elevated p-8 max-w-md w-full animate-fade-in-scale">
                  <div class="flex items-center justify-between mb-6">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                        <Icon name="heroicons:x-circle" class="w-5 h-5 text-red-400" />
                      </div>
                      <h2 class="text-size-2 font-semibold text-foreground">Rechazar Partido</h2>
                    </div>
                    <button
                      @click="showRejectMatchForm = false"
                      class="w-8 h-8 rounded-lg bg-surface border border-border-subtle flex items-center justify-center text-foreground-muted hover:text-foreground hover:border-accent/50 transition-all"
                    >
                      <Icon name="heroicons:x-mark" class="w-5 h-5" />
                    </button>
                  </div>
                  
                  <div class="space-y-6">
                    <div class="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                      <p class="text-size-4 font-semibold text-foreground mb-2">¿Estás seguro?</p>
                      <p class="text-size-5 text-foreground-muted">
                        Si rechazas este partido, se cancelará y no podrás jugarlo. Esta acción no se puede deshacer.
                      </p>
                    </div>

                    <div class="flex gap-3 pt-2">
                      <button
                        @click="handleRejectMatch"
                        :disabled="actionLoading"
                        class="btn-danger text-size-3 flex-1 justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Icon name="heroicons:x-circle" class="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                        Sí, Rechazar
                      </button>
                      <button
                        type="button"
                        @click="showRejectMatchForm = false"
                        class="btn-secondary text-size-3 flex-1 justify-center"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </Transition>
          </Teleport>
          
          <!-- Cancel Match Form Modal -->
          <Teleport to="body">
            <Transition name="modal">
              <div v-if="showCancelMatchForm" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" @click.self="showCancelMatchForm = false">
                <div class="glass-card-elevated p-8 max-w-md w-full animate-fade-in-scale">
                  <div class="flex items-center justify-between mb-6">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                        <Icon name="heroicons:x-mark" class="w-5 h-5 text-red-400" />
                      </div>
                      <h2 class="text-size-2 font-semibold text-foreground">Cancelar Partido</h2>
                    </div>
                    <button
                      @click="showCancelMatchForm = false"
                      class="w-8 h-8 rounded-lg bg-surface border border-border-subtle flex items-center justify-center text-foreground-muted hover:text-foreground hover:border-accent/50 transition-all"
                    >
                      <Icon name="heroicons:x-mark" class="w-5 h-5" />
                    </button>
                  </div>
                  
                  <div class="space-y-6">
                    <div class="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                      <p class="text-size-4 font-semibold text-foreground mb-2">¿Estás seguro?</p>
                      <p class="text-size-5 text-foreground-muted">
                        Si cancelas este partido, se cancelará permanentemente y no podrás jugarlo. Esta acción no se puede deshacer.
                      </p>
                    </div>

                    <div class="flex gap-3 pt-2">
                      <button
                        @click="handleCancelMatch"
                        :disabled="actionLoading"
                        class="btn-danger text-size-3 flex-1 justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Icon name="heroicons:x-mark" class="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                        Sí, Cancelar
                      </button>
                      <button
                        type="button"
                        @click="showCancelMatchForm = false"
                        class="btn-secondary text-size-3 flex-1 justify-center"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </Transition>
          </Teleport>
          
          <!-- Organizer Result Form Modal -->
          <Teleport to="body">
            <Transition name="modal">
              <div v-if="showOrganizerResultForm" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" @click.self="showOrganizerResultForm = false">
                <div class="glass-card-elevated p-8 max-w-md w-full animate-fade-in-scale">
                  <div class="flex items-center justify-between mb-6">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-lg bg-accent-subtle flex items-center justify-center">
                        <Icon name="heroicons:shield-check" class="w-5 h-5 text-accent" />
                      </div>
                      <h2 class="text-size-2 font-semibold text-foreground">
                        {{ match.status === 'completed' ? 'Editar Resultado' : 'Establecer Resultado' }}
                      </h2>
                    </div>
                    <button
                      @click="showOrganizerResultForm = false"
                      class="w-8 h-8 rounded-lg bg-surface border border-border-subtle flex items-center justify-center text-foreground-muted hover:text-foreground hover:border-accent/50 transition-all"
                    >
                      <Icon name="heroicons:x-mark" class="w-5 h-5" />
                    </button>
                  </div>
                  
                  <form @submit.prevent="handleOrganizerSetResult" class="space-y-6">
                    <div>
                      <label for="organizer_winner" class="block text-size-4 font-semibold text-foreground mb-3">
                        Ganador
                      </label>
                      <select
                        id="organizer_winner"
                        v-model="organizerResultForm.winner_id"
                        required
                        class="w-full px-4 py-3 rounded-xl bg-surface border-2 border-border-subtle text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all"
                      >
                        <option value="">Selecciona el ganador</option>
                        <option v-if="match?.player1" :value="match.player1_id">{{ match.player1.name }}</option>
                        <option v-if="match?.player2" :value="match.player2_id">{{ match.player2.name }}</option>
                      </select>
                    </div>

                    <div>
                      <label class="flex items-center gap-3 cursor-pointer">
                        <input
                          v-model="organizerResultForm.is_wo"
                          type="checkbox"
                          class="w-5 h-5 rounded border-border-subtle text-accent focus:ring-accent"
                        />
                        <span class="text-size-4 font-semibold text-foreground">Marcar como Walkover (WO)</span>
                      </label>
                      <p class="text-size-5 text-foreground-muted mt-2 ml-8">
                        Usa esta opción si el partido no se jugó (por ejemplo, por ausencia de un jugador)
                      </p>
                    </div>

                    <div v-if="!organizerResultForm.is_wo">
                      <label for="organizer_score" class="block text-size-4 font-semibold text-foreground mb-3">
                        Resultado
                      </label>
                      <input
                        id="organizer_score"
                        v-model="organizerResultForm.score"
                        type="text"
                        required
                        class="w-full px-4 py-3 rounded-xl bg-surface border-2 border-border-subtle text-foreground placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all"
                        placeholder="Ej: 6-4, 6-3"
                      />
                      <p class="text-size-5 text-foreground-muted mt-2">
                        Formato: sets separados por comas (ej: "6-4, 6-3" o "6-2, 4-6, 6-1")
                      </p>
                    </div>

                    <!-- Error Message -->
                    <div v-if="organizerResultFormError" class="p-4 rounded-xl bg-red-500/20 border border-red-500/50">
                      <p class="text-size-4 font-regular text-red-400">{{ organizerResultFormError }}</p>
                    </div>

                    <div class="flex gap-3 pt-2">
                      <button
                        type="submit"
                        :disabled="actionLoading || !organizerResultForm.winner_id || (!organizerResultForm.is_wo && !organizerResultForm.score)"
                        class="btn-primary text-size-3 flex-1 justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Icon name="heroicons:check-circle" class="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                        {{ match.status === 'completed' ? 'Actualizar Resultado' : 'Establecer Resultado' }}
                      </button>
                      <button
                        type="button"
                        @click="showOrganizerResultForm = false"
                        class="btn-secondary text-size-3 flex-1 justify-center"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </Transition>
          </Teleport>

          <!-- Chat Section -->
          <div class="glass-card-elevated p-6 md:p-8 animate-fade-up animate-delay-3">
            <div class="flex items-center justify-between mb-6">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg bg-accent-subtle flex items-center justify-center">
                  <Icon name="heroicons:chat-bubble-left-right" class="w-5 h-5 text-accent" />
                </div>
                <h2 class="text-size-2 font-semibold text-foreground">Chat del Partido</h2>
              </div>
              <button
                v-if="isPlayerInMatch || isTournamentOrganizer"
                @click="toggleChat"
                class="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-border-subtle text-foreground hover:border-accent/50 hover:bg-surface-elevated transition-all group"
              >
                <span class="text-size-4">{{ isChatOpen ? 'Ocultar' : 'Mostrar' }}</span>
                <Icon 
                  name="heroicons:chevron-down" 
                  :class="['w-5 h-5 transition-transform duration-300', isChatOpen ? 'rotate-180' : '']"
                />
              </button>
            </div>
            
            <!-- Chat Content -->
            <Transition name="slide-down">
              <div v-if="isChatOpen" class="space-y-4">
                <!-- Messages -->
                <div ref="messagesContainer" class="space-y-3 mb-4 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                  <div v-if="initialLoading && chatMessages.length === 0" class="text-center py-8">
                    <Icon name="heroicons:arrow-path" class="w-8 h-8 text-foreground-muted animate-spin mx-auto mb-3" />
                    <p class="text-size-4 text-foreground-muted">Cargando mensajes...</p>
                  </div>
                  <div v-else-if="!initialLoading && chatMessages.length === 0" class="text-center py-12">
                    <div class="w-16 h-16 rounded-full bg-surface border border-border-subtle flex items-center justify-center mx-auto mb-4">
                      <Icon name="heroicons:chat-bubble-left" class="w-8 h-8 text-foreground-muted" />
                    </div>
                    <p class="text-size-4 text-foreground-muted mb-1">No hay mensajes aún</p>
                    <p class="text-size-4 text-foreground-subtle">¡Sé el primero en escribir!</p>
                  </div>
                  <template v-for="(message, index) in chatMessages" :key="message.id">
                    <!-- Show user info only if not grouped with previous message -->
                    <div
                      v-if="!shouldGroupMessage(message, chatMessages[index - 1])"
                      :class="[
                        'flex items-center gap-2 mb-2',
                        message.player_id === currentPlayerId ? 'justify-end' : 'justify-start'
                      ]"
                    >
                      <div class="w-6 h-6 rounded-full bg-surface border border-border-subtle flex items-center justify-center flex-shrink-0">
                        <span class="text-xs font-bold" :class="message.player_id === currentPlayerId ? 'text-accent' : 'text-foreground-muted'">
                          {{ getPlayerInitials(message.player?.name || 'Jugador') }}
                        </span>
                      </div>
                      <NuxtLink
                        v-if="message.player"
                        :to="`/players/${message.player.id}`"
                        class="text-size-4 font-semibold text-foreground hover:text-accent transition-all hover:underline"
                      >
                        {{ message.player.name }}
                      </NuxtLink>
                      <p v-else class="text-size-4 font-semibold text-foreground">
                        Jugador
                      </p>
                    </div>
                    
                    <!-- Message bubble -->
                    <div
                      :class="[
                        'p-4 rounded-xl transition-all animate-fade-up',
                        message.player_id === currentPlayerId
                          ? 'bg-gradient-to-br from-accent-subtle/50 to-accent-subtle/20 border border-accent/30 ml-auto max-w-[85%]'
                          : 'bg-surface border border-border-subtle max-w-[85%]',
                        message._error ? 'border-red-500/50 bg-red-500/10' : '',
                        message._sending ? 'opacity-70' : ''
                      ]"
                      :style="{ animationDelay: `${index * 0.02}s` }"
                    >
                      <div class="flex items-start justify-between gap-3">
                        <p class="text-size-3 text-foreground leading-relaxed flex-1">
                          {{ message.message }}
                          <span v-if="message._sending" class="ml-2 inline-block">
                            <Icon name="heroicons:arrow-path" class="w-3 h-3 text-foreground-muted animate-spin inline" />
                          </span>
                          <span v-if="message._error" class="ml-2 text-red-400 text-size-4">
                            <Icon name="heroicons:exclamation-circle" class="w-4 h-4 inline" />
                          </span>
                        </p>
                      </div>
                      <div class="flex items-center justify-between mt-2">
                        <p class="text-size-4 text-foreground-subtle flex items-center gap-1">
                          <Icon name="heroicons:clock" class="w-3 h-3" />
                          {{ formatTime(message.created_at) }}
                        </p>
                        <button
                          v-if="message._error"
                          @click="retrySendMessage(message)"
                          class="text-size-4 text-accent hover:text-accent/80 transition-colors flex items-center gap-1"
                          title="Reintentar envío"
                        >
                          <Icon name="heroicons:arrow-path" class="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </template>
                </div>

                <!-- Message Input -->
                <form @submit.prevent="handleSendMessage" class="flex gap-3">
                  <div class="flex-1 relative">
                    <input
                      v-model="messageInput"
                      type="text"
                      :disabled="sendingMessage || (!isPlayerInMatch && !isTournamentOrganizer)"
                      @focus="pausePolling"
                      @blur="resumePolling"
                      @keydown.enter.exact.prevent="handleSendMessage"
                      placeholder="Escribe un mensaje..."
                      class="w-full px-4 py-3 pr-12 rounded-xl bg-surface border-2 border-border-subtle text-foreground placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all disabled:opacity-50"
                    />
                    <div v-if="messageInput.trim()" class="absolute right-3 top-1/2 -translate-y-1/2">
                      <Icon name="heroicons:paper-airplane" class="w-5 h-5 text-accent" />
                    </div>
                  </div>
                  <button
                    type="submit"
                    :disabled="sendingMessage || !messageInput.trim() || (!isPlayerInMatch && !isTournamentOrganizer)"
                    class="btn-primary text-size-3 px-6 disabled:opacity-50 disabled:cursor-not-allowed group relative"
                  >
                    <Icon 
                      v-if="!sendingMessage"
                      name="heroicons:paper-airplane" 
                      class="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" 
                    />
                    <Icon 
                      v-else
                      name="heroicons:arrow-path" 
                      class="w-5 h-5 animate-spin" 
                    />
                  </button>
                </form>
                
              </div>
            </Transition>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Match, MatchMessage } from '~/types'

definePageMeta({
  middleware: 'auth'
})

const route = useRoute()
const matchId = route.params.id as string

const { isLoaded, userId, user } = useAuthState()
const { player, fetchPlayer } = usePlayer()
const { getMatch, updateMatchStatus, proposeScore, approveScore, rejectScore, cancelMatch, acceptMatch, rejectMatch, approveAcceptanceChange, rejectAcceptanceChange, proposeSchedule, approveSchedule, rejectSchedule, proposeReschedule, approveReschedule, rejectReschedule, organizerSetResult, loading, error } = useMatches()
const { fetchMessages, sendMessage, messages: chatMessages, loading: chatLoading, isPolling, setPolling, removeOptimisticMessage } = useMatchChat()
const sendingMessage = ref(false)
const initialLoading = ref(false)
const isPollingPaused = ref(false)
const failedMessages = ref<Map<string, any>>(new Map())

const match = ref<Match | null>(null)
const ratingHistory = ref<{
  player1?: { elo_change: number; elo_before: number; elo_after: number }
  player2?: { elo_change: number; elo_before: number; elo_after: number }
} | null>(null)
const actionLoading = ref(false)
const showScoreForm = ref(false)
const showOrganizerResultForm = ref(false)
const showRescheduleForm = ref(false)
const showScheduleForm = ref(false)
const showAcceptMatchForm = ref(false)
const showRejectMatchForm = ref(false)
const showCancelMatchForm = ref(false)
const isChatOpen = ref(false)
const messageInput = ref('')
const messagesContainer = ref<HTMLElement | null>(null)
const scoreForm = ref({
  score: '',
  winner_id: ''
})
const organizerResultForm = ref({
  score: '',
  winner_id: '',
  is_wo: false
})
const organizerResultFormError = ref<string | null>(null)
const rescheduleForm = ref({
  scheduled_at: ''
})
const rescheduleFormError = ref<string | null>(null)
const scheduleForm = ref({
  scheduled_at: ''
})
const scheduleFormError = ref<string | null>(null)
const acceptMatchForm = ref({
  proposeChanges: false,
  scheduled_at: '',
  location: ''
})
const acceptMatchFormError = ref<string | null>(null)

// Get current date/time in datetime-local format (YYYY-MM-DDTHH:mm)
const minDateTime = computed(() => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
})

// Check if selected reschedule date is in the past
const isRescheduleDateInPast = computed(() => {
  if (!rescheduleForm.value.scheduled_at) return false
  const selectedDate = new Date(rescheduleForm.value.scheduled_at)
  const now = new Date()
  return selectedDate < now
})

// Check if selected schedule date is in the past
const isScheduleDateInPast = computed(() => {
  if (!scheduleForm.value.scheduled_at) return false
  const selectedDate = new Date(scheduleForm.value.scheduled_at)
  const now = new Date()
  return selectedDate < now
})

const currentPlayerId = computed(() => player.value?.id)
const isPlayerInMatch = computed(() => {
  if (!match.value || !currentPlayerId.value) return false
  return match.value.player1_id === currentPlayerId.value || 
         match.value.player2_id === currentPlayerId.value
})

// Check if user is organizer of the tournament
const isTournamentOrganizer = computed(() => {
  if (!match.value?.tournament_id || !currentPlayerId.value) return false
  // Check if user has organizer role
  const role = user.value?.publicMetadata?.role as string | undefined
  if (role !== 'tournament_organizer') return false
  
  // Check if user is the organizer of this tournament
  // We'll verify this when loading the match
  return match.value.tournament?.organizer_id === currentPlayerId.value ||
         match.value.tournament?.created_by === currentPlayerId.value
})

// Check if user can view this match (player or organizer)
const canViewMatch = computed(() => {
  return isPlayerInMatch.value || isTournamentOrganizer.value
})

// Get back URL based on where user came from
const getBackUrl = () => {
  const tournamentId = route.query.tournamentId as string | undefined
  if (!tournamentId) return '/matches'
  
  // If user is organizer, go to organizer tournament page
  if (isTournamentOrganizer.value) {
    return `/organizer/tournaments/${tournamentId}`
  }
  
  // Otherwise, go to public tournament page
  return `/tournaments/${tournamentId}`
}

// Get back label based on where user came from
const getBackLabel = () => {
  const tournamentId = route.query.tournamentId as string | undefined
  if (!tournamentId) return 'Volver a Partidos'
  return 'Volver al Torneo'
}

const statusLabel = computed(() => {
  if (!match.value) return ''
  // Si está scheduled pero sin fecha, mostrar "Sin agendar"
  if (match.value.status === 'scheduled' && !match.value.scheduled_at) {
    return 'Sin agendar'
  }
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
  // Si está scheduled pero sin fecha, usar estilo diferente
  if (match.value.status === 'scheduled' && !match.value.scheduled_at) {
    return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30 backdrop-blur-sm'
  }
  const classes: Record<string, string> = {
    scheduled: 'bg-blue-500/10 text-blue-400 border-blue-500/30 backdrop-blur-sm',
    active: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30 backdrop-blur-sm',
    completed: 'bg-green-500/10 text-green-400 border-green-500/30 backdrop-blur-sm',
    cancelled: 'bg-red-500/10 text-red-400 border-red-500/30 backdrop-blur-sm'
  }
  return classes[match.value.status] || ''
})

const statusIcon = computed(() => {
  if (!match.value) return 'heroicons:circle'
  const icons: Record<string, string> = {
    scheduled: 'heroicons:calendar',
    active: 'heroicons:play-circle',
    completed: 'heroicons:check-circle',
    cancelled: 'heroicons:x-circle'
  }
  return icons[match.value.status] || 'heroicons:circle'
})

const getPlayerInitials = (name: string) => {
  if (!name) return '?'
  const parts = name.trim().split(' ')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

const openRescheduleForm = () => {
  rescheduleFormError.value = null
  // Set default date to current date/time
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  // Default to 00:00 (midnight)
  rescheduleForm.value.scheduled_at = `${year}-${month}-${day}T00:00`
  showRescheduleForm.value = true
}

const openScheduleForm = () => {
  scheduleFormError.value = null
  // Set default date to current date with time 00:00 (midnight)
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  // Default to 00:00 (midnight)
  scheduleForm.value.scheduled_at = `${year}-${month}-${day}T00:00`
  showScheduleForm.value = true
}

const formatDateTime = (dateString: string | null | undefined) => {
  if (!dateString) return 'Sin agendar'
  const date = new Date(dateString)
  // Verificar si la fecha es válida
  if (isNaN(date.getTime())) return 'Fecha inválida'
  // Use Ecuador timezone for display
  return date.toLocaleString('es-ES', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatTime = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  
  // Show relative time for recent messages
  if (diffMins < 1) {
    return 'Ahora'
  } else if (diffMins < 60) {
    return `Hace ${diffMins} min${diffMins > 1 ? 's' : ''}`
  } else if (diffHours < 24) {
    return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`
  } else if (diffDays === 1) {
    return 'Ayer'
  } else if (diffDays < 7) {
    return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`
  }
  
  // For older messages, show date and time
  const isToday = date.toDateString() === now.toDateString()
  if (isToday) {
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }
  
  return date.toLocaleString('es-ES', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Check if messages should be grouped (same user, within 5 minutes)
const shouldGroupMessage = (current: any, previous: any) => {
  if (!previous) return false
  if (current.player_id !== previous.player_id) return false
  
  const currentTime = new Date(current.created_at).getTime()
  const previousTime = new Date(previous.created_at).getTime()
  const diffMins = (currentTime - previousTime) / 60000
  
  return diffMins < 5
}

// Smart scroll: only scroll if user is near bottom (within 100px)
const scrollToBottom = (force = false) => {
  nextTick(() => {
    if (messagesContainer.value) {
      const container = messagesContainer.value
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100
      
      if (force || isNearBottom) {
        container.scrollTop = container.scrollHeight
      }
    }
  })
}

const loadMatch = async () => {
  if (!userId.value) return
  
  // Ensure player is loaded before checking match
  if (!player.value) {
    await fetchPlayer(userId.value)
  }
  
  if (!player.value) {
    return
  }
  
  try {
    const data = await getMatch(matchId, userId.value)
    match.value = data
    
    // Load rating history if match is competitive and completed
    if (data.is_competitive && data.status === 'completed' && data.player1_id && data.player2_id) {
      try {
        const response = await $fetch<{
          success: boolean
          rating_history: {
            player1: { elo_change: number; elo_before: number; elo_after: number } | null
            player2: { elo_change: number; elo_before: number; elo_after: number } | null
          } | null
        }>(`/api/matches/${matchId}/rating-history`, {
          query: { clerk_id: userId.value }
        }).catch(() => ({ success: false, rating_history: null }))
        
        if (response.success && response.rating_history) {
          ratingHistory.value = {
            player1: response.rating_history.player1 || undefined,
            player2: response.rating_history.player2 || undefined
          }
        } else {
          ratingHistory.value = null
        }
      } catch (err) {
        // Silently fail - rating history is optional
        ratingHistory.value = null
      }
    } else {
      ratingHistory.value = null
    }
    
    // Auto-start match if scheduled time has passed
    if (data.status === 'scheduled' && data.scheduled_at) {
      const scheduledTime = new Date(data.scheduled_at)
      const now = new Date()
      
      // Check if scheduled time has passed (with 1 minute buffer to avoid timezone issues)
      if (scheduledTime <= now) {
        // Verify match can be started (same validations as manual start)
        const canAutoStart = 
          !data.pending_player2_id && // No pending player
          (data.player2_id || data.pending_player2_id) && // Has opponent
          (!data.match_proposed_by || data.match_accepted_by || data.tournament_id) && // Accepted or tournament match
          !((data.acceptance_proposed_scheduled_at || data.acceptance_proposed_location !== null) && 
            !data.acceptance_change_approved_by && !data.acceptance_change_rejected_by) // No pending acceptance changes
        
        if (canAutoStart) {
          try {
            // Auto-start the match
            await updateMatchStatus(userId.value, data.id, 'active')
            // Reload match to get updated status
            const updatedData = await getMatch(matchId, userId.value)
            match.value = updatedData
          } catch (err: any) {
            // Silently handle errors - match might not be startable for other reasons
            console.log('Could not auto-start match:', err.message || err)
          }
        }
      }
    }
    
    // Check if current player is part of the match
    const isPartOfMatch = match.value.player1_id === player.value.id || 
                         match.value.player2_id === player.value.id
    
    // Load messages if user is part of the match
    if (isPartOfMatch && userId.value) {
      try {
        await fetchMessages(matchId, userId.value, undefined, 3, false)
        scrollToBottom()
      } catch (err: any) {
        // If 403, user is not part of match - don't load messages
        // Silently handle other errors
      }
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

const openOrganizerResultForm = () => {
  organizerResultFormError.value = null
  // Pre-fill form with current match data if editing
  if (match.value && match.value.status === 'completed') {
    organizerResultForm.value = {
      winner_id: match.value.winner_id || '',
      score: match.value.score && match.value.score !== 'WO' ? match.value.score : '',
      is_wo: match.value.score === 'WO'
    }
  } else {
    organizerResultForm.value = { score: '', winner_id: '', is_wo: false }
  }
  showOrganizerResultForm.value = true
}

const handleOrganizerSetResult = async () => {
  if (!userId.value || !match.value) return
  
  organizerResultFormError.value = null
  actionLoading.value = true
  
  try {
    await organizerSetResult(userId.value, match.value.id, {
      winner_id: organizerResultForm.value.winner_id,
      score: organizerResultForm.value.is_wo ? undefined : organizerResultForm.value.score,
      is_wo: organizerResultForm.value.is_wo
    })
    showOrganizerResultForm.value = false
    organizerResultForm.value = { score: '', winner_id: '', is_wo: false }
    await loadMatch()
  } catch (err: any) {
    organizerResultFormError.value = err.data?.message || err.message || 'Error al establecer el resultado'
    console.error('Error setting result as organizer:', err)
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

const openCancelMatchForm = () => {
  showCancelMatchForm.value = true
}

const handleCancelMatch = async () => {
  if (!userId.value || !match.value) return
  
  actionLoading.value = true
  try {
    await cancelMatch(userId.value, match.value.id)
    showCancelMatchForm.value = false
    await loadMatch()
  } catch (err) {
    console.error('Error cancelling match:', err)
  } finally {
    actionLoading.value = false
  }
}

const openAcceptMatchForm = () => {
  acceptMatchFormError.value = null
  acceptMatchForm.value = {
    proposeChanges: false,
    scheduled_at: '',
    location: ''
  }
  showAcceptMatchForm.value = true
}

const handleAcceptMatchDirectly = async () => {
  if (!userId.value || !match.value) return
  
  actionLoading.value = true
  try {
    // Accept without any changes
    await acceptMatch(userId.value, match.value.id)
    showAcceptMatchForm.value = false
    acceptMatchForm.value = { proposeChanges: false, scheduled_at: '', location: '' }
    await loadMatch()
  } catch (err: any) {
    const toast = useToastNotifications()
    acceptMatchFormError.value = err.data?.message || err.message || 'Error al aceptar el partido'
    toast.error(err.data?.message || err.message || 'Error al aceptar el partido')
  } finally {
    actionLoading.value = false
  }
}

const handleAcceptMatchWithChanges = async () => {
  if (!userId.value || !match.value) return
  
  acceptMatchFormError.value = null
  
  // Validate if proposing changes
  if (acceptMatchForm.value.proposeChanges) {
    if (acceptMatchForm.value.scheduled_at) {
      const proposedDate = new Date(acceptMatchForm.value.scheduled_at)
      if (proposedDate <= new Date()) {
        acceptMatchFormError.value = 'La fecha propuesta debe ser en el futuro'
        return
      }
    }
  }
  
  actionLoading.value = true
  try {
    // Send datetime-local as-is - backend will convert it treating it as Ecuador time
    const payload = acceptMatchForm.value.proposeChanges ? {
      scheduled_at: acceptMatchForm.value.scheduled_at || undefined,
      location: acceptMatchForm.value.location || undefined
    } : undefined
    
    await acceptMatch(userId.value, match.value.id, payload)
    showAcceptMatchForm.value = false
    acceptMatchForm.value = { proposeChanges: false, scheduled_at: '', location: '' }
    await loadMatch()
  } catch (err: any) {
    const toast = useToastNotifications()
    acceptMatchFormError.value = err.data?.message || err.message || 'Error al aceptar el partido'
    toast.error(err.data?.message || err.message || 'Error al aceptar el partido')
  } finally {
    actionLoading.value = false
  }
}

const handleApproveAcceptanceChange = async () => {
  if (!userId.value || !match.value) return
  
  actionLoading.value = true
  try {
    await approveAcceptanceChange(userId.value, match.value.id)
    await loadMatch()
  } catch (err: any) {
    const toast = useToastNotifications()
    toast.error(err.data?.message || err.message || 'Error al aprobar los cambios')
  } finally {
    actionLoading.value = false
  }
}

const handleRejectAcceptanceChange = async () => {
  if (!userId.value || !match.value) return
  
  actionLoading.value = true
  try {
    await rejectAcceptanceChange(userId.value, match.value.id)
    await loadMatch()
  } catch (err: any) {
    const toast = useToastNotifications()
    toast.error(err.data?.message || err.message || 'Error al rechazar los cambios')
  } finally {
    actionLoading.value = false
  }
}

const openRejectMatchForm = () => {
  showRejectMatchForm.value = true
}

const handleRejectMatch = async () => {
  if (!userId.value || !match.value) return
  
  actionLoading.value = true
  try {
    await rejectMatch(userId.value, match.value.id)
    showRejectMatchForm.value = false
    await loadMatch()
  } catch (err: any) {
    const toast = useToastNotifications()
    toast.error(err.data?.message || err.message || 'Error al rechazar el partido')
  } finally {
    actionLoading.value = false
  }
}

const handleSchedule = async () => {
  if (!userId.value || !match.value) return
  
  scheduleFormError.value = null
  
  if (!scheduleForm.value.scheduled_at) {
    scheduleFormError.value = 'Debes seleccionar una fecha y hora'
    return
  }
  
  // Basic validation - backend will do proper timezone-aware validation
  const selectedDate = new Date(scheduleForm.value.scheduled_at)
  if (selectedDate <= new Date()) {
    scheduleFormError.value = 'No puedes programar un partido en el pasado'
    return
  }
  
  actionLoading.value = true
  
  try {
    // Send datetime-local as-is - backend will convert it treating it as Ecuador time
    await proposeSchedule(userId.value, match.value.id, {
      scheduled_at: scheduleForm.value.scheduled_at
    })
    
    // Reload match to get updated data
    await loadMatch()
    
    // Reset form and close modal
    scheduleForm.value = { scheduled_at: '' }
    showScheduleForm.value = false
  } catch (err: any) {
    scheduleFormError.value = err.data?.message || err.message || 'Error al programar el partido'
  } finally {
    actionLoading.value = false
  }
}

const handleProposeReschedule = async () => {
  if (!userId.value || !match.value) return
  
  // Reset error
  rescheduleFormError.value = null
  
  // Validate date is provided
  if (!rescheduleForm.value.scheduled_at) {
    rescheduleFormError.value = 'Debes seleccionar una fecha y hora'
    return
  }
  
  // Basic validation - backend will do proper timezone-aware validation
  const selectedDate = new Date(rescheduleForm.value.scheduled_at)
  const now = new Date()
  
  if (selectedDate < now) {
    rescheduleFormError.value = 'No puedes reagendar un partido en el pasado'
    return
  }
  
  actionLoading.value = true
  try {
    // Send datetime-local as-is - backend will convert it treating it as Ecuador time
    await proposeReschedule(userId.value, match.value.id, {
      scheduled_at: rescheduleForm.value.scheduled_at
    })
    showRescheduleForm.value = false
    rescheduleForm.value = { scheduled_at: '' }
    rescheduleFormError.value = null
    await loadMatch()
  } catch (err: any) {
    console.error('Error proposing reschedule:', err)
    // Show error to user
    const errorMessage = err?.message || err?.statusMessage || 'Error al proponer reagendamiento. Por favor intenta de nuevo.'
    rescheduleFormError.value = errorMessage
  } finally {
    actionLoading.value = false
  }
}

const handleApproveReschedule = async () => {
  if (!userId.value || !match.value) return
  
  actionLoading.value = true
  try {
    await approveReschedule(userId.value, match.value.id)
    await loadMatch()
  } catch (err) {
    console.error('Error approving reschedule:', err)
  } finally {
    actionLoading.value = false
  }
}

const handleRejectReschedule = async () => {
  if (!userId.value || !match.value) return
  
  actionLoading.value = true
  try {
    await rejectReschedule(userId.value, match.value.id)
    await loadMatch()
  } catch (err) {
    console.error('Error rejecting reschedule:', err)
  } finally {
    actionLoading.value = false
  }
}

const handleApproveSchedule = async () => {
  if (!userId.value || !match.value) return
  
  actionLoading.value = true
  try {
    await approveSchedule(userId.value, match.value.id)
    await loadMatch()
  } catch (err: any) {
    const toast = useToastNotifications()
    toast.error(err.data?.message || err.message || 'Error al aprobar la fecha')
  } finally {
    actionLoading.value = false
  }
}

const handleRejectSchedule = async () => {
  if (!userId.value || !match.value) return
  
  actionLoading.value = true
  try {
    await rejectSchedule(userId.value, match.value.id)
    await loadMatch()
  } catch (err: any) {
    const toast = useToastNotifications()
    toast.error(err.data?.message || err.message || 'Error al rechazar la fecha')
  } finally {
    actionLoading.value = false
  }
}

const toggleChat = async () => {
  if (!isPlayerInMatch.value && !isTournamentOrganizer.value) return
  
  isChatOpen.value = !isChatOpen.value
  
  if (isChatOpen.value) {
    // Open chat - load messages and start polling
    if (userId.value && (isPlayerInMatch.value || isTournamentOrganizer.value)) {
      try {
        initialLoading.value = true
        await fetchMessages(matchId, userId.value, undefined, 3, false)
        scrollToBottom(true)
        previousMessagesCount.value = chatMessages.value.filter((m: any) => !m._optimistic).length
        pollCount.value = 0
      } catch (err: any) {
        // Silently handle errors
      } finally {
        initialLoading.value = false
      }
      
      if (!messagesPollInterval) {
        startMessagesPolling()
      }
    }
  } else {
    // Close chat - stop polling to save resources
    stopMessagesPolling()
  }
}

const reloadMessages = async () => {
  if (!userId.value || (!isPlayerInMatch.value && !isTournamentOrganizer.value)) return
  
  try {
    // Always do full refresh when manually reloading
    await fetchMessages(matchId, userId.value, undefined, 3, false)
    scrollToBottom()
    previousMessagesCount.value = chatMessages.value.filter((m: any) => !m._optimistic).length
    pollCount.value = 0 // Reset poll count
  } catch (err: any) {
    // Silently handle errors
  }
}

const handleSendMessage = async () => {
  if (!userId.value || !messageInput.value.trim()) return
  if (!isPlayerInMatch.value && !isTournamentOrganizer.value) return
  
  const messageText = messageInput.value.trim()
  messageInput.value = '' // Clear input immediately for better UX
  sendingMessage.value = true
  
  try {
    await sendMessage(matchId, userId.value, {
      message: messageText
    })
    scrollToBottom(true) // Force scroll for sent messages
    // Update previous count after sending
    previousMessagesCount.value = chatMessages.value.filter((m: any) => !m._optimistic).length
  } catch (err: any) {
    // Restore message text on error
    messageInput.value = messageText
    const toast = useToastNotifications()
    toast.error('Error al enviar mensaje. Intenta de nuevo.')
  } finally {
    sendingMessage.value = false
  }
}

const retrySendMessage = async (message: any) => {
  if (!userId.value || !message.message) return
  
  // Remove the failed optimistic message
  removeOptimisticMessage(message.id)
  
  // Try sending again
  sendingMessage.value = true
  try {
    await sendMessage(matchId, userId.value, {
      message: message.message
    })
    scrollToBottom(true)
  } catch (err: any) {
    const toast = useToastNotifications()
    toast.error('Error al reenviar mensaje. Intenta de nuevo.')
  } finally {
    sendingMessage.value = false
  }
}

const pausePolling = () => {
  isPollingPaused.value = true
}

const resumePolling = () => {
  isPollingPaused.value = false
}

// Polling interval for messages (optimized)
let messagesPollInterval: NodeJS.Timeout | null = null
const previousMessagesCount = ref(0)
const isPageVisible = ref(true)
const pollCount = ref(0)
const POLL_INTERVAL_ACTIVE = 5000 // 5 seconds when page is active
const POLL_INTERVAL_INACTIVE = 15000 // 15 seconds when page is inactive
const FULL_REFRESH_INTERVAL = 10 // Do full refresh every 10 polls to ensure consistency

// Handle page visibility to reduce polling when tab is inactive
const handleVisibilityChange = () => {
  const wasVisible = isPageVisible.value
  isPageVisible.value = !document.hidden
  
  // Restart polling with new interval if visibility changed
  if (wasVisible !== isPageVisible.value && messagesPollInterval) {
    stopMessagesPolling()
    if (isPlayerInMatch.value && match.value) {
      startMessagesPolling()
    }
  }
}

const startMessagesPolling = () => {
  if (messagesPollInterval) {
    clearInterval(messagesPollInterval)
  }
  
  const pollInterval = isPageVisible.value ? POLL_INTERVAL_ACTIVE : POLL_INTERVAL_INACTIVE
  
  messagesPollInterval = setInterval(async () => {
    // Only poll if chat is open, user is part of the match, and polling is not paused
    // Also skip polling if we're currently sending a message to avoid race conditions
    if (isChatOpen.value && !isPollingPaused.value && !sendingMessage.value && !chatLoading.value && userId.value && matchId && (isPlayerInMatch.value || isTournamentOrganizer.value) && match.value) {
      try {
        setPolling(true)
        pollCount.value++
        
        // Every N polls, do a full refresh to ensure consistency
        const shouldDoFullRefresh = pollCount.value % FULL_REFRESH_INTERVAL === 0
        
        // Store current message count before fetching (excluding optimistic messages)
        const messageCountBefore = chatMessages.value.filter((m: any) => !m._optimistic).length
        
        let newMessages: MatchMessage[]
        if (shouldDoFullRefresh || chatMessages.value.filter((m: any) => !m._optimistic).length === 0) {
          // Full refresh - get all messages (pass isPolling=true to prevent loading state)
          newMessages = await fetchMessages(matchId, userId.value, undefined, 3, true)
        } else {
          // Incremental update - get only new messages
          // Use the last non-optimistic message for since parameter
          const realMessages = chatMessages.value.filter((m: any) => !m._optimistic)
          const lastMessage = realMessages[realMessages.length - 1]
          const since = lastMessage?.created_at
          newMessages = await fetchMessages(matchId, userId.value, since, 3, true)
        }
        
        // Only scroll if new messages arrived and user is not focused on input
        const currentRealCount = chatMessages.value.filter((m: any) => !m._optimistic).length
        const hasNewMessages = currentRealCount > messageCountBefore
        if ((hasNewMessages || shouldDoFullRefresh) && !isPollingPaused.value) {
          scrollToBottom()
          previousMessagesCount.value = currentRealCount
        }
      } catch (err: any) {
        // Stop polling if user is no longer authorized (403)
        if (err?.statusCode === 403) {
          stopMessagesPolling()
        }
        // For other errors, continue polling but log
        console.error('Error polling messages:', err)
      } finally {
        setPolling(false)
      }
    }
  }, pollInterval)
}

const stopMessagesPolling = () => {
  if (messagesPollInterval) {
    clearInterval(messagesPollInterval)
    messagesPollInterval = null
  }
}

onMounted(async () => {
  // Listen for page visibility changes
  document.addEventListener('visibilitychange', handleVisibilityChange)
  
  if (isLoaded.value && userId.value) {
    await fetchPlayer(userId.value)
    await loadMatch()
    // Don't start polling automatically - wait for user to open chat
  }
})

watch([isLoaded, userId], async () => {
  if (isLoaded.value && userId.value) {
    await fetchPlayer(userId.value)
    await loadMatch()
    // Don't start polling automatically - wait for user to open chat
    if (!isPlayerInMatch.value && !isTournamentOrganizer.value) {
      stopMessagesPolling()
      isChatOpen.value = false
    }
  }
})

// Watch for changes in match or player to reload messages if chat is open
watch([match, currentPlayerId, isPlayerInMatch, isTournamentOrganizer], async () => {
  if ((isPlayerInMatch.value || isTournamentOrganizer.value) && match.value && currentPlayerId.value && userId.value && isChatOpen.value) {
    // Reload messages when match or player changes - always full refresh
    try {
      await fetchMessages(matchId, userId.value, undefined, 3, false) // No 'since' parameter = full refresh
      previousMessagesCount.value = chatMessages.value.filter((m: any) => !m._optimistic).length
      scrollToBottom()
      pollCount.value = 0 // Reset poll count
    } catch (err: any) {
      // Silently handle errors
    }
    
    if (!messagesPollInterval) {
      startMessagesPolling()
    }
  } else {
    stopMessagesPolling()
    if (!isPlayerInMatch.value && !isTournamentOrganizer.value) {
      isChatOpen.value = false
    }
  }
})

// Watch for new messages and scroll to bottom
watch(chatMessages, (newMessages, oldMessages) => {
  if (newMessages.length > (oldMessages?.length || 0)) {
    scrollToBottom()
  }
}, { deep: true })

onUnmounted(() => {
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  stopMessagesPolling()
})
</script>

