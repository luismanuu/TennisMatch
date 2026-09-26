<template>
  <PageLayout>
    <div v-if="loading" class="panel loading-state" aria-busy="true">
      <Icon name="heroicons:arrow-path" class="loading-spinner animate-spin" aria-hidden="true" />
      <p class="loading-text">Cargando partido…</p>
    </div>

    <div v-else-if="error" class="panel empty-state" role="alert">
      <Icon name="heroicons:lock-closed" class="empty-state-icon text-danger" aria-hidden="true" />
      <h1 class="empty-state-title">{{ error.statusCode === 403 ? 'Acceso denegado' : 'No pudimos cargar el partido' }}</h1>
      <p class="empty-state-description">
        {{ error.statusCode === 403
          ? 'No tienes permiso para ver este partido. Solo puedes ver los partidos en los que participas.'
          : error.message || 'Error al cargar el partido' }}
      </p>
      <NuxtLink :to="getBackUrl()" class="btn-secondary">
        <Icon name="heroicons:arrow-left" class="w-5 h-5" aria-hidden="true" />
        {{ getBackLabel() }}
      </NuxtLink>
    </div>

    <!-- Partido / Resultado (DESIGN.md §7, design/mock/court-Partido.html, court-Resultado.html) -->
    <div v-else-if="match">
      <header class="page-heading">
        <NuxtLink :to="getBackUrl()" class="text-link">
          <Icon name="heroicons:arrow-left" class="w-5 h-5" aria-hidden="true" />
          {{ getBackLabel() }}
        </NuxtLink>
        <h1>{{ isPlayerInMatch ? 'Tu partido' : 'Partido' }}</h1>
        <div class="match-tags">
          <MatchTournamentBadge :match="match" />
          <span class="badge">{{ match.is_competitive !== false ? 'Competitivo' : 'Amistoso' }}</span>
        </div>
      </header>

      <div class="split-grid even">
        <div class="flow-stack">
          <PhotoPanel photo="claynight" variant="priority" eager>
            <template #decor><CourtLines :rally="match.status === 'completed'" /></template>
            <span class="status-pill"><Icon :name="statusIcon" class="w-4 h-4" aria-hidden="true" />{{ statusLabel }}</span>
            <h2>{{ heroDate }}</h2>
            <p v-if="heroTime" class="score">{{ heroTime }}</p>
            <p v-if="match.location">{{ match.location }}</p>
            <p v-else-if="!match.scheduled_at">Los jugadores deben programar este partido.</p>
          </PhotoPanel>

          <section class="panel" aria-label="Jugadores">
            <div class="players">
              <div class="player">
                <span class="avatar player__avatar" aria-hidden="true">{{ getPlayerInitials(match.player1?.name || 'Jugador 1') }}</span>
                <h2 v-if="match.player1"><NuxtLink :to="`/players/${match.player1.id}`">{{ match.player1.name }}</NuxtLink></h2>
                <h2 v-else>Jugador 1</h2>
                <span v-if="match.player1?.status === 'deleted'" class="status-badge status-badge-danger">Eliminado</span>
                <span v-if="getPlayerTier(match.player1)" class="badge">
                  <img v-if="getPlayerRankIcon(match.player1)" :src="getPlayerRankIcon(match.player1)" alt="" class="w-4 h-4 object-contain">
                  {{ getTierNameInSpanish(getPlayerTier(match.player1)) }}<template v-if="match.player1?.elo"> · {{ match.player1.elo.toLocaleString('es-EC') }} SR</template>
                </span>
                <a
                  v-if="match.player1 && match.player1_id !== currentPlayerId && match.player1?.phone_number"
                  :href="getWhatsAppLink(match.player1.phone_number, `Hola ${match.player1.name}, te contacto desde la plataforma de Tenis Ecuador sobre nuestro partido`)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-link"
                >
                  WhatsApp
                  <Icon name="heroicons:chat-bubble-left-right" class="w-4 h-4" aria-hidden="true" />
                </a>
              </div>
              <span class="meta players__vs">vs</span>
              <div class="player">
                <span class="avatar player__avatar" aria-hidden="true">{{ getPlayerInitials(match.player2?.name || match.pending_player2?.name || 'Oponente') }}</span>
                <h2 v-if="match.player2"><NuxtLink :to="`/players/${match.player2.id}`">{{ match.player2.name }}</NuxtLink></h2>
                <h2 v-else-if="match.pending_player2"><NuxtLink :to="`/players/${match.pending_player2.id}`">{{ match.pending_player2.name }}</NuxtLink></h2>
                <h2 v-else>Oponente</h2>
                <span v-if="match.player2?.status === 'deleted'" class="status-badge status-badge-danger">Eliminado</span>
                <span v-if="getPlayerTier(match.player2) || getPlayerTier(match.pending_player2)" class="badge">
                  <img v-if="getPlayerRankIcon(match.player2) || getPlayerRankIcon(match.pending_player2)" :src="getPlayerRankIcon(match.player2) || getPlayerRankIcon(match.pending_player2)" alt="" class="w-4 h-4 object-contain">
                  {{ getTierNameInSpanish(getPlayerTier(match.player2) || getPlayerTier(match.pending_player2)) }}<template v-if="match.player2?.elo"> · {{ match.player2.elo.toLocaleString('es-EC') }} SR</template>
                </span>
                <span v-if="match.pending_player2" class="status-badge status-badge-pending">Pendiente de registro</span>
                <a
                  v-if="match.player2 && match.player2_id !== currentPlayerId && match.player2?.phone_number"
                  :href="getWhatsAppLink(match.player2.phone_number, `Hola ${match.player2.name}, te contacto desde la plataforma de Tenis Ecuador sobre nuestro partido`)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-link"
                >
                  WhatsApp
                  <Icon name="heroicons:chat-bubble-left-right" class="w-4 h-4" aria-hidden="true" />
                </a>
              </div>
            </div>
            <p class="meta">
              {{ match.is_competitive !== false ? 'Partido competitivo: cuenta para rankings y colocación.' : 'Partido amistoso: no cuenta para rankings.' }}
              <template v-if="match.scheduled_at"> {{ formatDateTime(match.scheduled_at) }}.</template>
            </p>
          </section>

          <!-- Confirmed result -->
          <section v-if="match.score && (match.status === 'completed' || match.score_approved_by)" class="panel result" aria-labelledby="result-title">
            <h2 id="result-title" class="panel-title">Resultado</h2>
            <p class="score result__score">{{ formatScore(match.score) }}</p>
            <p v-if="match.winner" class="meta">
              Ganó <NuxtLink :to="`/players/${match.winner.id}`" class="text-accent font-semibold">{{ match.winner.name }}</NuxtLink>
              <span v-if="match.winner.status === 'deleted'" class="status-badge status-badge-danger ml-2">Eliminado</span>
            </p>
            <p v-if="match.is_competitive && notRated === 'walkover'" class="result__sr meta">Walkover: el partido no se jugó, así que no cambia el SR de nadie.</p>
            <div v-else-if="match.is_competitive && isEloCalculating" class="result__sr result__sr--loading" aria-busy="true">
              <Icon name="heroicons:arrow-path" class="w-5 h-5 text-accent animate-spin" aria-hidden="true" />
              <span class="meta">Calculando el cambio de SR…</span>
            </div>
            <div v-else-if="match.is_competitive && ratingHistory && (ratingHistory.player1 || ratingHistory.player2)" class="stats result__sr">
              <div v-if="ratingHistory.player1 && match.player1">
                <strong class="stat-value sr-spark" :class="ratingHistory.player1.elo_change > 0 ? 'text-success' : ratingHistory.player1.elo_change < 0 ? 'text-danger' : ''">{{ ratingHistory.player1.elo_change > 0 ? '+' : '' }}{{ ratingHistory.player1.elo_change }} SR</strong>
                <span class="meta"><NuxtLink :to="`/players/${match.player1.id}`">{{ match.player1.name }}</NuxtLink> · {{ ratingHistory.player1.elo_before }} → {{ ratingHistory.player1.elo_after }}</span>
              </div>
              <div v-if="ratingHistory.player2 && match.player2">
                <strong class="stat-value sr-spark" :class="ratingHistory.player2.elo_change > 0 ? 'text-success' : ratingHistory.player2.elo_change < 0 ? 'text-danger' : ''">{{ ratingHistory.player2.elo_change > 0 ? '+' : '' }}{{ ratingHistory.player2.elo_change }} SR</strong>
                <span class="meta"><NuxtLink :to="`/players/${match.player2.id}`">{{ match.player2.name }}</NuxtLink> · {{ ratingHistory.player2.elo_before }} → {{ ratingHistory.player2.elo_after }}</span>
              </div>
              <details v-if="srWhy" class="result__why">
                <summary>¿Por qué {{ srWhy.change >= 0 ? 'ganaste' : 'perdiste' }} {{ Math.abs(srWhy.change) }} SR?</summary>
                <ul class="result__why-list">
                  <li>Antes del partido: tú {{ srWhy.before }} SR, tu rival {{ srWhy.opponent }} SR.</li>
                  <li>Con esa diferencia, tu probabilidad de ganar era {{ srWhy.expectedPct }}%.</li>
                  <li>Peso del partido (K): {{ srWhy.k }}<template v-if="srWhy.placement">, más alto porque alguno de los dos está en sus partidos de colocación</template>.</li>
                  <li>{{ srWhy.marginText }}</li>
                  <li class="num">{{ srWhy.formula }}</li>
                </ul>
              </details>
            </div>
          </section>

          <!-- Proposed result awaiting review (Resultado) -->
          <section v-else-if="match.status === 'active' && match.score_proposed_by && !match.score_approved_by" class="panel result" aria-labelledby="proposed-title">
            <h2 id="proposed-title" class="panel-title">Marcador propuesto</h2>
            <p class="score result__score">{{ formatScore(match.score) }}</p>
            <p class="meta">
              Propuesto por <strong class="text-foreground">{{ match.score_proposed_by_player?.name }}</strong><template v-if="match.winner">. Victoria propuesta para <NuxtLink :to="`/players/${match.winner.id}`" class="text-accent font-semibold">{{ match.winner.name }}</NuxtLink></template>.
            </p>
          </section>
        </div>

        <aside class="flow-stack">
          <section class="panel" aria-labelledby="coord-title">
            <h2 id="coord-title" class="panel-title">{{ match.status === 'completed' || match.status === 'cancelled' ? 'Partido' : 'Coordina tu partido' }}</h2>
            <!-- Actions Section -->
            <div class="actions">
              <!-- Match Acceptance Section - Show when match is proposed but not accepted (only for non-tournament matches) -->
              <div v-if="match.status === 'scheduled' && !match.tournament_id && match.match_proposed_by && !match.match_accepted_by && !match.match_rejected_by && match.player2_id && isPlayerInMatch && currentPlayerId === match.player2_id && !isTournamentOrganizer" class="space-y-3 mb-4">
                <div class="action-card">
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
                  <div class="flex flex-col sm:flex-row gap-3">
                    <button
                      @click="openAcceptMatchForm"
                      :disabled="actionLoading"
                      class="btn-primary flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Icon name="heroicons:check-circle" class="w-5 h-5" />
                      Aceptar Partido
                    </button>
                    <button
                      @click="openRejectMatchForm"
                      :disabled="actionLoading"
                      class="btn-secondary flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Icon name="heroicons:x-circle" class="w-5 h-5" />
                      Rechazar
                    </button>
                  </div>
                </div>
              </div>
              
              <!-- Acceptance Change Proposal - Show when player2 accepted but proposed changes -->
              <!-- Show to player1 (who proposed the match) when player2 has proposed changes -->
              <!-- Condition: match accepted, has proposed changes, not yet approved/rejected, current user is player1 -->
              <div v-if="match.status === 'scheduled' && !match.tournament_id && match.match_accepted_by && (match.acceptance_proposed_scheduled_at || match.acceptance_proposed_location !== null) && !match.acceptance_change_approved_by && !match.acceptance_change_rejected_by && match.player1_id === currentPlayerId && match.match_accepted_by !== currentPlayerId && isPlayerInMatch && !isTournamentOrganizer" class="space-y-3 mb-4">
                <div class="action-card">
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
                    <div v-if="match.acceptance_proposed_scheduled_at" class="action-detail">
                      <p class="text-size-5 text-foreground-muted mb-1">Nueva Fecha y Hora:</p>
                      <p class="text-size-4 font-semibold text-foreground">{{ formatDateTime(match.acceptance_proposed_scheduled_at) }}</p>
                      <p class="text-size-5 text-foreground-muted mt-1">Fecha original: {{ formatDateTime(match.scheduled_at) }}</p>
                    </div>
                    <div v-if="match.acceptance_proposed_location !== null" class="action-detail">
                      <p class="text-size-5 text-foreground-muted mb-1">Nueva Ubicación:</p>
                      <p class="text-size-4 font-semibold text-foreground">{{ match.acceptance_proposed_location || 'Sin ubicación' }}</p>
                      <p class="text-size-5 text-foreground-muted mt-1">Ubicación original: {{ match.location || 'Sin ubicación' }}</p>
                    </div>
                    <div class="flex flex-col sm:flex-row gap-3">
                      <button
                        @click="handleApproveAcceptanceChange"
                        :disabled="actionLoading"
                        class="btn-primary flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Icon name="heroicons:check-circle" class="w-5 h-5" />
                        Aceptar Cambios
                      </button>
                      <button
                        @click="handleRejectAcceptanceChange"
                        :disabled="actionLoading"
                        class="btn-secondary flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Icon name="heroicons:x-circle" class="w-5 h-5" />
                        Rechazar Cambios
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Waiting for Acceptance Change Approval - Show when player2 accepted with changes and waiting for player1 to approve -->
              <div v-if="match.status === 'scheduled' && !match.tournament_id && match.match_accepted_by === currentPlayerId && (match.acceptance_proposed_scheduled_at || match.acceptance_proposed_location !== null) && !match.acceptance_change_approved_by && !match.acceptance_change_rejected_by && isPlayerInMatch && !isTournamentOrganizer" class="action-card mb-4">
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
                  <div v-if="match.acceptance_proposed_scheduled_at" class="action-detail">
                    <p class="text-size-5 text-foreground-muted mb-1">Nueva Fecha y Hora Propuesta:</p>
                    <p class="text-size-4 font-semibold text-foreground">{{ formatDateTime(match.acceptance_proposed_scheduled_at) }}</p>
                  </div>
                  <div v-if="match.acceptance_proposed_location !== null" class="action-detail">
                    <p class="text-size-5 text-foreground-muted mb-1">Nueva Ubicación Propuesta:</p>
                    <p class="text-size-4 font-semibold text-foreground">{{ match.acceptance_proposed_location || 'Sin ubicación' }}</p>
                  </div>
                </div>
              </div>
              
              <!-- Waiting for Acceptance - Show when you proposed and waiting for response (only for non-tournament matches) -->
              <div v-if="match.status === 'scheduled' && !match.tournament_id && match.match_proposed_by === currentPlayerId && !match.match_accepted_by && !match.match_rejected_by && match.player2_id && isPlayerInMatch && !isTournamentOrganizer" class="action-card mb-4">
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
                <Icon name="heroicons:play" class="w-5 h-5" />
                Iniciar Partido
              </button>
              
              <!-- Message when waiting for acceptance change approval -->
              <div v-if="match.status === 'scheduled' && match.scheduled_at && !match.pending_player2_id && isPlayerInMatch && !isTournamentOrganizer && (match.acceptance_proposed_scheduled_at || match.acceptance_proposed_location !== null) && !match.acceptance_change_approved_by && !match.acceptance_change_rejected_by" class="action-card action-card--quiet">
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
                <Icon name="heroicons:calendar" class="w-5 h-5" />
                Proponer Fecha
              </button>
              
              <!-- Schedule Proposal Waiting - Show when you proposed and waiting for response -->
              <div v-if="match.status === 'scheduled' && !match.scheduled_at && match.schedule_proposed_by === currentPlayerId && !match.schedule_approved_by && !match.schedule_rejected_by && isPlayerInMatch && !isTournamentOrganizer" class="action-card mb-4">
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
                <div class="action-card">
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
                    <div class="flex flex-col sm:flex-row gap-3">
                      <button
                        @click="handleApproveSchedule"
                        :disabled="actionLoading"
                        class="btn-primary flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Icon name="heroicons:check-circle" class="w-5 h-5" />
                        Aceptar
                      </button>
                      <button
                        @click="handleRejectSchedule"
                        :disabled="actionLoading"
                        class="btn-secondary flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Icon name="heroicons:x-circle" class="w-5 h-5" />
                        Rechazar
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Organizer Info Message -->
              <div v-if="isTournamentOrganizer && match.status === 'scheduled' && !match.scheduled_at" class="action-card action-card--warning">
                <Icon name="heroicons:information-circle" class="w-6 h-6 text-warning mx-auto mb-2" />
                <p class="text-size-4 text-warning font-semibold mb-1">Partido sin agendar</p>
                <p class="text-size-5 text-foreground-muted">Los jugadores deben programar este partido</p>
              </div>

              <!-- Score Proposal (players only) -->
              <div v-if="match.status === 'active' && !match.score_proposed_by && isPlayerInMatch && !isTournamentOrganizer">
                <button
                  @click="showScoreForm = true"
                  class="btn-primary text-size-3 w-full justify-center group"
                >
                  <Icon name="heroicons:document-text" class="w-5 h-5" />
                  Proponer Puntuación
                </button>
              </div>

              <!-- Score Approval/Rejection (players only) -->
              <div v-if="match.status === 'active' && match.score_proposed_by && match.score_proposed_by !== currentPlayerId && isPlayerInMatch && !isTournamentOrganizer">
                <div class="flex flex-col sm:flex-row gap-3">
                  <button
                    @click="handleApproveScore"
                    :disabled="actionLoading"
                    class="btn-primary text-size-3 flex-1 justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Icon name="heroicons:check-circle" class="w-5 h-5" />
                    Aprobar
                  </button>
                  <button
                    @click="handleRejectScore"
                    :disabled="actionLoading"
                    class="btn-secondary text-size-3 flex-1 justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Icon name="heroicons:x-circle" class="w-5 h-5" />
                    Rechazar
                  </button>
                </div>
              </div>

              <!-- Organizer Match Administration - Available in any state -->
              <div v-if="isTournamentOrganizer" class="space-y-3">
                <div class="action-card">
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
                      class="w-5 h-5" 
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
                  class="btn-secondary text-size-3 w-full justify-center group"
                >
                  <Icon name="heroicons:arrow-path" class="w-5 h-5" />
                  Reagendar Partido
                </button>
                
                <!-- Reschedule proposal status (current player) -->
                <div v-if="match.reschedule_proposed_by === currentPlayerId && !match.reschedule_approved_by && !match.reschedule_rejected_by" class="action-card">
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
                    <Icon name="heroicons:arrow-path" class="w-4 h-4" />
                    Esperando respuesta del oponente...
                  </p>
                </div>
                
                <!-- Reschedule proposal (opponent) -->
                <div v-if="match.reschedule_proposed_by && match.reschedule_proposed_by !== currentPlayerId && !match.reschedule_approved_by && !match.reschedule_rejected_by" class="action-card mb-4">
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
                  <div class="flex flex-col sm:flex-row gap-3">
                    <button
                      @click="handleApproveReschedule"
                      :disabled="actionLoading"
                      class="btn-primary text-size-3 flex-1 justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Icon name="heroicons:check-circle" class="w-5 h-5" />
                      Aceptar
                    </button>
                    <button
                      @click="handleRejectReschedule"
                      :disabled="actionLoading"
                      class="btn-secondary text-size-3 flex-1 justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Icon name="heroicons:x-circle" class="w-5 h-5" />
                      Rechazar
                    </button>
                  </div>
                </div>
              </div>

              <!-- Cancel Match (players or admin) -->
              <!-- Only player1 can cancel before acceptance, both players can cancel after acceptance, admins can always cancel -->
              <button
                v-if="match.status === 'scheduled' && (isAdmin || (isPlayerInMatch && !isTournamentOrganizer && (!match.match_proposed_by || match.match_proposed_by === currentPlayerId || match.match_accepted_by)))"
                @click="openCancelMatchForm"
                :disabled="actionLoading"
                class="btn-danger text-size-3 w-full justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Icon name="heroicons:x-mark" class="w-5 h-5" />
                Cancelar Partido
              </button>
            </div>
          </section>
        </aside>
      </div>

          <!-- Chat Section -->
          <section class="panel chat" aria-labelledby="chat-title">
            <div class="flex items-center justify-between mb-6">
              <h2 id="chat-title" class="chat__title">Chat del partido</h2>
              <button
                v-if="isPlayerInMatch || isTournamentOrganizer || isAdmin"
                @click="toggleChat"
                class="btn-secondary !min-h-[44px] !py-2" :aria-expanded="isChatOpen"
              >
                <span class="text-size-4">{{ isChatOpen ? 'Ocultar' : 'Mostrar' }}</span>
                <Icon 
                  name="heroicons:chevron-down" 
                  :class="['w-5 h-5 duration-300', isChatOpen ? 'rotate-180' : '']"
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
                        'chat__msg',
                        message.player_id === currentPlayerId
                          ? 'chat__bubble chat__bubble--mine ml-auto max-w-[85%]'
                          : 'chat__bubble max-w-[85%]',
                        message._error ? 'chat__bubble--error' : '',
                        message._sending ? 'opacity-70' : ''
                      ]"
                                          >
                      <div class="flex items-start justify-between gap-3">
                        <p class="text-size-3 text-foreground leading-relaxed flex-1 break-words">
                          {{ message.message }}
                          <span v-if="message._sending" class="ml-2 inline-block">
                            <Icon name="heroicons:arrow-path" class="w-3 h-3 text-foreground-muted animate-spin inline" />
                          </span>
                          <span v-if="message._error" class="ml-2 text-danger text-size-4">
                            <Icon name="heroicons:exclamation-circle" class="w-4 h-4 inline" />
                          </span>
                        </p>
                      </div>
                      <p
                        v-if="message.moderation_status === 'held' || message.moderation_status === 'rejected'"
                        class="chat__moderation text-size-4 mt-2"
                        role="note"
                      >
                        <Icon name="heroicons:eye-slash" class="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                        <span v-if="message.moderation_status === 'rejected' && message.player_id === currentPlayerId">
                          Oculto por moderación: tu rival no verá este mensaje.
                        </span>
                        <span v-else-if="message.moderation_status === 'rejected'">Oculto por moderación.</span>
                        <span v-else-if="message.player_id === currentPlayerId">
                          En revisión: tu rival no verá este mensaje hasta que lo revisemos.
                        </span>
                        <span v-else>En revisión: solo lo ven quien lo escribió y los administradores.</span>
                      </p>
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
                      :disabled="sendingMessage || (!isPlayerInMatch && !isTournamentOrganizer && !isAdmin)"
                      @focus="pausePolling"
                      @blur="resumePolling"
                      @keydown.enter.exact.prevent="handleSendMessage"
                      placeholder="Escribe un mensaje..."
                      class="form-input pr-12" aria-label="Mensaje"
                    />
                    <div v-if="messageInput.trim()" class="absolute right-3 top-1/2 -translate-y-1/2">
                      <Icon name="heroicons:paper-airplane" class="w-5 h-5 text-accent" />
                    </div>
                  </div>
                  <button
                    type="submit"
                    :disabled="sendingMessage || !messageInput.trim() || (!isPlayerInMatch && !isTournamentOrganizer && !isAdmin)"
                    class="btn-primary px-6" aria-label="Enviar mensaje"
                  >
                    <Icon 
                      v-if="!sendingMessage"
                      name="heroicons:paper-airplane" 
                      class="w-5 h-5" 
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
          </section>

          <!-- Reschedule Form Modal -->
          <Teleport to="body">
            <Transition name="modal">
              <div v-if="showRescheduleForm" class="te-modal" @click.self="showRescheduleForm = false">
                <div class="te-modal__panel">
                  <div class="flex items-center justify-between mb-6">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-lg bg-accent-subtle flex items-center justify-center">
                        <Icon name="heroicons:arrow-path" class="w-5 h-5 text-accent" />
                      </div>
                      <h2 class="text-size-2 font-semibold text-foreground">Reagendar Partido</h2>
                    </div>
                    <button
                      @click="showRescheduleForm = false"
                      class="icon-button"
                    >
                      <Icon name="heroicons:x-mark" class="w-5 h-5" />
                    </button>
                  </div>
                  
                  <form @submit.prevent="handleProposeReschedule" class="space-y-6">
                    <div>
                      <label for="reschedule_scheduled_at" class="form-label">
                        Nueva Fecha y Hora
                      </label>
                      <input
                        id="reschedule_scheduled_at"
                        v-model="rescheduleForm.scheduled_at"
                        type="datetime-local"
                        :min="minDateTime"
                        required
                        class="form-input"
                      />
                      <p v-if="isRescheduleDateInPast" class="text-size-4 text-danger mt-2 flex items-center gap-2">
                        <Icon name="heroicons:exclamation-triangle" class="w-4 h-4" />
                        No puedes reagendar un partido en el pasado
                      </p>
                    </div>

                    <!-- Error Message -->
                    <div v-if="rescheduleFormError" class="form-error">
                      <p class="text-size-4 text-danger">{{ rescheduleFormError }}</p>
                    </div>

                    <div class="flex flex-col sm:flex-row gap-3 pt-2">
                      <button
                        type="submit"
                        :disabled="actionLoading"
                        class="btn-primary text-size-3 flex-1 justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Icon name="heroicons:check" class="w-5 h-5" />
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
              <div v-if="showScheduleForm" class="te-modal" @click.self="showScheduleForm = false">
                <div class="te-modal__panel">
                  <div class="flex items-center justify-between mb-6">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-lg bg-accent-subtle flex items-center justify-center">
                        <Icon name="heroicons:calendar" class="w-5 h-5 text-accent" />
                      </div>
                      <h2 class="text-size-2 font-semibold text-foreground">Programar Partido</h2>
                    </div>
                    <button
                      @click="showScheduleForm = false"
                      class="icon-button"
                    >
                      <Icon name="heroicons:x-mark" class="w-5 h-5" />
                    </button>
                  </div>
                  
                  <form @submit.prevent="handleSchedule" class="space-y-6">
                    <div>
                      <label for="schedule_scheduled_at" class="form-label">
                        Fecha y Hora
                      </label>
                      <input
                        id="schedule_scheduled_at"
                        v-model="scheduleForm.scheduled_at"
                        type="datetime-local"
                        :min="minDateTime"
                        required
                        class="form-input"
                      />
                      <p v-if="isScheduleDateInPast" class="text-size-4 text-danger mt-2 flex items-center gap-2">
                        <Icon name="heroicons:exclamation-triangle" class="w-4 h-4" />
                        No puedes programar un partido en el pasado
                      </p>
                    </div>

                    <!-- Error Message -->
                    <div v-if="scheduleFormError" class="form-error">
                      <p class="text-size-4 text-danger">{{ scheduleFormError }}</p>
                    </div>

                    <div class="flex flex-col sm:flex-row gap-3 pt-2">
                      <button
                        type="submit"
                        :disabled="actionLoading"
                        class="btn-primary text-size-3 flex-1 justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Icon name="heroicons:check-circle" class="w-5 h-5" />
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
              <div v-if="showScoreForm" class="te-modal" @click.self="showScoreForm = false">
                <div class="te-modal__panel">
                  <div class="flex items-center justify-between mb-6">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-lg bg-accent-subtle flex items-center justify-center">
                        <Icon name="heroicons:trophy" class="w-5 h-5 text-accent" />
                      </div>
                      <h2 class="text-size-2 font-semibold text-foreground">Proponer Puntuación</h2>
                    </div>
                    <button
                      @click="showScoreForm = false"
                      class="icon-button"
                    >
                      <Icon name="heroicons:x-mark" class="w-5 h-5" />
                    </button>
                  </div>
                  
                  <form @submit.prevent="handleProposeScore" class="space-y-6">
                    <div>
                      <label for="score" class="form-label">
                        Resultado
                      </label>
                      <input
                        id="score"
                        v-model="scoreForm.score"
                        type="text"
                        required
                        class="form-input"
                        placeholder="Ej: 6-4 3-6 7-5"
                        aria-describedby="score-help"
                      />
                      <p id="score-help" class="text-size-5 text-foreground-muted mt-2">
                        Primero los juegos de {{ match.player1?.name || 'quien creó el partido' }}. Tiebreak: 7-6(5). Super tiebreak como tercer set: 10-8. Si alguien se retiró, añade «ret.»; si no se presentó, escribe W/O.
                      </p>
                      <p v-if="scorePreview" class="text-size-5 mt-1" :class="scorePreview.ok ? 'text-foreground-muted' : 'text-danger'" aria-live="polite">
                        {{ scorePreview.text }}
                      </p>
                    </div>

                    <div>
                      <label for="winner" class="form-label">
                        Ganador
                      </label>
                      <select
                        id="winner"
                        v-model="scoreForm.winner_id"
                        required
                        class="form-select"
                      >
                        <option value="" disabled>Selecciona el ganador</option>
                        <option :value="match.player1_id">{{ match.player1?.name }}</option>
                        <option v-if="match.player2_id" :value="match.player2_id">{{ match.player2?.name }}</option>
                      </select>
                    </div>

                    <div v-if="scoreFormError" class="form-error">
                      <p class="text-size-4 text-danger">{{ scoreFormError }}</p>
                    </div>

                    <div class="flex flex-col sm:flex-row gap-3 pt-2">
                      <button
                        type="submit"
                        :disabled="actionLoading || (scorePreview !== null && !scorePreview.ok)"
                        class="btn-primary text-size-3 flex-1 justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Icon name="heroicons:check" class="w-5 h-5" />
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
              <div v-if="showAcceptMatchForm" class="te-modal" @click.self="showAcceptMatchForm = false">
                <div class="te-modal__panel">
                  <div class="flex items-center justify-between mb-6">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-lg bg-accent-subtle flex items-center justify-center">
                        <Icon name="heroicons:check-circle" class="w-5 h-5 text-accent" />
                      </div>
                      <h2 class="text-size-2 font-semibold text-foreground">Aceptar Partido</h2>
                    </div>
                    <button
                      @click="showAcceptMatchForm = false"
                      class="icon-button"
                    >
                      <Icon name="heroicons:x-mark" class="w-5 h-5" />
                    </button>
                  </div>
                  
                  <div class="space-y-6">
                    <div class="action-card">
                      <p class="text-size-4 font-semibold text-foreground mb-2">Detalles del Partido</p>
                      <div class="space-y-2 text-size-5 text-foreground-muted">
                        <p><span class="font-semibold text-foreground">Fecha:</span> {{ match.scheduled_at ? formatDateTime(match.scheduled_at) : 'Sin agendar' }}</p>
                        <p><span class="font-semibold text-foreground">Ubicación:</span> {{ match.location || 'Sin ubicación' }}</p>
                      </div>
                    </div>
                    
                    <!-- Change Proposal Form -->
                    <form v-if="acceptMatchForm.proposeChanges" @submit.prevent="handleAcceptMatchWithChanges" class="space-y-4">
                      <div>
                        <label for="accept_scheduled_at" class="form-label">
                          Nueva Fecha y Hora
                        </label>
                        <input
                          id="accept_scheduled_at"
                          v-model="acceptMatchForm.scheduled_at"
                          type="datetime-local"
                          :min="minDateTime"
                          class="form-input"
                        />
                        <p class="text-size-5 text-foreground-muted mt-2">
                          Deja vacío si solo quieres cambiar la ubicación
                        </p>
                      </div>
                      
                      <div>
                        <label for="accept_location" class="form-label">
                          Nueva Ubicación
                        </label>
                        <input
                          id="accept_location"
                          v-model="acceptMatchForm.location"
                          type="text"
                          class="form-input"
                          placeholder="Ej: Club de Tenis Quito"
                        />
                        <p class="text-size-5 text-foreground-muted mt-2">
                          Deja vacío si solo quieres cambiar la fecha y hora
                        </p>
                      </div>

                      <!-- Error Message -->
                      <div v-if="acceptMatchFormError" class="form-error">
                        <p class="text-size-4 text-danger">{{ acceptMatchFormError }}</p>
                      </div>

                      <div class="flex gap-3 pt-2">
                        <button
                          type="submit"
                          :disabled="actionLoading || (!acceptMatchForm.scheduled_at && !acceptMatchForm.location)"
                          class="btn-primary text-size-3 flex-1 justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Icon name="heroicons:check-circle" class="w-5 h-5" />
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
                        <Icon name="heroicons:check-circle" class="w-5 h-5" />
                        Aceptar Partido
                      </button>
                      <button
                        type="button"
                        @click="acceptMatchForm.proposeChanges = true"
                        :disabled="actionLoading"
                        class="btn-secondary text-size-3 w-full justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Icon name="heroicons:clock" class="w-5 h-5" />
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
              <div v-if="showRejectMatchForm" class="te-modal" @click.self="showRejectMatchForm = false">
                <div class="te-modal__panel">
                  <div class="flex items-center justify-between mb-6">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                        <Icon name="heroicons:x-circle" class="w-5 h-5 text-danger" />
                      </div>
                      <h2 class="text-size-2 font-semibold text-foreground">Rechazar Partido</h2>
                    </div>
                    <button
                      @click="showRejectMatchForm = false"
                      class="icon-button"
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
                        <Icon name="heroicons:x-circle" class="w-5 h-5" />
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
              <div v-if="showCancelMatchForm" class="te-modal" @click.self="showCancelMatchForm = false">
                <div class="te-modal__panel">
                  <div class="flex items-center justify-between mb-6">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                        <Icon name="heroicons:x-mark" class="w-5 h-5 text-danger" />
                      </div>
                      <h2 class="text-size-2 font-semibold text-foreground">Cancelar Partido</h2>
                    </div>
                    <button
                      @click="showCancelMatchForm = false"
                      class="icon-button"
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
                        <Icon name="heroicons:x-mark" class="w-5 h-5" />
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
              <div v-if="showOrganizerResultForm" class="te-modal" @click.self="showOrganizerResultForm = false">
                <div class="te-modal__panel">
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
                      class="icon-button"
                    >
                      <Icon name="heroicons:x-mark" class="w-5 h-5" />
                    </button>
                  </div>
                  
                  <form @submit.prevent="handleOrganizerSetResult" class="space-y-6">
                    <div>
                      <label for="organizer_winner" class="form-label">
                        Ganador
                      </label>
                      <select
                        id="organizer_winner"
                        v-model="organizerResultForm.winner_id"
                        required
                        class="form-select"
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
                      <label for="organizer_score" class="form-label">
                        Resultado
                      </label>
                      <input
                        id="organizer_score"
                        v-model="organizerResultForm.score"
                        type="text"
                        required
                        class="form-input"
                        placeholder="Ej: 6-4 3-6 7-5"
                      />
                      <p class="text-size-5 text-foreground-muted mt-2">
                        Primero los juegos de {{ match.player1?.name || 'el jugador 1' }} (ej: "6-4 6-3" o "6-2 4-6 10-8"). Si alguien se retiró, añade «ret.».
                      </p>
                    </div>

                    <!-- Error Message -->
                    <div v-if="organizerResultFormError" class="form-error">
                      <p class="text-size-4 text-danger">{{ organizerResultFormError }}</p>
                    </div>

                    <div class="flex gap-3 pt-2">
                      <button
                        type="submit"
                        :disabled="actionLoading || !organizerResultForm.winner_id || (!organizerResultForm.is_wo && !organizerResultForm.score)"
                        class="btn-primary text-size-3 flex-1 justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Icon name="heroicons:check-circle" class="w-5 h-5" />
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

    </div>
  </PageLayout>
