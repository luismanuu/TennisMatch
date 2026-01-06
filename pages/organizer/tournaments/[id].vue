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
    
    <!-- Spacer for fixed nav -->
    <div class="h-16"></div>

    <div class="section-padding relative z-10">
      <div class="container-medium px-6">
        <!-- Header -->
        <div class="mb-8 animate-fade-up">
          <NuxtLink to="/organizer/tournaments" class="inline-flex items-center gap-2 text-size-4 text-foreground-muted hover:text-accent mb-4 transition-colors">
            <Icon name="heroicons:arrow-left" class="w-4 h-4" />
            <span>Volver a Mis Torneos</span>
          </NuxtLink>
          <div class="flex items-start justify-between">
            <div>
              <h1 v-if="tournament" class="text-size-1 font-semibold text-foreground mb-2">{{ tournament.name }}</h1>
              <h1 v-else class="text-size-1 font-semibold text-foreground mb-2">
                <span class="inline-block w-48 h-8 bg-surface rounded animate-pulse"></span>
              </h1>
              <p v-if="tournament" class="text-size-3 font-regular text-foreground-muted">
                {{ tournament.category?.name || 'Abierto a todos' }} • {{ formatDate(tournament.start_date) }}
              </p>
              <p v-else class="text-size-3 font-regular text-foreground-muted">
                <span class="inline-block w-64 h-5 bg-surface rounded animate-pulse"></span>
              </p>
            </div>
            <div class="flex gap-3">
              <button
                v-if="tournament && tournament.status === 'upcoming'"
                @click="handleStartTournament"
                :disabled="startingTournament"
                class="px-6 py-3 rounded-xl bg-green-500 text-foreground text-size-4 font-semibold hover-lift transition-all disabled:opacity-50"
              >
                <span v-if="!startingTournament" class="flex items-center gap-2">
                  <Icon name="heroicons:play" class="w-4 h-4" />
                  Comenzar Torneo
                </span>
                <span v-else class="flex items-center gap-2">
                  <Icon name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
                  Iniciando...
                </span>
              </button>
              <button
                v-if="tournament && tournament.registrations && tournament.registrations.length >= tournament.min_players && !tournament.groups?.length"
                @click="handleGenerateBrackets"
                :disabled="generating"
                class="px-6 py-3 rounded-xl bg-accent text-foreground text-size-4 font-semibold hover-lift transition-all disabled:opacity-50"
              >
                <span v-if="!generating">Generar Brackets</span>
                <span v-else class="flex items-center gap-2">
                  <Icon name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
                  Generando...
                </span>
              </button>
            </div>
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="loading || !isLoaded" class="glass-card-elevated p-12 text-center animate-fade-in-scale">
          <Icon name="heroicons:arrow-path" class="w-12 h-12 text-accent mx-auto mb-4 animate-spin" />
          <p class="text-size-3 font-regular text-foreground-muted">Cargando torneo...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error && !loading" class="glass-card-elevated p-12 text-center animate-fade-in-scale">
          <Icon name="heroicons:exclamation-triangle" class="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 class="text-size-2 font-semibold text-foreground mb-2">Error al cargar el torneo</h3>
          <p class="text-size-4 font-regular text-foreground-muted mb-4">
            {{ error.message || 'No se pudo cargar la información del torneo' }}
          </p>
          <button
            @click="loadTournament"
            class="px-6 py-3 rounded-xl bg-accent text-foreground text-size-4 font-semibold hover-lift transition-all"
          >
            Intentar de nuevo
          </button>
        </div>

        <!-- Tournament Details -->
        <div v-else-if="tournament" class="space-y-8">
          <!-- Tournament Info -->
          <div class="glass-card-elevated p-6 animate-fade-up">
            <h2 class="text-size-2 font-semibold text-foreground mb-4">Información del Torneo</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-size-4 mb-4">
              <div>
                <span class="text-foreground-muted">Estado:</span>
                <span
                  :class="[
                    'ml-2 px-3 py-1 rounded-full text-size-4 font-semibold',
                    tournament.status === 'upcoming' ? 'bg-blue-500/20 text-blue-400' :
                    tournament.status === 'active' ? 'bg-green-500/20 text-green-400' :
                    'bg-gray-500/20 text-gray-400'
                  ]"
                >
                  {{ tournament.status === 'upcoming' ? 'Próximo' : tournament.status === 'active' ? 'Activo' : 'Completado' }}
                </span>
              </div>
              <div>
                <span class="text-foreground-muted">Fase Actual:</span>
                <span
                  :class="[
                    'ml-2 px-3 py-1 rounded-full text-size-4 font-semibold',
                    tournament.current_phase === 'registration' ? 'bg-purple-500/20 text-purple-400' :
                    tournament.current_phase === 'group_stage' ? 'bg-blue-500/20 text-blue-400' :
                    tournament.current_phase === 'playoffs' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-green-500/20 text-green-400'
                  ]"
                >
                  {{ getPhaseLabel(tournament.current_phase) }}
                </span>
              </div>
              <div>
                <span class="text-foreground-muted">Tipo de Torneo:</span>
                <span class="ml-2 text-foreground">{{ getTournamentTypeLabel(tournament.tournament_type) }}</span>
              </div>
              <div>
                <span class="text-foreground-muted">Registro:</span>
                <span class="ml-2 text-foreground">{{ tournament.registration_open ? 'Abierto' : 'Cerrado' }}</span>
              </div>
              <div>
                <span class="text-foreground-muted">Jugadores Registrados:</span>
                <span class="ml-2 text-foreground">{{ tournament.registrations?.length || 0 }}</span>
              </div>
              <div>
                <span class="text-foreground-muted">Tamaño de Grupo:</span>
                <span class="ml-2 text-foreground">{{ tournament.group_size }}</span>
              </div>
            </div>
            
            <!-- Phase Status & Advance Button -->
            <div v-if="phaseStatus" class="mt-6 pt-6 border-t border-border-subtle">
              <div class="flex items-center justify-between mb-4">
                <div>
                  <h3 class="text-size-3 font-semibold text-foreground mb-2">Estado de la Fase</h3>
                  <div v-if="phaseStatus.currentPhase === 'group_stage' && phaseStatus.groupStageStatus" class="text-size-4 text-foreground-muted">
                    <p>Partidos de Grupos: {{ phaseStatus.groupStageStatus.completedMatches }} / {{ phaseStatus.groupStageStatus.totalMatches }} completados</p>
                    <p v-if="phaseStatus.canAdvanceToPlayoffs" class="text-green-400 font-semibold mt-1">
                      ✓ Fase de grupos completada - Listo para avanzar a playoffs
                    </p>
                    <p v-else class="text-yellow-400 font-semibold mt-1">
                      ⏳ Esperando que se completen todos los partidos de grupos
                    </p>
                  </div>
                  <div v-else-if="phaseStatus.currentPhase === 'playoffs'" class="text-size-4 text-foreground-muted">
                    <p v-if="phaseStatus.mainPlayoffsStatus">
                      Bracket Main: {{ phaseStatus.mainPlayoffsStatus.completedMatches }} / {{ phaseStatus.mainPlayoffsStatus.totalMatches }} completados
                    </p>
                    <p v-else class="text-yellow-400 font-semibold">
                      ⚠️ Brackets de playoffs no generados
                    </p>
                    <p v-if="phaseStatus.backdrawPlayoffsStatus" class="mt-1">
                      Bracket Back: {{ phaseStatus.backdrawPlayoffsStatus.completedMatches }} / {{ phaseStatus.backdrawPlayoffsStatus.totalMatches }} completados
                    </p>
                    <p v-if="phaseStatus.canCompleteTournament" class="text-green-400 font-semibold mt-2">
                      ✓ Playoffs completados - Listo para finalizar torneo
                    </p>
                  </div>
                </div>
                <div class="flex gap-3">
                  <!-- Generate Playoffs Button (only show if in playoffs phase but no brackets) -->
                  <button
                    v-if="phaseStatus?.currentPhase === 'playoffs' && !hasPlayoffBrackets"
                    @click="handleGeneratePlayoffs"
                    :disabled="generatingPlayoffs"
                    class="px-6 py-3 rounded-xl bg-yellow-500/20 text-yellow-400 border-2 border-yellow-500/30 text-size-4 font-semibold hover-lift transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    <Icon name="heroicons:trophy" class="w-4 h-4" />
                    <span v-if="!generatingPlayoffs">Generar Brackets de Playoffs</span>
                    <span v-else class="flex items-center gap-2">
                      <Icon name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
                      Generando...
                    </span>
                  </button>
                  
                  <!-- Advance Phase Button -->
                  <button
                    v-if="canAdvancePhase"
                    @click="handleAdvancePhase"
                    :disabled="advancingPhase"
                    class="px-6 py-3 rounded-xl bg-accent text-foreground text-size-4 font-semibold hover-lift transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    <Icon name="heroicons:arrow-right" class="w-4 h-4" />
                    <span v-if="!advancingPhase">{{ getAdvanceButtonLabel() }}</span>
                    <span v-else class="flex items-center gap-2">
                      <Icon name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
                      Avanzando...
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Registered Players -->
          <div class="glass-card-elevated p-6 animate-fade-up animate-delay-1">
            <div class="flex items-center justify-between mb-4">
              <button
                @click="showRegisteredPlayers = !showRegisteredPlayers"
                class="flex items-center gap-2 text-size-2 font-semibold text-foreground hover:text-accent transition-colors"
              >
                <Icon 
                  :name="showRegisteredPlayers ? 'heroicons:chevron-down' : 'heroicons:chevron-right'" 
                  class="w-5 h-5 transition-transform"
                />
                <span>Jugadores Registrados ({{ filteredRegistrations.length }})</span>
              </button>
              <button
                @click="showRegisterForm = !showRegisterForm"
                class="px-4 py-2 rounded-xl bg-accent text-foreground text-size-4 font-semibold hover-lift transition-all"
              >
                Registrar Jugador
              </button>
            </div>
            <div v-show="showRegisteredPlayers">
              <!-- Filters -->
              <div class="mb-4 p-4 bg-surface rounded-xl border-2 border-border-subtle">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label class="block text-size-4 font-semibold text-foreground mb-2">Buscar por Nombre</label>
                    <input
                      v-model="playerFilters.search"
                      type="text"
                      placeholder="Nombre del jugador..."
                      class="w-full px-4 py-2 rounded-xl bg-background border-2 border-border-subtle text-foreground text-size-4 focus:border-accent focus:outline-none"
                    />
                  </div>
                  <div>
                    <label class="block text-size-4 font-semibold text-foreground mb-2">Filtrar por Categoría</label>
                    <select
                      v-model="playerFilters.category"
                      class="w-full px-4 py-2 rounded-xl bg-background border-2 border-border-subtle text-foreground text-size-4 focus:border-accent focus:outline-none"
                    >
                      <option value="">Todas las categorías</option>
                      <option
                        v-for="cat in uniqueCategories"
                        :key="cat"
                        :value="cat"
                      >
                        {{ cat }}
                      </option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-size-4 font-semibold text-foreground mb-2">Filtrar por Estado</label>
                    <select
                      v-model="playerFilters.status"
                      class="w-full px-4 py-2 rounded-xl bg-background border-2 border-border-subtle text-foreground text-size-4 focus:border-accent focus:outline-none"
                    >
                      <option value="">Todos los estados</option>
                      <option value="confirmed">Confirmado</option>
                      <option value="waitlisted">Lista de espera</option>
                      <option value="withdrawn">Retirado</option>
                    </select>
                  </div>
                </div>
                <div class="mt-3 flex justify-end">
                  <button
                    @click="clearPlayerFilters"
                    class="px-4 py-2 rounded-xl bg-surface-elevated border-2 border-border-subtle text-foreground text-size-4 font-semibold hover:border-accent transition-all"
                  >
                    Limpiar Filtros
                  </button>
                </div>
              </div>
            <div v-if="showRegisterForm" class="mb-4 p-4 bg-surface rounded-xl border-2 border-border-subtle">
              <input
                v-model="playerSearch"
                type="text"
                placeholder="Buscar jugador..."
                class="w-full px-4 py-2 rounded-xl bg-background border-2 border-border-subtle text-foreground text-size-4 focus:border-accent focus:outline-none mb-3"
              />
              <div v-if="searchResults.length > 0" class="max-h-48 overflow-y-auto space-y-2">
                <button
                  v-for="player in searchResults"
                  :key="player.id"
                  @click="handleRegisterPlayer(player.id)"
                  class="w-full px-4 py-2 rounded-xl bg-surface border-2 border-border-subtle text-foreground text-size-4 hover:border-accent transition-colors text-left"
                >
                  {{ player.name }}
                </button>
              </div>
            </div>
            <div v-if="paginatedRegistrations.length > 0" class="space-y-2">
              <div
                v-for="reg in paginatedRegistrations"
                :key="reg.id"
                class="p-4 rounded-xl bg-surface border-2 border-border-subtle"
              >
                <div class="flex items-start justify-between mb-2">
                  <div class="flex-1">
                    <div class="flex items-center gap-2 mb-2">
                      <h4 class="text-size-3 font-semibold text-foreground">{{ reg.player?.name }}</h4>
                      <span v-if="reg.player?.category" class="px-2 py-1 rounded-full text-size-5 font-semibold bg-accent-subtle/30 text-accent border border-accent/30">
                        {{ reg.player.category.name }}
                      </span>
                    </div>
                    <div class="space-y-1">
                      <div v-if="reg.player?.email" class="flex items-center gap-2 text-size-4 text-foreground-muted">
                        <Icon name="heroicons:envelope" class="w-4 h-4" />
                        <span>{{ reg.player.email }}</span>
                      </div>
                      <div v-if="reg.player?.phone_number" class="flex items-center gap-2 text-size-4 text-foreground-muted">
                        <Icon name="heroicons:phone" class="w-4 h-4" />
                        <span>{{ reg.player.phone_number }}</span>
                      </div>
                      <div v-if="!reg.player?.email && !reg.player?.phone_number" class="text-size-4 text-foreground-muted italic">
                        Sin información de contacto
                      </div>
                    </div>
                  </div>
                  <span
                    :class="[
                      'px-3 py-1 rounded-full text-size-4 font-semibold flex-shrink-0 ml-4',
                      reg.status === 'confirmed' ? 'bg-green-500/20 text-green-400' :
                      reg.status === 'waitlisted' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/20 text-red-400'
                    ]"
                  >
                    {{ reg.status === 'confirmed' ? 'Confirmado' : reg.status === 'waitlisted' ? 'Lista de espera' : 'Retirado' }}
                  </span>
                </div>
              </div>
            </div>
            <div v-else class="text-center py-8 text-foreground-muted">
              <Icon name="heroicons:magnifying-glass" class="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p class="text-size-3 font-semibold text-foreground mb-2">No se encontraron jugadores</p>
              <p class="text-size-4 text-foreground-muted">Ajusta los filtros o registra nuevos jugadores</p>
            </div>

            <!-- Pagination -->
            <div v-if="filteredRegistrations.length > playersPerPage" class="mt-6 flex items-center justify-between">
              <div class="text-size-4 text-foreground-muted">
                Mostrando {{ (currentPage - 1) * playersPerPage + 1 }} - {{ Math.min(currentPage * playersPerPage, filteredRegistrations.length) }} de {{ filteredRegistrations.length }} jugadores
              </div>
              <div class="flex items-center gap-2">
                <button
                  @click="currentPage = Math.max(1, currentPage - 1)"
                  :disabled="currentPage === 1"
                  class="px-4 py-2 rounded-xl bg-surface border-2 border-border-subtle text-foreground text-size-4 font-semibold hover:border-accent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Icon name="heroicons:chevron-left" class="w-4 h-4" />
                </button>
                <span class="px-4 py-2 text-size-4 font-semibold text-foreground">
                  Página {{ currentPage }} de {{ totalPages }}
                </span>
                <button
                  @click="currentPage = Math.min(totalPages, currentPage + 1)"
                  :disabled="currentPage === totalPages"
                  class="px-4 py-2 rounded-xl bg-surface border-2 border-border-subtle text-foreground text-size-4 font-semibold hover:border-accent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Icon name="heroicons:chevron-right" class="w-4 h-4" />
                </button>
              </div>
            </div>
            </div>
          </div>

          <!-- Bracket Visualization -->
          <div v-if="tournament.groups && tournament.groups.length > 0" class="glass-card-elevated p-6 animate-fade-up animate-delay-2">
            <button
              @click="showBrackets = !showBrackets"
              class="flex items-center gap-2 text-size-2 font-semibold text-foreground hover:text-accent transition-colors mb-4"
            >
              <Icon 
                :name="showBrackets ? 'heroicons:chevron-down' : 'heroicons:chevron-right'" 
                class="w-5 h-5 transition-transform"
              />
              <span>Brackets</span>
            </button>
            <div v-show="showBrackets">
              <TournamentBracket 
                :tournament-id="tournament.id" 
                :is-organizer="true"
                :tournament-organizer-id="tournament.organizer_id"
              />
            </div>
          </div>

          <!-- Deadline Management -->
          <div v-if="tournament && tournament.status === 'active'" class="glass-card-elevated p-6 animate-fade-up animate-delay-3">
            <h2 class="text-size-2 font-semibold text-foreground mb-4">Gestionar Fechas Límite</h2>
            
            <!-- Group Stage Deadline (only show if in group_stage phase) -->
            <div v-if="tournament.current_phase === 'group_stage'" class="space-y-4">
              <div>
                <label class="block text-size-4 font-semibold text-foreground mb-2">Fecha Límite Fase de Grupos</label>
                
                <!-- Current Deadline Display -->
                <div v-if="currentGroupDeadline" class="mb-3 p-3 rounded-xl bg-accent-subtle/20 border border-accent/30">
                  <div class="flex items-center gap-2 mb-1">
                    <Icon name="heroicons:calendar-days" class="w-5 h-5 text-accent" />
                    <span class="text-size-4 font-semibold text-foreground">Fecha Límite Actual:</span>
                  </div>
                  <p class="text-size-3 text-foreground ml-7">{{ formatDeadline(currentGroupDeadline) }}</p>
                </div>
                
                <input
                  v-model="groupDeadline"
                  type="datetime-local"
                  :min="minDateTime"
                  class="w-full px-4 py-2 rounded-xl bg-surface border-2 border-border-subtle text-foreground text-size-4 focus:border-accent focus:outline-none"
                />
                <p v-if="isGroupDeadlineInPast" class="text-size-4 font-regular text-red-400 mt-2">
                  No puedes establecer una fecha límite en el pasado
                </p>
                <button
                  @click="handleSetGroupDeadline"
                  :disabled="!groupDeadline"
                  class="mt-2 px-4 py-2 rounded-xl bg-accent text-foreground text-size-4 font-semibold hover-lift transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {{ currentGroupDeadline ? 'Actualizar Fecha Límite' : 'Establecer Fecha Límite' }}
                </button>
              </div>
            </div>

            <!-- Playoffs Deadlines (only show if in playoffs phase) -->
            <div v-if="tournament.current_phase === 'playoffs'" class="space-y-6">
              <!-- Main Bracket Deadlines -->
              <div>
                <h3 class="text-size-3 font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Icon name="heroicons:trophy" class="w-5 h-5 text-accent" />
                  Bracket Main
                </h3>
                <div class="space-y-4">
                  <div
                    v-for="(round, index) in mainPlayoffRounds"
                    :key="`main-${index}`"
                    class="p-4 rounded-xl bg-surface border-2 border-border-subtle"
                  >
                    <label class="block text-size-4 font-semibold text-foreground mb-2">
                      {{ getRoundName(round.round_number) }}
                    </label>
                    
                    <!-- Current Deadline Display -->
                    <div v-if="getPlayoffDeadline('main', round.round_number)" class="mb-3 p-3 rounded-xl bg-accent-subtle/20 border border-accent/30">
                      <div class="flex items-center gap-2 mb-1">
                        <Icon name="heroicons:calendar-days" class="w-4 h-4 text-accent" />
                        <span class="text-size-5 font-semibold text-foreground">Fecha Límite Actual:</span>
                      </div>
                      <p class="text-size-4 text-foreground ml-6">{{ formatDeadline(getPlayoffDeadline('main', round.round_number)) }}</p>
                    </div>
                    
                    <input
                      v-model="playoffDeadlines.main[round.round_number]"
                      type="datetime-local"
                      :min="minDateTime"
                      class="w-full px-4 py-2 rounded-xl bg-background border-2 border-border-subtle text-foreground text-size-4 focus:border-accent focus:outline-none"
                    />
                  </div>
                  <button
                    @click="handleSetPlayoffDeadlines('main')"
                    :disabled="!hasValidPlayoffDeadlines('main') || mainPlayoffRounds.length === 0"
                    class="w-full px-4 py-2 rounded-xl bg-accent text-foreground text-size-4 font-semibold hover-lift transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Establecer Fechas Límite Bracket Main
                  </button>
                  <p v-if="mainPlayoffRounds.length === 0" class="text-size-4 text-yellow-400 mt-2">
                    ⚠️ No se encontraron rondas de playoffs. Asegúrate de que los brackets estén generados.
                  </p>
                </div>
              </div>

              <!-- Backdraw Bracket Deadlines -->
              <div>
                <h3 class="text-size-3 font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Icon name="heroicons:trophy" class="w-5 h-5 text-accent-secondary" />
                  Bracket Back
                </h3>
                <div class="space-y-4">
                  <div
                    v-for="(round, index) in backdrawPlayoffRounds"
                    :key="`backdraw-${index}`"
                    class="p-4 rounded-xl bg-surface border-2 border-border-subtle"
                  >
                    <label class="block text-size-4 font-semibold text-foreground mb-2">
                      {{ getRoundName(round.round_number) }}
                    </label>
                    
                    <!-- Current Deadline Display -->
                    <div v-if="getPlayoffDeadline('backdraw', round.round_number)" class="mb-3 p-3 rounded-xl bg-accent-subtle/20 border border-accent/30">
                      <div class="flex items-center gap-2 mb-1">
                        <Icon name="heroicons:calendar-days" class="w-4 h-4 text-accent" />
                        <span class="text-size-5 font-semibold text-foreground">Fecha Límite Actual:</span>
                      </div>
                      <p class="text-size-4 text-foreground ml-6">{{ formatDeadline(getPlayoffDeadline('backdraw', round.round_number)) }}</p>
                    </div>
                    
                    <input
                      v-model="playoffDeadlines.backdraw[round.round_number]"
                      type="datetime-local"
                      :min="minDateTime"
                      class="w-full px-4 py-2 rounded-xl bg-background border-2 border-border-subtle text-foreground text-size-4 focus:border-accent focus:outline-none"
                    />
                  </div>
                  <button
                    @click="handleSetPlayoffDeadlines('backdraw')"
                    :disabled="!hasValidPlayoffDeadlines('backdraw') || backdrawPlayoffRounds.length === 0"
                    class="w-full px-4 py-2 rounded-xl bg-accent text-foreground text-size-4 font-semibold hover-lift transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Establecer Fechas Límite Bracket Back
                  </button>
                  <p v-if="backdrawPlayoffRounds.length === 0" class="text-size-4 text-yellow-400 mt-2">
                    ⚠️ No se encontraron rondas de playoffs. Asegúrate de que los brackets estén generados.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Tournament, PlayerSearchResult } from '~/types'

