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
            <NuxtLink to="/matches" class="btn-secondary text-size-3 w-full justify-center group">
              <Icon name="heroicons:arrow-left" class="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
              Volver a Partidos
            </NuxtLink>
          </div>
        </div>

        <!-- Match Content -->
        <div v-else-if="match" class="max-w-5xl mx-auto space-y-8 animate-fade-up">
          <!-- Header with Back Button and Status -->
          <div class="flex items-center justify-between animate-fade-up animate-delay-1">
            <NuxtLink 
              to="/matches" 
              class="group flex items-center gap-2 text-size-3 text-foreground-muted hover:text-foreground transition-all"
            >
              <Icon name="heroicons:arrow-left" class="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              <span>Volver a Partidos</span>
            </NuxtLink>
            <div class="flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-sm" :class="statusBadgeClass">
              <Icon :name="statusIcon" class="w-4 h-4" />
              <span class="text-size-4 font-semibold">{{ statusLabel }}</span>
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
            <div class="grid md:grid-cols-2 gap-6 mb-8">
              <!-- Scheduled Time -->
              <div class="p-5 rounded-xl bg-surface border border-border-subtle hover:border-accent/30 transition-all">
                <div class="flex items-center gap-3 mb-3">
                  <div class="w-10 h-10 rounded-lg bg-accent-subtle flex items-center justify-center">
                    <Icon name="heroicons:calendar" class="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <p class="text-size-4 font-semibold text-foreground-muted mb-1">Fecha y Hora</p>
                    <p class="text-size-3 text-foreground font-semibold">
                      {{ formatDateTime(match.scheduled_at) }}
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
            </div>

            <!-- Score Section - Only show if score is approved (completed match or score_approved_by exists) -->
            <div v-if="match.score && (match.status === 'completed' || match.score_approved_by)" class="mb-8 p-6 rounded-xl bg-gradient-to-br from-accent-subtle/30 to-accent-subtle/10 border border-accent/30">
              <div class="flex items-center gap-3 mb-4">
                <Icon name="heroicons:trophy" class="w-6 h-6 text-accent" />
                <p class="text-size-3 font-semibold text-foreground">Resultado</p>
              </div>
              <p class="text-size-2 font-bold text-foreground mb-3">{{ match.score }}</p>
              <div v-if="match.winner" class="flex items-center gap-2">
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
              <!-- Start Match Button -->
              <button
                v-if="match.status === 'scheduled' && !match.pending_player2_id"
                @click="handleStartMatch"
                :disabled="actionLoading"
                class="btn-primary text-size-3 w-full justify-center group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none"
              >
                <Icon name="heroicons:play" class="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                Iniciar Partido
              </button>

              <!-- Score Proposal -->
              <div v-if="match.status === 'active' && !match.score_proposed_by && isPlayerInMatch">
                <button
                  @click="showScoreForm = true"
                  class="btn-primary text-size-3 w-full justify-center group"
                >
                  <Icon name="heroicons:document-text" class="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                  Proponer Puntuación
                </button>
              </div>

              <!-- Score Approval/Rejection -->
              <div v-if="match.status === 'active' && match.score_proposed_by && match.score_proposed_by !== currentPlayerId">
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

              <!-- Reschedule Match -->
              <div v-if="match.status === 'active' && isPlayerInMatch">
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

              <!-- Cancel Match -->
              <button
                v-if="match.status === 'scheduled' && isPlayerInMatch"
                @click="handleCancelMatch"
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
                  <div v-if="chatLoading && chatMessages.length === 0" class="text-center py-8">
                    <Icon name="heroicons:arrow-path" class="w-8 h-8 text-foreground-muted animate-spin mx-auto mb-3" />
                    <p class="text-size-4 text-foreground-muted">Cargando mensajes...</p>
                  </div>
                  <div v-else-if="!chatLoading && chatMessages.length === 0" class="text-center py-12">
                    <div class="w-16 h-16 rounded-full bg-surface border border-border-subtle flex items-center justify-center mx-auto mb-4">
                      <Icon name="heroicons:chat-bubble-left" class="w-8 h-8 text-foreground-muted" />
                    </div>
                    <p class="text-size-4 text-foreground-muted mb-1">No hay mensajes aún</p>
                    <p class="text-size-4 text-foreground-subtle">¡Sé el primero en escribir!</p>
                  </div>
                  <div
                    v-for="(message, index) in chatMessages"
                    :key="message.id"
                    :class="[
                      'p-4 rounded-xl transition-all animate-fade-up',
                      message.player_id === currentPlayerId
                        ? 'bg-gradient-to-br from-accent-subtle/50 to-accent-subtle/20 border border-accent/30 ml-auto max-w-[85%]'
                        : 'bg-surface border border-border-subtle max-w-[85%]'
                    ]"
                    :style="{ animationDelay: `${index * 0.05}s` }"
                  >
                    <div class="flex items-center gap-2 mb-2">
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
                    <p class="text-size-3 text-foreground mb-2 leading-relaxed">{{ message.message }}</p>
                    <p class="text-size-4 text-foreground-subtle flex items-center gap-1">
                      <Icon name="heroicons:clock" class="w-3 h-3" />
                      {{ formatTime(message.created_at) }}
                    </p>
                  </div>
                </div>

                <!-- Message Input -->
                <form @submit.prevent="handleSendMessage" class="flex gap-3">
                  <div class="flex-1 relative">
                    <input
                      v-model="messageInput"
                      type="text"
                      :disabled="chatLoading || !isPlayerInMatch"
                      placeholder="Escribe un mensaje..."
                      class="w-full px-4 py-3 pr-12 rounded-xl bg-surface border-2 border-border-subtle text-foreground placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all disabled:opacity-50"
                    />
                    <div v-if="messageInput.trim()" class="absolute right-3 top-1/2 -translate-y-1/2">
                      <Icon name="heroicons:paper-airplane" class="w-5 h-5 text-accent" />
                    </div>
                  </div>
                  <button
                    type="submit"
                    :disabled="chatLoading || !messageInput.trim() || !isPlayerInMatch"
                    class="btn-primary text-size-3 px-6 disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    <Icon name="heroicons:paper-airplane" class="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
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
import type { Match } from '~/types'