</template>

<script setup lang="ts">
import { formatScore } from '~/utils/pendingAction'
import { checkWinner, parseScore, renderScore } from '~/utils/score'
import type { Match, MatchMessage } from '~/types'
import { useRankIconAsset } from '~/composables/useRankIcon'
import { getRatingTier } from '~/server/utils/rating-system'
import { getCurrentEcuadorDatetimeLocal } from '~/composables/useTimezone'
import { useWhatsApp } from '~/composables/useWhatsApp'

definePageMeta({
  middleware: 'auth'
})

const route = useRoute()
const matchId = route.params.id as string

const { isLoaded, userId, user } = useAuthState()
const { player, fetchPlayer } = usePlayer()
const { isAdmin } = useAdmin()
const { getMatch, updateMatchStatus, proposeScore, approveScore, rejectScore, cancelMatch, acceptMatch, rejectMatch, approveAcceptanceChange, rejectAcceptanceChange, proposeSchedule, approveSchedule, rejectSchedule, proposeReschedule, approveReschedule, rejectReschedule, organizerSetResult, loading, error } = useMatches()
const { fetchMessages, sendMessage, messages: chatMessages, loading: chatLoading, isPolling, setPolling, removeOptimisticMessage } = useMatchChat()
const { getWhatsAppLink } = useWhatsApp()
const sendingMessage = ref(false)
const initialLoading = ref(false)
const isPollingPaused = ref(false)
const failedMessages = ref<Map<string, any>>(new Map())