definePageMeta({
  middleware: ['organizer']
})

const route = useRoute()
const tournamentId = route.params.id as string

const { userId, isLoaded } = useAuthState()
const { getTournament: getOrgTournament, generateBrackets, generatePlayoffs, registerPlayer, setGroupDeadline, getPhaseStatus, advancePhase, currentTournament, loading, error } = useOrganizer()

const tournament = computed(() => currentTournament.value)

// Player filters and pagination - Declare these first
const playerFilters = ref({
  search: '',
  category: '',
  status: ''
})
const currentPage = ref(1)
const playersPerPage = 10

// Filtered registrations
const filteredRegistrations = computed(() => {
  if (!tournament.value?.registrations) return []
  
  let filtered = [...tournament.value.registrations]
  
  // Filter by search
  if (playerFilters.value.search) {
    const searchTerm = playerFilters.value.search.toLowerCase()
    filtered = filtered.filter(reg => 
      reg.player?.name?.toLowerCase().includes(searchTerm) ||
      reg.player?.email?.toLowerCase().includes(searchTerm) ||
      reg.player?.phone_number?.includes(searchTerm)
    )
  }
  
  // Filter by category
  if (playerFilters.value.category) {
    filtered = filtered.filter(reg => 
      reg.player?.category?.name === playerFilters.value.category
    )
  }
  
  // Filter by status
  if (playerFilters.value.status) {
    filtered = filtered.filter(reg => reg.status === playerFilters.value.status)
  }
  
  return filtered
})