definePageMeta({
  middleware: 'auth'
})

const route = useRoute()
const matchId = route.params.id as string

const { isLoaded, userId } = useAuthState()
const { player, fetchPlayer } = usePlayer()
const { getMatch, updateMatchStatus, proposeScore, approveScore, rejectScore, cancelMatch, proposeReschedule, approveReschedule, rejectReschedule, loading, error } = useMatches()
const { fetchMessages, sendMessage, messages: chatMessages, loading: chatLoading } = useMatchChat()

const match = ref<Match | null>(null)
const actionLoading = ref(false)
const showScoreForm = ref(false)
const showRescheduleForm = ref(false)
const isChatOpen = ref(false)
const messageInput = ref('')
const messagesContainer = ref<HTMLElement | null>(null)
const scoreForm = ref({
  score: '',
  winner_id: ''
})
const rescheduleForm = ref({
  scheduled_at: ''
})
const rescheduleFormError = ref<string | null>(null)

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
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  rescheduleForm.value.scheduled_at = `${year}-${month}-${day}T${hours}:${minutes}`
  showRescheduleForm.value = true
}

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

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
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
    
    // Check if current player is part of the match
    const isPartOfMatch = data.player1_id === player.value.id || 
                         data.player2_id === player.value.id
    
    // Load messages if user is part of the match
    if (isPartOfMatch && userId.value) {
      try {
        await fetchMessages(matchId, userId.value)
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

const handleProposeReschedule = async () => {
  if (!userId.value || !match.value) return
  
  // Reset error
  rescheduleFormError.value = null
  
  // Validate date is provided
  if (!rescheduleForm.value.scheduled_at) {
    rescheduleFormError.value = 'Debes seleccionar una fecha y hora'
    return
  }
  
  // Validate date is not in the past
  const selectedDate = new Date(rescheduleForm.value.scheduled_at)
  const now = new Date()
  
  if (selectedDate < now) {
    rescheduleFormError.value = 'No puedes reagendar un partido en el pasado'
    return
  }
  
  actionLoading.value = true
  try {
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

const toggleChat = async () => {
  isChatOpen.value = !isChatOpen.value
  
  if (isChatOpen.value) {
    // Open chat - load messages and start polling
    if (userId.value && isPlayerInMatch.value) {
      try {
        await fetchMessages(matchId, userId.value)
        scrollToBottom()
        previousMessagesCount.value = chatMessages.value.length
        pollCount.value = 0
      } catch (err: any) {
        // Silently handle errors
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
  if (!userId.value || !isPlayerInMatch.value) return
  
  try {
    // Always do full refresh when manually reloading
    await fetchMessages(matchId, userId.value)
    scrollToBottom()
    previousMessagesCount.value = chatMessages.value.length
    pollCount.value = 0 // Reset poll count
  } catch (err: any) {
    // Silently handle errors
  }
}

const handleSendMessage = async () => {
  if (!userId.value || !messageInput.value.trim()) return
  
  try {
    await sendMessage(matchId, userId.value, {
      message: messageInput.value.trim()
    })
    messageInput.value = ''
    scrollToBottom()
    // Update previous count after sending
    previousMessagesCount.value = chatMessages.value.length
  } catch (err) {
    // Silently handle errors
  }
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
    // Only poll if chat is open, user is part of the match
    if (isChatOpen.value && userId.value && matchId && isPlayerInMatch.value && match.value) {
      try {
        pollCount.value++
        
        // Every N polls, do a full refresh to ensure consistency
        const shouldDoFullRefresh = pollCount.value % FULL_REFRESH_INTERVAL === 0
        
        let newMessages: MatchMessage[]
        if (shouldDoFullRefresh || chatMessages.value.length === 0) {
          // Full refresh - get all messages
          newMessages = await fetchMessages(matchId, userId.value)
        } else {
          // Incremental update - get only new messages
          const lastMessage = chatMessages.value[chatMessages.value.length - 1]
          const since = lastMessage?.created_at
          newMessages = await fetchMessages(matchId, userId.value, since)
        }
        
        // Scroll to bottom if new messages arrived
        if (newMessages.length > 0 || shouldDoFullRefresh) {
          scrollToBottom()
          previousMessagesCount.value = chatMessages.value.length
        }
      } catch (err: any) {
        // Stop polling if user is no longer authorized (403)
        if (err?.statusCode === 403) {
          stopMessagesPolling()
        }
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
    if (!isPlayerInMatch.value) {
      stopMessagesPolling()
      isChatOpen.value = false
    }
  }
})

// Watch for changes in match or player to reload messages if chat is open
watch([match, currentPlayerId, isPlayerInMatch], async () => {
  if (isPlayerInMatch.value && match.value && currentPlayerId.value && userId.value && isChatOpen.value) {
    // Reload messages when match or player changes - always full refresh
    try {
      await fetchMessages(matchId, userId.value) // No 'since' parameter = full refresh
      previousMessagesCount.value = chatMessages.value.length
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
    if (!isPlayerInMatch.value) {
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