const match = ref<Match | null>(null)
type RatingWhy = {
  k: number
  margin: number
  expected: number
  opponent_before: number
  classification: { completion: string; sets: string }
}
type RatingSide = { elo_change: number; elo_before: number; elo_after: number; why?: RatingWhy | null }
const ratingHistory = ref<{ player1?: RatingSide; player2?: RatingSide } | null>(null)
const notRated = ref<string | null>(null)
const scoreFormError = ref<string | null>(null)
const actionLoading = ref(false)
const eloPollingInterval = ref<NodeJS.Timeout | null>(null)
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

// Get current date/time in datetime-local format (YYYY-MM-DDTHH:mm) using Ecuador timezone
const minDateTime = computed(() => {
  return getCurrentEcuadorDatetimeLocal()
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
  const role = user.value?.role
  if (role !== 'tournament_organizer') return false
  
  // Check if user is the organizer of this tournament
  // We'll verify this when loading the match
  return match.value.tournament?.organizer_id === currentPlayerId.value ||
         match.value.tournament?.created_by === currentPlayerId.value
})

// Check if user can view this match (player, organizer, or admin)
const canViewMatch = computed(() => {
  return isPlayerInMatch.value || isTournamentOrganizer.value || isAdmin.value
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

// Get player tier from ELO
const getPlayerTier = (player: any): string | null => {
  if (!player) return null
  if (player.elo !== undefined && player.elo !== null) {
    const tierInfo = getRatingTier(player.elo)
    return tierInfo.tier
  }
  return null
}

// Get player rank icon path
const getPlayerRankIcon = (player: any): string | null => {
  const tier = getPlayerTier(player)
  if (!tier) return null
  return useRankIconAsset(tier)
}

// Get tier name in Spanish
const getTierNameInSpanish = (tier: string | null): string => {
  if (!tier) return ''
  const tierNames: Record<string, string> = {
    'Bronze': 'Bronce',
    'Silver': 'Plata',
    'Gold': 'Oro',
    'Platinum': 'Platino',
    'Diamond': 'Diamante',
    'Master': 'Maestro',
    'Grandmaster': 'Gran Maestro',
    'Unrated': 'Sin clasificar'
  }
  return tierNames[tier] || tier
}

// Get opponent player (the one who is not the current player)
const getOpponent = computed(() => {
  if (!match.value || !currentPlayerId.value) return null
  if (match.value.player1_id === currentPlayerId.value) {
    return match.value.player2
  }
  return match.value.player1
})

// Get opponent phone number
const getOpponentPhoneNumber = computed(() => {
  const opponent = getOpponent.value
  return opponent?.phone_number || null
})

// Check if current player can see opponent's phone number
const canContactOpponent = computed(() => {
  if (!match.value || !currentPlayerId.value) return false
  if (!isPlayerInMatch.value) return false
  return !!getOpponentPhoneNumber.value
})

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

// Hero: "Sábado 19 de septiembre" + "09:00" in Ecuador time
const heroDate = computed(() => {
  const d = match.value?.scheduled_at ? new Date(match.value.scheduled_at) : null
  if (!d || isNaN(d.getTime())) return 'Sin agendar'
  const text = d.toLocaleDateString('es-EC', { timeZone: 'America/Guayaquil', weekday: 'long', day: 'numeric', month: 'long' })
  return text.charAt(0).toUpperCase() + text.slice(1)
})
const heroTime = computed(() => {
  const d = match.value?.scheduled_at ? new Date(match.value.scheduled_at) : null
  if (!d || isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('es-EC', { timeZone: 'America/Guayaquil', hour: '2-digit', minute: '2-digit', hour12: false })
})

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

// Load rating history separately
const loadRatingHistory = async () => {
  if (!match.value || !match.value.is_competitive || match.value.status !== 'completed' || !match.value.player1_id || !match.value.player2_id) {
    ratingHistory.value = null
    return
  }
  
  if (!userId.value) {
    ratingHistory.value = null
    return
  }
  
  try {
    const response = await $fetch<{
      success: boolean
      not_rated?: string
      rating_history: { player1: RatingSide | null; player2: RatingSide | null } | null
    }>(`/api/matches/${matchId}/rating-history`, {
      query: {}
    }).catch((err) => {
      // Log error for debugging but don't throw
      console.warn('Error loading rating history:', err)
      return { success: false, rating_history: null }
    })
    
    notRated.value = response.not_rated ?? null
    if (response.success && response.rating_history) {
      // Check if we actually have data for at least one player
      const hasData = response.rating_history.player1 || response.rating_history.player2
      if (hasData) {
        ratingHistory.value = {
          player1: response.rating_history.player1 || undefined,
          player2: response.rating_history.player2 || undefined
        }
        // Stop polling if ELO is ready
        if (eloPollingInterval.value) {
          clearInterval(eloPollingInterval.value)
          eloPollingInterval.value = null
        }
      } else {
        // No rating history exists yet (still calculating)
        ratingHistory.value = null
      }
    } else {
      // No rating history exists yet (still calculating)
      ratingHistory.value = null
    }
  } catch (err) {
    // Log error for debugging
    console.warn('Error loading rating history:', err)
    ratingHistory.value = null
  }
}

const isWalkoverScore = (score: string | null | undefined) => {
  const parsed = parseScore(score)
  return parsed.ok && parsed.score.completion === 'walkover'
}

// Live check of the typed score with the parser the server uses
const scorePreview = computed<{ ok: boolean; text: string } | null>(() => {
  if (!scoreForm.value.score.trim() || !match.value) return null
  const parsed = parseScore(scoreForm.value.score)
  if (!parsed.ok) return { ok: false, text: parsed.error }
  if (scoreForm.value.winner_id) {
    const side = scoreForm.value.winner_id === match.value.player1_id ? 'p1' : 'p2'
    const error = checkWinner(parsed.score, side)
    if (error) return { ok: false, text: error }
  }
  return { ok: true, text: `Se guardará como ${formatScore(renderScore(parsed.score))}` }
})

// "¿Por qué?" for the viewer's own SR change, from the inputs stored with the rating
const MARGIN_TEXT: Record<string, string> = {
  straight: 'Partido en dos sets: el cambio se multiplica por 1,1.',
  deciding: 'Partido a tres sets: el cambio se multiplica por 0,9.',
  incomplete: 'Partido con retiro: el cambio se multiplica por 0,9.',
  unknown: 'Marcador anterior al formato actual: el cambio no se ajusta por sets.',
}
const decimal = (n: number) => String(n).replace('.', ',')
const srWhy = computed(() => {
  const own = match.value?.player1_id === currentPlayerId.value ? ratingHistory.value?.player1
    : match.value?.player2_id === currentPlayerId.value ? ratingHistory.value?.player2 : undefined
  const why = own?.why
  if (!own || !why) return null
  return {
    change: own.elo_change,
    before: own.elo_before,
    opponent: why.opponent_before,
    expectedPct: Math.round(why.expected * 100),
    k: why.k,
    placement: why.k > 32,
    marginText: MARGIN_TEXT[why.classification.sets] ?? '',
    formula: `${why.k} × ${decimal(why.margin)} × (${own.elo_change > 0 || (own.elo_change === 0 && why.expected >= 0.5) ? 1 : 0} − ${decimal(why.expected)}) ≈ ${own.elo_change > 0 ? '+' : ''}${own.elo_change}`,
  }
})

// Computed to check if ELO is being calculated
const isEloCalculating = computed(() => {
  if (!match.value) return false
  return match.value.is_competitive && 
         match.value.status === 'completed' && 
         match.value.player1_id && 
         match.value.player2_id &&
         !notRated.value &&
         !ratingHistory.value
})

// Start polling for ELO calculation
const startEloPolling = () => {
  if (eloPollingInterval.value) {
    clearInterval(eloPollingInterval.value)
  }
  
  // Poll every 2 seconds to check if ELO is ready
  eloPollingInterval.value = setInterval(async () => {
    if (!isEloCalculating.value) {
      // Stop polling if ELO is no longer calculating
      if (eloPollingInterval.value) {
        clearInterval(eloPollingInterval.value)
        eloPollingInterval.value = null
      }
      return
    }
    
    // Reload rating history to check if it's ready
    await loadRatingHistory()
  }, 2000) // Poll every 2 seconds
}

// Stop ELO polling
const stopEloPolling = () => {
  if (eloPollingInterval.value) {
    clearInterval(eloPollingInterval.value)
    eloPollingInterval.value = null
  }
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
      await loadRatingHistory()
      
      // Start polling if ELO is still calculating
      if (isEloCalculating.value && !eloPollingInterval.value) {
        startEloPolling()
      }
    } else {
      ratingHistory.value = null
      // Stop polling if match is not completed
      if (eloPollingInterval.value) {
        clearInterval(eloPollingInterval.value)
        eloPollingInterval.value = null
      }
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
  scoreFormError.value = null
  try {
    await proposeScore(userId.value, match.value.id, {
      score: scoreForm.value.score,
      winner_id: scoreForm.value.winner_id
    })
    showScoreForm.value = false
    scoreForm.value = { score: '', winner_id: '' }
    await loadMatch()
  } catch (err: any) {
    scoreFormError.value = err.data?.statusMessage || err.data?.message || 'No se pudo proponer el resultado'
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
      score: match.value.score && !isWalkoverScore(match.value.score) ? match.value.score : '',
      is_wo: isWalkoverScore(match.value.score)
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
    await approveScore(userId.value, match.value.id, {
      score: match.value.score ?? '',
      winner_id: match.value.winner_id ?? '',
      score_proposed_at: match.value.score_proposed_at ?? ''
    })
    await loadMatch()
  } catch (err: any) {
    if (err.statusCode === 409 || err.status === 409) {
      useToastNotifications().error(err.data?.statusMessage || 'El marcador cambió. Revísalo antes de aprobarlo.')
      await loadMatch()
    }
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
  // Admins can view chat of any match
  if (!isPlayerInMatch.value && !isTournamentOrganizer.value && !isAdmin.value) return
  
  isChatOpen.value = !isChatOpen.value
  
  if (isChatOpen.value) {
    // Open chat - load messages and start polling
    // Admins can view chat of any match
    if (userId.value && (isPlayerInMatch.value || isTournamentOrganizer.value || isAdmin.value)) {
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
    // Only poll if chat is open, user is part of the match (or admin), and polling is not paused
    // Also skip polling if we're currently sending a message to avoid race conditions
    if (isChatOpen.value && !isPollingPaused.value && !sendingMessage.value && !chatLoading.value && userId.value && matchId && (isPlayerInMatch.value || isTournamentOrganizer.value || isAdmin.value) && match.value) {
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
watch([match, currentPlayerId, isPlayerInMatch, isTournamentOrganizer, isAdmin], async () => {
  // Admins can view chat of any match
  if ((isPlayerInMatch.value || isTournamentOrganizer.value || isAdmin.value) && match.value && currentPlayerId.value && userId.value && isChatOpen.value) {
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
    // Only close chat if user is not admin, not in match, and not organizer
    if (!isPlayerInMatch.value && !isTournamentOrganizer.value && !isAdmin.value) {
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
  // Clean up ELO polling
  stopEloPolling()
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  stopMessagesPolling()
})
</script>


<style scoped>
.match-tags { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.actions { display: grid; gap: 12px; }
.actions :deep(.pl-9) { padding-left: 0; }
.players { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px; }
.player { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; }
.player h2 { font-size: 18px; line-height: 1.3; overflow-wrap: anywhere; }
.player__avatar { width: 64px; height: 64px; font-size: 22px; }
.players__vs { align-self: center; margin-top: -24px; }
.result__score { font-size: clamp(30px, 4vw, 44px); }
.result__sr { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--edge); }
.result__sr--loading { display: flex; align-items: center; gap: 10px; }
.result__why { grid-column: 1 / -1; margin-top: 12px; color: var(--t-ink-muted); }
.result__why summary { cursor: pointer; font-weight: 600; color: var(--t-ink); min-height: 44px; display: flex; align-items: center; }
.result__why-list { display: grid; gap: 6px; margin: 8px 0 0; padding-left: 1.1em; list-style: disc; }
.chat { margin-top: 24px; }
.chat__title { font-size: 20px; }
.chat :deep(.chat__bubble) { padding: 12px 16px; border-radius: 16px; background: var(--surface); border: 1px solid var(--edge); }
.chat :deep(.chat__bubble--mine) { background: color-mix(in srgb, var(--accent) 14%, var(--surface)); border-color: transparent; }
.chat :deep(.chat__bubble--error) { border-color: var(--danger); background: var(--danger-subtle); }
@media (prefers-reduced-motion: no-preference) {
  .sr-spark { display: inline-block; animation: sr-spark 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.3s backwards; }
}
@keyframes sr-spark { from { opacity: 0; transform: translateY(8px) scale(0.96); } }
@media (max-width: 767px) { .player h2 { font-size: 16px; } }
.chat__moderation { display: flex; align-items: flex-start; gap: 6px; padding: 6px 10px; border-radius: 10px; background: var(--warning-subtle); color: var(--warning); }
</style>