// Unique categories from registrations
const uniqueCategories = computed(() => {
  if (!tournament.value?.registrations) return []
  const categories = new Set<string>()
  tournament.value.registrations.forEach(reg => {
    if (reg.player?.category?.name) {
      categories.add(reg.player.category.name)
    }
  })
  return Array.from(categories).sort()
})

// Pagination
const totalPages = computed(() => {
  return Math.ceil(filteredRegistrations.value.length / playersPerPage)
})

const paginatedRegistrations = computed(() => {
  const start = (currentPage.value - 1) * playersPerPage
  const end = start + playersPerPage
  return filteredRegistrations.value.slice(start, end)
})

// Reset to page 1 when filters change
watch(() => [playerFilters.value.search, playerFilters.value.category, playerFilters.value.status], () => {
  currentPage.value = 1
})

const clearPlayerFilters = () => {
  playerFilters.value = {
    search: '',
    category: '',
    status: ''
  }
  currentPage.value = 1
}

const loadTournament = async () => {
  if (!userId.value) return
  try {
    await getOrgTournament(tournamentId)
    // Load phase status if tournament has groups or is active
    if (tournament.value && (tournament.value.groups?.length || tournament.value.status === 'active')) {
      try {
        phaseStatus.value = await getPhaseStatus(tournamentId)
      } catch (err) {
        console.error('Error loading phase status:', err)
      }
    }
    // Load bracket data if in playoffs phase to get round numbers
    if (tournament.value?.current_phase === 'playoffs') {
      await loadBracketData()
    }
    // Load group deadline into the input field
    if (currentGroupDeadline.value) {
      // Convert deadline to datetime-local format (YYYY-MM-DDTHH:mm)
      const deadlineDate = new Date(currentGroupDeadline.value)
      const year = deadlineDate.getFullYear()
      const month = String(deadlineDate.getMonth() + 1).padStart(2, '0')
      const day = String(deadlineDate.getDate()).padStart(2, '0')
      const hours = String(deadlineDate.getHours()).padStart(2, '0')
      const minutes = String(deadlineDate.getMinutes()).padStart(2, '0')
      groupDeadline.value = `${year}-${month}-${day}T${hours}:${minutes}`
    } else {
      // Set default to today at 00:00 if no deadline exists
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      groupDeadline.value = `${year}-${month}-${day}T00:00`
    }
    
    // Load playoff deadlines into input fields
    if (tournament.value?.current_phase === 'playoffs') {
      // Ensure bracket data is loaded
      if (!bracketData.value) {
        await loadBracketData()
      }
      
      // Wait for rounds to be computed
      await nextTick()
      
      // Set default date to today at 00:00
      const now = new Date()
      const defaultYear = now.getFullYear()
      const defaultMonth = String(now.getMonth() + 1).padStart(2, '0')
      const defaultDay = String(now.getDate()).padStart(2, '0')
      const defaultDateTime = `${defaultYear}-${defaultMonth}-${defaultDay}T00:00`
      
      // Load main bracket deadlines
      mainPlayoffRounds.value.forEach(round => {
        // Main bracket
        const mainDeadline = getPlayoffDeadline('main', round.round_number)
        if (mainDeadline) {
          const deadlineDate = new Date(mainDeadline)
          const year = deadlineDate.getFullYear()
          const month = String(deadlineDate.getMonth() + 1).padStart(2, '0')
          const day = String(deadlineDate.getDate()).padStart(2, '0')
          const hours = String(deadlineDate.getHours()).padStart(2, '0')
          const minutes = String(deadlineDate.getMinutes()).padStart(2, '0')
          playoffDeadlines.value.main[round.round_number] = `${year}-${month}-${day}T${hours}:${minutes}`
        } else {
          // Set default to today at 00:00 if no deadline exists
          playoffDeadlines.value.main[round.round_number] = defaultDateTime
        }
        
        // Backdraw bracket
        const backdrawDeadline = getPlayoffDeadline('backdraw', round.round_number)
        if (backdrawDeadline) {
          const deadlineDate = new Date(backdrawDeadline)
          const year = deadlineDate.getFullYear()
          const month = String(deadlineDate.getMonth() + 1).padStart(2, '0')
          const day = String(deadlineDate.getDate()).padStart(2, '0')
          const hours = String(deadlineDate.getHours()).padStart(2, '0')
          const minutes = String(deadlineDate.getMinutes()).padStart(2, '0')
          playoffDeadlines.value.backdraw[round.round_number] = `${year}-${month}-${day}T${hours}:${minutes}`
        } else {
          // Set default to today at 00:00 if no deadline exists
          playoffDeadlines.value.backdraw[round.round_number] = defaultDateTime
        }
      })
      
      // Load backdraw bracket deadlines
      backdrawPlayoffRounds.value.forEach(round => {
        const backdrawDeadline = getPlayoffDeadline('backdraw', round.round_number)
        if (backdrawDeadline) {
          const deadlineDate = new Date(backdrawDeadline)
          const year = deadlineDate.getFullYear()
          const month = String(deadlineDate.getMonth() + 1).padStart(2, '0')
          const day = String(deadlineDate.getDate()).padStart(2, '0')
          const hours = String(deadlineDate.getHours()).padStart(2, '0')
          const minutes = String(deadlineDate.getMinutes()).padStart(2, '0')
          playoffDeadlines.value.backdraw[round.round_number] = `${year}-${month}-${day}T${hours}:${minutes}`
        } else if (!playoffDeadlines.value.backdraw[round.round_number]) {
          // Set default to today at 00:00 if no deadline exists and not already set
          playoffDeadlines.value.backdraw[round.round_number] = defaultDateTime
        }
      })
    }
  } catch (err) {
    console.error('Error loading tournament:', err)
  }
}

const getPhaseLabel = (phase: string | undefined) => {
  if (!phase) return 'Registro'
  const labels: Record<string, string> = {
    registration: 'Registro',
    group_stage: 'Fase de Grupos',
    playoffs: 'Playoffs',
    completed: 'Completado'
  }
  return labels[phase] || phase
}

const getTournamentTypeLabel = (type: string | undefined) => {
  if (!type) return 'Grupos + Playoffs'
  const labels: Record<string, string> = {
    groups_playoffs: 'Grupos + Playoffs',
    single_elimination: 'Eliminación Simple',
    double_elimination: 'Eliminación Doble',
    round_robin: 'Round Robin'
  }
  return labels[type] || type
}

const canAdvancePhase = computed(() => {
  if (!phaseStatus.value) return false
  return phaseStatus.value.canAdvanceToPlayoffs || phaseStatus.value.canCompleteTournament
})

const getAdvanceButtonLabel = () => {
  if (!phaseStatus.value) return 'Avanzar Fase'
  if (phaseStatus.value.currentPhase === 'group_stage' && phaseStatus.value.canAdvanceToPlayoffs) {
    return 'Avanzar a Playoffs'
  }
  if (phaseStatus.value.currentPhase === 'playoffs' && phaseStatus.value.canCompleteTournament) {
    return 'Finalizar Torneo'
  }
  return 'Avanzar Fase'
}

const handleGeneratePlayoffs = async () => {
  if (!userId.value) return
  try {
    generatingPlayoffs.value = true
    await generatePlayoffs(tournamentId)
    await loadTournament() // Reload to get updated brackets
    await loadPhaseStatus() // Reload phase status
    const toast = useToastNotifications()
    toast.success('Brackets de playoffs generados exitosamente')
  } catch (err: any) {
    const toast = useToastNotifications()
    toast.error(err.data?.message || err.message || 'Error al generar brackets de playoffs')
  } finally {
    generatingPlayoffs.value = false
  }
}

const handleAdvancePhase = async () => {
  if (!userId.value) return
  try {
    advancingPhase.value = true
    await advancePhase(tournamentId)
    await loadTournament() // Reload to get updated phase
    await loadPhaseStatus() // Reload phase status
    const toast = useToastNotifications()
    toast.success('Fase avanzada exitosamente')
  } catch (err: any) {
    const toast = useToastNotifications()
    toast.error(err.data?.message || err.message || 'Error al avanzar fase')
  } finally {
    advancingPhase.value = false
  }
}
const generating = ref(false)
const startingTournament = ref(false)
const showRegisterForm = ref(false)
const showRegisteredPlayers = ref(false)
const showBrackets = ref(true)
const playerSearch = ref('')
const searchResults = ref<PlayerSearchResult[]>([])
const groupDeadline = ref('')
const phaseStatus = ref<any>(null)
const advancingPhase = ref(false)
const generatingPlayoffs = ref(false)

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

// Check if selected group deadline is in the past
const isGroupDeadlineInPast = computed(() => {
  if (!groupDeadline.value) return false
  const selectedDate = new Date(groupDeadline.value)
  const now = new Date()
  return selectedDate < now
})

// Playoff deadlines management
const playoffDeadlines = ref<{
  main: Record<number, string>
  backdraw: Record<number, string>
}>({
  main: {},
  backdraw: {}
})

// Check if tournament has playoff brackets
const hasPlayoffBrackets = computed(() => {
  if (!phaseStatus.value) return false
  return phaseStatus.value.mainPlayoffsStatus && phaseStatus.value.mainPlayoffsStatus.totalMatches > 0
})

// Load playoff rounds from bracket matches if not in DB
const bracketData = ref<any>(null)
const loadBracketData = async () => {
  if (!tournament.value || tournament.value.current_phase !== 'playoffs') return
  try {
    const data = await $fetch(`/api/tournaments/${tournamentId}/bracket`)
    bracketData.value = data
  } catch (err) {
    console.error('Error loading bracket data:', err)
  }
}

// Get round name for display (helper function)
const getRoundNameForNumber = (roundNumber: number, totalRounds: number) => {
  const positionFromEnd = totalRounds - roundNumber
  
  if (positionFromEnd === 0) return 'Final'
  if (positionFromEnd === 1) return 'Semifinales'
  if (positionFromEnd === 2) return 'Cuartos de Final'
  return `${roundNumber}ª Ronda`
}

// Helper function to calculate rounds for a specific bracket type (main or backdraw)
// Uses EXACTLY the same logic as TournamentBracket component
const calculateRoundsForBracket = (bracketType: 'main' | 'backdraw') => {
  if (!bracketData.value) return []
  
  // Get matches for this specific bracket type only
  const matches = bracketData.value[bracketType] || []
  
  console.log(`[Deadline Rounds ${bracketType}] Matches:`, matches.length)
  
  if (matches.length === 0) return []
  
  // Convert to bracketry format to get roundIndex (same as TournamentBracket)
  // roundIndex = (round_number || 1) - 1 (0-based)
  const uniqueRoundIndexes = [...new Set(
    matches.map((m: any) => (m.round_number || 1) - 1)
  )].sort((a, b) => a - b)
  
  const maxRoundIndex = Math.max(...uniqueRoundIndexes, 0)
  
  console.log(`[Deadline Rounds ${bracketType}] Unique round indexes (0-based):`, uniqueRoundIndexes)
  console.log(`[Deadline Rounds ${bracketType}] Max round index:`, maxRoundIndex)
  
  // Calculate total rounds needed (EXACT same logic as TournamentBracket)
  let roundsToCreate = uniqueRoundIndexes.length
  
  // If we only have round 0 (first round), calculate how many rounds we need
  // based on the actual number of unique players in the first round
  if (roundsToCreate === 1 && uniqueRoundIndexes[0] === 0) {
    console.log(`[Deadline Rounds ${bracketType}] Only one round found (roundIndex 0), calculating from players...`)
    // Get all unique players from round 1 matches
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
    console.log(`[Deadline Rounds ${bracketType}] Round 1 matches:`, round1Matches.length)
    console.log(`[Deadline Rounds ${bracketType}] Unique players in round 1:`, totalPlayers)
    
    if (totalPlayers > 0) {
      // Calculate total rounds needed for single elimination bracket
      // Formula: ceil(log2(totalPlayers))
      roundsToCreate = Math.ceil(Math.log2(totalPlayers))
      console.log(`[Deadline Rounds ${bracketType}] Calculando rondas: ${totalPlayers} jugadores únicos = ${roundsToCreate} rondas totales`)
    } else {
      // Fallback: use number of matches * 2
      const round1MatchCount = round1Matches.length
      if (round1MatchCount > 0) {
        roundsToCreate = Math.ceil(Math.log2(round1MatchCount * 2))
        console.log(`[Deadline Rounds ${bracketType}] Fallback cálculo: ${round1MatchCount} partidos = ${roundsToCreate} rondas`)
      }
    }
  } else {
    // Use actual max round index + 1 (since roundIndex is 0-based)
    roundsToCreate = maxRoundIndex + 1
    console.log(`[Deadline Rounds ${bracketType}] Usando rondas reales: maxRoundIndex=${maxRoundIndex}, totalRounds=${roundsToCreate}`)
  }
  
  // Generate rounds (EXACT same logic as TournamentBracket)
  // TournamentBracket generates rounds from 0 to roundsToCreate-1 (0-based)
  // But we need round_number (1-based), so we generate from 1 to roundsToCreate
  const allRounds = []
  for (let i = 0; i < roundsToCreate; i++) {
    // Determine round name based on position (from end to beginning) - same as TournamentBracket
    const positionFromEnd = roundsToCreate - 1 - i
    let roundName = ''
    
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
      const roundNumber = i + 1
      roundName = `${roundNumber}ª Ronda`
    }
    
    // round_number is 1-based (i + 1)
    allRounds.push({
      round_number: i + 1,
      round_name: roundName
    })
  }
  
  console.log(`[Deadline Rounds ${bracketType}] Rounds created: ${allRounds.length}`, allRounds.map(r => `${r.round_number}: ${r.round_name}`))
  console.log(`[Deadline Rounds ${bracketType}] Rounds to create: ${roundsToCreate}`)
  
  return allRounds
}

// Get playoff rounds for Main bracket
const mainPlayoffRounds = computed(() => {
  // First, try to get from tournament rounds
  if (tournament.value?.rounds) {
    const mainRounds = tournament.value.rounds
      .filter((round: any) => round.bracket_type === 'main')
      .map((round: any) => ({
        round_number: round.round_number,
        round_name: getRoundNameForNumber(round.round_number, round.round_number)
      }))
    if (mainRounds.length > 0) {
      return mainRounds.sort((a: any, b: any) => a.round_number - b.round_number)
    }
  }
  
  // If no rounds in DB, calculate from bracket data
  return calculateRoundsForBracket('main')
})

// Get playoff rounds for Backdraw bracket
const backdrawPlayoffRounds = computed(() => {
  // First, try to get from tournament rounds
  if (tournament.value?.rounds) {
    const backdrawRounds = tournament.value.rounds
      .filter((round: any) => round.bracket_type === 'backdraw')
      .map((round: any) => ({
        round_number: round.round_number,
        round_name: getRoundNameForNumber(round.round_number, round.round_number)
      }))
    if (backdrawRounds.length > 0) {
      return backdrawRounds.sort((a: any, b: any) => a.round_number - b.round_number)
    }
  }
  
  // If no rounds in DB, calculate from bracket data
  return calculateRoundsForBracket('backdraw')
})

// Legacy: keep playoffRounds for backward compatibility (uses main bracket)
const playoffRounds = computed(() => mainPlayoffRounds.value)

// Get round name for display (uses playoffRounds)
const getRoundName = (roundNumber: number) => {
  const round = playoffRounds.value.find(r => r.round_number === roundNumber)
  return round?.round_name || `${roundNumber}ª Ronda`
}

// Get current playoff deadline for a specific bracket and round
const getPlayoffDeadline = (bracketType: 'main' | 'backdraw', roundNumber: number) => {
  if (!tournament.value?.rounds) return null
  const round = tournament.value.rounds.find(
    (r: any) => r.bracket_type === bracketType && r.round_number === roundNumber
  )
  return round?.deadline || null
}

// Check if playoff deadlines are valid
const hasValidPlayoffDeadlines = (bracketType: 'main' | 'backdraw') => {
  const rounds = bracketType === 'main' ? mainPlayoffRounds.value : backdrawPlayoffRounds.value
  if (!rounds || rounds.length === 0) {
    return false
  }
  const deadlines = playoffDeadlines.value[bracketType]
  return rounds.some(round => {
    const deadlineValue = deadlines[round.round_number]
    return deadlineValue && deadlineValue.trim() !== ''
  })
}

// Set playoff deadlines
const handleSetPlayoffDeadlines = async (bracketType: 'main' | 'backdraw') => {
  if (!userId.value) return
  
  const rounds = bracketType === 'main' ? mainPlayoffRounds.value : backdrawPlayoffRounds.value
  const deadlines = playoffDeadlines.value[bracketType]
  const roundsToSave = rounds
    .filter(round => deadlines[round.round_number] && deadlines[round.round_number].trim() !== '')
    .map(round => ({
      round_number: round.round_number,
      round_name: round.round_name,
      deadline: deadlines[round.round_number]
    }))
  
  if (roundsToSave.length === 0) {
    const toast = useToastNotifications()
    toast.error('Debes establecer al menos una fecha límite')
    return
  }
  
  try {
    await $fetch(`/api/organizer/tournaments/${tournamentId}/playoff-deadline`, {
      method: 'PUT',
      body: {
        clerk_id: userId.value,
        bracket_type: bracketType,
        rounds: roundsToSave
      }
    })
    await loadTournament()
    const toast = useToastNotifications()
    toast.success(`Fechas límite del Bracket ${bracketType === 'main' ? 'Main' : 'Back'} establecidas exitosamente`)
  } catch (err: any) {
    const toast = useToastNotifications()
    toast.error(err.data?.message || err.message || 'Error al establecer fechas límite')
  }
}

// Load phase status
const loadPhaseStatus = async () => {
  if (tournamentId) {
    try {
      phaseStatus.value = await getPhaseStatus(tournamentId)
    } catch (err) {
      console.error('Error loading phase status:', err)
    }
  }
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatDeadline = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Get current group stage deadline from tournament rounds
const currentGroupDeadline = computed(() => {
  if (!tournament.value?.rounds) return null
  const groupRound = tournament.value.rounds.find(
    (r: any) => r.bracket_type === 'group' && r.round_number === 1
  )
  return groupRound?.deadline || null
})

const handleGenerateBrackets = async () => {
  if (!userId.value) return
  try {
    generating.value = true
    await $fetch(`/api/organizer/tournaments/${tournamentId}/generate-brackets`, {
      method: 'POST',
      body: {
        clerk_id: userId.value
      }
    })
    await loadTournament()
    const toast = useToastNotifications()
    toast.success('Brackets generados exitosamente')
  } catch (err: any) {
    const toast = useToastNotifications()
    toast.error(err.data?.message || err.message || 'Error al generar brackets')
  } finally {
    generating.value = false
  }
}

const handleRegisterPlayer = async (playerId: string) => {
  if (!userId.value) return
  try {
    await $fetch(`/api/organizer/tournaments/${tournamentId}/register`, {
      method: 'POST',
      body: {
        clerk_id: userId.value,
        player_id: playerId
      }
    })
    await loadTournament()
    showRegisterForm.value = false
    playerSearch.value = ''
    searchResults.value = []
    const toast = useToastNotifications()
    toast.success('Jugador registrado exitosamente')
  } catch (err: any) {
    const toast = useToastNotifications()
    toast.error(err.data?.message || err.message || 'Error al registrar jugador')
  }
}

const handleStartTournament = async () => {
  if (!userId.value) return
  try {
    startingTournament.value = true
    await $fetch(`/api/organizer/tournaments/${tournamentId}`, {
      method: 'PUT',
      body: {
        clerk_id: userId.value,
        status: 'active'
      }
    })
    await loadTournament()
    const toast = useToastNotifications()
    toast.success('Torneo iniciado exitosamente')
  } catch (err: any) {
    const toast = useToastNotifications()
    toast.error(err.data?.message || err.message || 'Error al iniciar el torneo')
  } finally {
    startingTournament.value = false
  }
}

const handleSetGroupDeadline = async () => {
  if (!userId.value || !groupDeadline.value) return
  try {
    await $fetch(`/api/organizer/tournaments/${tournamentId}/group-deadline`, {
      method: 'PUT',
      body: {
        clerk_id: userId.value,
        deadline: groupDeadline.value
      }
    })
    await loadTournament()
    const toast = useToastNotifications()
    toast.success('Fecha límite establecida')
  } catch (err: any) {
    const toast = useToastNotifications()
    toast.error(err.data?.message || err.message || 'Error al establecer fecha límite')
  }
}


watch(playerSearch, async (search) => {
  if (search.length < 2) {
    searchResults.value = []
    return
  }
  if (!userId.value) return
  try {
    // Organizers can only see players registered in their tournament
    const results = await $fetch<PlayerSearchResult[]>(`/api/organizer/tournaments/${tournamentId}/players/search`, {
      query: {
        clerk_id: userId.value,
        q: search
      }
    })
    searchResults.value = results
  } catch (err) {
    console.error('Error searching players:', err)
    searchResults.value = []
  }
})

// Wait for auth to be loaded before loading tournament
watch(isLoaded, async (loaded) => {
  if (loaded && userId.value) {
    await loadTournament()
  }
}, { immediate: true })

onMounted(async () => {
  // Also try to load if auth is already loaded
  if (isLoaded.value && userId.value) {
    await loadTournament()
  }
})
</script>

